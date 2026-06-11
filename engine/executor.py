import asyncio
import datetime
import os
import time
from typing import Callable, Awaitable

try:
    from models import Workflow, Node
    from adb_manager import ADBManager
    from vision import VisionEngine
except ImportError:
    from engine.models import Workflow, Node
    from engine.adb_manager import ADBManager
    from engine.vision import VisionEngine


# Type alias for the broadcast callback
BroadcastFn = Callable[[dict], Awaitable[None]]


class FlowExecutor:
    """
    Walks a visual node-graph workflow and executes each node in sequence,
    emitting real-time status updates via a WebSocket broadcast callback.
    """

    def __init__(
        self,
        workflow: Workflow,
        device: str,
        adb: ADBManager,
        vision: VisionEngine,
        ws_broadcast: BroadcastFn,
    ) -> None:
        self.workflow = workflow
        self.device = device
        self.adb = adb
        self.vision = vision
        self.ws_broadcast = ws_broadcast

        self.running = False
        self.paused = False

        # Build lookup maps
        self.node_map: dict[str, Node] = {n.id: n for n in workflow.nodes}

        # edge_map: (source_id, source_handle) → target_id
        # Fan-out (two edges leaving the same handle) is not supported —
        # the last edge silently wins, so remember them to warn the user.
        self.edge_map: dict[tuple[str, str], str] = {}
        self._fanout_warnings: list[str] = []
        for edge in workflow.edges:
            handle = edge.sourceHandle or "out"
            key = (edge.source, handle)
            if key in self.edge_map:
                src = self.node_map.get(edge.source)
                name = (src.data.label if src else None) or edge.source
                self._fanout_warnings.append(
                    f"Node '{name}' has more than one edge on output "
                    f"'{handle}' — only the last one will be followed"
                )
            self.edge_map[key] = edge.target

    # ------------------------------------------------------------------ #
    #  Messaging helpers                                                   #
    # ------------------------------------------------------------------ #

    async def log(self, message: str, level: str = "info") -> None:
        await self.ws_broadcast(
            {
                "type": "log",
                "level": level,
                "message": message,
                "timestamp": datetime.datetime.now().strftime("%H:%M:%S"),
            }
        )

    async def emit_state(self, status: str, node_id: str | None = None) -> None:
        await self.ws_broadcast(
            {"type": "execution_state", "status": status, "node_id": node_id}
        )

    # ------------------------------------------------------------------ #
    #  Public control interface                                            #
    # ------------------------------------------------------------------ #

    async def run(self) -> None:
        """Entry point – find the Start node and begin execution."""
        self.running = True
        self.paused = False

        start_node = next(
            (n for n in self.workflow.nodes if n.type == "start"), None
        )
        if not start_node:
            await self.log("No Start node found in workflow", "error")
            self.running = False
            await self.emit_state("idle")
            return

        await self.log(f"Starting workflow: {self.workflow.name}")
        for warning in self._fanout_warnings:
            await self.log(warning, "warn")
        await self.emit_state("running")

        try:
            await self._execute_from(start_node.id)
            await self.log("Workflow completed successfully")
        except asyncio.CancelledError:
            await self.log("Execution cancelled", "warn")
        except Exception as exc:
            await self.log(f"Execution error: {exc}", "error")
        finally:
            self.running = False
            await self.emit_state("idle")

    async def stop(self) -> None:
        """Signal the executor to stop after the current node finishes."""
        self.running = False

    async def pause(self) -> None:
        """Toggle pause / resume."""
        self.paused = not self.paused

    # ------------------------------------------------------------------ #
    #  Graph traversal                                                     #
    # ------------------------------------------------------------------ #

    async def _execute_from(self, start_node_id: str, loop_depth: int = 0) -> None:
        """
        Walk the graph linearly starting from *start_node_id*, following
        edges chosen by each node's output handle.
        """
        current_id: str | None = start_node_id

        while current_id and self.running:
            # Honour pause
            while self.paused and self.running:
                await asyncio.sleep(0.1)

            if not self.running:
                break

            node = self.node_map.get(current_id)
            if not node:
                await self.log(f"Node '{current_id}' not found, stopping", "warn")
                break

            await self.emit_state("running", current_id)

            try:
                output_handle = await self._run_node(node, loop_depth)
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                await self.log(
                    f"Node '{node.data.label or node.id}' raised an error: {exc}",
                    "error",
                )
                output_handle = "error"

            await self.ws_broadcast(
                {
                    "type": "node_result",
                    "node_id": current_id,
                    "output": output_handle,
                    "data": {},
                }
            )

            # Follow the edge that matches the output handle.
            # A node that errored must NOT fall back to its success path —
            # without an explicit "error" edge the run stops here.
            next_id = self.edge_map.get((current_id, output_handle))
            if next_id is None and output_handle not in ("out", "error"):
                next_id = self.edge_map.get((current_id, "out"))
            if next_id is None and output_handle == "error":
                await self.log(
                    "Node failed and has no 'error' edge connected — stopping run",
                    "error",
                )

            current_id = next_id

    # ------------------------------------------------------------------ #
    #  Node execution                                                      #
    # ------------------------------------------------------------------ #

    def _resolve_template_path(self, image_path: str) -> str:
        """
        Build the absolute path to a template image.
        If the workflow provides an assets_path, join them; otherwise use
        image_path as-is (it may already be absolute).
        """
        if self.workflow.assets_path:
            return os.path.join(self.workflow.assets_path, image_path)
        return image_path

    async def _run_node(self, node: Node, loop_depth: int = 0) -> str:
        """
        Execute a single node and return the output handle string that
        determines which edge to follow next.
        """
        d = node.data
        t = node.type
        label = d.label or t

        # ---- start ---------------------------------------------------- #
        if t == "start":
            await self.log("Bot started")
            return "out"

        # ---- match_screen --------------------------------------------- #
        elif t == "match_screen":
            await self.log(f"[{label}] Taking screenshot...")
            screenshot = await asyncio.to_thread(self.adb.screenshot, self.device)
            if screenshot is None:
                await self.log(f"[{label}] Failed to take screenshot", "error")
                return "no_match"

            template_path = self._resolve_template_path(d.image_path)
            result = await asyncio.to_thread(
                self.vision.match_template, screenshot, template_path, d.threshold
            )

            verdict = "MATCH" if result["matched"] else "NO MATCH"
            await self.log(
                f"[{label}] Confidence: {result['confidence']:.3f} → {verdict}"
            )
            return "match" if result["matched"] else "no_match"

        # ---- find_element --------------------------------------------- #
        elif t == "find_element":
            await self.log(f"[{label}] Searching for element...")
            screenshot = await asyncio.to_thread(self.adb.screenshot, self.device)
            if screenshot is None:
                await self.log(f"[{label}] Screenshot failed", "error")
                return "not_found"

            template_path = self._resolve_template_path(d.image_path)
            result = await asyncio.to_thread(
                self.vision.match_template, screenshot, template_path, d.threshold
            )

            status_str = "Found" if result["matched"] else "Not found"
            await self.log(
                f"[{label}] {status_str} (conf: {result['confidence']:.3f})"
            )
            return "found" if result["matched"] else "not_found"

        # ---- wait_for_image ------------------------------------------- #
        elif t == "wait_for_image":
            timeout = d.timeout or 30.0
            interval = max(0.5, d.interval or 2.0)
            template_path = self._resolve_template_path(d.image_path)

            await self.log(
                f"[{label}] Waiting for image (timeout: {timeout}s, interval: {interval}s)..."
            )

            # Wall-clock deadline — screenshot + matching time counts too,
            # not just the sleeps. Time spent paused extends the deadline.
            start = time.monotonic()
            deadline = start + timeout

            while time.monotonic() < deadline and self.running:
                if self.paused:
                    paused_at = time.monotonic()
                    while self.paused and self.running:
                        await asyncio.sleep(0.1)
                    deadline += time.monotonic() - paused_at

                screenshot = await asyncio.to_thread(self.adb.screenshot, self.device)
                if screenshot is not None:
                    result = await asyncio.to_thread(
                        self.vision.match_template,
                        screenshot,
                        template_path,
                        d.threshold,
                    )
                    if result["matched"]:
                        await self.log(
                            f"[{label}] Image found after {time.monotonic() - start:.1f}s"
                        )
                        return "found"

                await asyncio.sleep(interval)

            await self.log(f"[{label}] Timeout after {timeout}s", "warn")
            return "timeout"

        # ---- tap ------------------------------------------------------ #
        elif t == "tap":
            await self.log(f"[{label}] Tapping ({d.x}, {d.y})")
            ok = await asyncio.to_thread(
                self.adb.tap, self.device, d.x, d.y, d.duration or 100
            )
            if not ok:
                await self.log(f"[{label}] adb reported the tap failed", "warn")
            await asyncio.sleep(0.1)
            return "out"

        # ---- swipe ---------------------------------------------------- #
        elif t == "swipe":
            await self.log(
                f"[{label}] Swiping ({d.x1},{d.y1}) → ({d.x2},{d.y2})"
            )
            ok = await asyncio.to_thread(
                self.adb.swipe,
                self.device,
                d.x1,
                d.y1,
                d.x2,
                d.y2,
                d.duration or 500,
            )
            if not ok:
                await self.log(f"[{label}] adb reported the swipe failed", "warn")
            await asyncio.sleep(0.2)
            return "out"

        # ---- wait ----------------------------------------------------- #
        elif t == "wait":
            secs = max(0.0, d.seconds or 1.0)
            await self.log(f"[{label}] Waiting {secs}s...")
            await asyncio.sleep(secs)
            return "out"

        # ---- loop ----------------------------------------------------- #
        elif t == "loop":
            max_iter = d.iterations  # -1 = infinite
            iteration = 0

            body_start_id = self.edge_map.get((node.id, "body"))
            if not body_start_id:
                await self.log(f"[{label}] Loop has no 'body' edge connected", "warn")
                return "done"

            while self.running and (max_iter == -1 or iteration < max_iter):
                iter_label = "∞" if max_iter == -1 else f"{iteration + 1}/{max_iter}"
                await self.log(f"[{label}] Iteration {iter_label}")

                # Walk the body subgraph; stop when we reach a dead end or
                # would cycle back into this loop node itself.
                current_id: str | None = body_start_id
                visited: set[str] = set()

                while current_id and self.running and current_id != node.id:
                    # Honour pause inside the loop body too
                    while self.paused and self.running:
                        await asyncio.sleep(0.1)
                    if not self.running:
                        break

                    if current_id in visited:
                        # Cycle detected inside body – break to avoid hang
                        await self.log(
                            f"[{label}] Cycle detected inside loop body at node "
                            f"'{current_id}', stopping body traversal",
                            "warn",
                        )
                        break
                    visited.add(current_id)

                    body_node = self.node_map.get(current_id)
                    if not body_node:
                        break

                    await self.emit_state("running", current_id)

                    try:
                        body_output = await self._run_node(body_node, loop_depth + 1)
                    except asyncio.CancelledError:
                        raise
                    except Exception as exc:
                        await self.log(
                            f"[{label}] Body node error: {exc}", "error"
                        )
                        body_output = "error"

                    await self.ws_broadcast(
                        {
                            "type": "node_result",
                            "node_id": current_id,
                            "output": body_output,
                            "data": {},
                        }
                    )

                    next_id = self.edge_map.get((current_id, body_output))
                    if next_id is None and body_output not in ("out", "error"):
                        next_id = self.edge_map.get((current_id, "out"))
                    if next_id is None and body_output == "error":
                        await self.log(
                            f"[{label}] Body node failed with no 'error' edge — "
                            "skipping to next iteration",
                            "warn",
                        )
                    current_id = next_id

                iteration += 1
                # Yield to the event loop to keep the server responsive
                await asyncio.sleep(0)

            await self.log(f"[{label}] Loop completed ({iteration} iterations)")
            return "done"

        # ---- find_tap ------------------------------------------------- #
        elif t == "find_tap":
            await self.log(f"[{label}] Searching for element to tap...")
            screenshot = await asyncio.to_thread(self.adb.screenshot, self.device)
            if screenshot is None:
                await self.log(f"[{label}] Screenshot failed", "error")
                return "not_found"

            template_path = self._resolve_template_path(d.image_path)
            result = await asyncio.to_thread(
                self.vision.match_template, screenshot, template_path, d.threshold
            )

            if result["matched"] and result["location"]:
                x, y = result["location"]
                await self.log(
                    f"[{label}] Found at ({x}, {y}) conf:{result['confidence']:.3f} — tapping"
                )
                await asyncio.to_thread(self.adb.tap, self.device, x, y, d.duration or 100)
                await asyncio.sleep(0.1)
                return "found"

            await self.log(f"[{label}] Not found (conf: {result['confidence']:.3f})")
            return "not_found"

        # ---- random_tap ----------------------------------------------- #
        elif t == "random_tap":
            import random
            x1, x2 = sorted([int(d.x1 or 0), int(d.x2 or 0)])
            y1, y2 = sorted([int(d.y1 or 0), int(d.y2 or 0)])
            rx = random.randint(x1, x2) if x1 != x2 else x1
            ry = random.randint(y1, y2) if y1 != y2 else y1
            await self.log(f"[{label}] Random tap at ({rx}, {ry})")
            ok = await asyncio.to_thread(self.adb.tap, self.device, rx, ry, d.duration or 100)
            if not ok:
                await self.log(f"[{label}] adb reported the tap failed", "warn")
            await asyncio.sleep(0.1)
            return "out"

        # ---- type_text ------------------------------------------------ #
        elif t == "type_text":
            text = d.text or ""
            if text and not text.isascii():
                await self.log(
                    f"[{label}] Text contains accented/non-ASCII characters — "
                    "'adb input text' cannot type those, they may be skipped",
                    "warn",
                )
            await self.log(f"[{label}] Typing: {repr(text[:40])}")
            ok = await asyncio.to_thread(self.adb.type_text, self.device, text)
            if not ok:
                await self.log(f"[{label}] adb reported typing failed", "warn")
            await asyncio.sleep(0.1)
            return "out"

        # ---- log ------------------------------------------------------ #
        elif t == "log":
            message = d.message or d.label or "(empty log)"
            await self.log(f"[LOG] {message}")
            return "out"

        # ---- unknown -------------------------------------------------- #
        else:
            await self.log(f"Unknown node type: '{t}'", "warn")
            return "out"
