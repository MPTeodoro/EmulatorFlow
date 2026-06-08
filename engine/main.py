"""
EmulatorFlow Engine – FastAPI server
Run with:
    python -m engine.main          (from the project root)
    python engine/main.py          (also works – sys.path is adjusted below)

Listens on http://127.0.0.1:8765
WebSocket endpoint: ws://127.0.0.1:8765/ws
"""

import sys
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
if _HERE not in sys.path:
    sys.path.insert(0, _HERE)

import asyncio
import json
import uuid

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models import (
    ExecuteRequest,
    ConnectRequest,
    ScreenshotRequest,
    AdBlockRequest,
    DeviceInfo,
)
from adb_manager import ADBManager
from vision import VisionEngine
from executor import FlowExecutor
from ad_blocker import AdBlocker


# --------------------------------------------------------------------------- #
#  WebSocket connection manager                                                #
# --------------------------------------------------------------------------- #

class WSManager:
    def __init__(self) -> None:
        self.connections: list[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.connections.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.connections:
            self.connections.remove(ws)

    async def broadcast(self, data: dict) -> None:
        message = json.dumps(data)
        dead: list[WebSocket] = []
        for ws in list(self.connections):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


# --------------------------------------------------------------------------- #
#  Request models                                                              #
# --------------------------------------------------------------------------- #

class StopRequest(BaseModel):
    run_id: str | None = None

class PauseRequest(BaseModel):
    run_id: str | None = None


# --------------------------------------------------------------------------- #
#  Singletons                                                                  #
# --------------------------------------------------------------------------- #

ws_manager = WSManager()
adb         = ADBManager()
vision      = VisionEngine()
ad_blocker  = AdBlocker(adb)

# Multiple concurrent runs: { run_id → { executor, task, name, device } }
active_runs: dict[str, dict] = {}


# --------------------------------------------------------------------------- #
#  Application                                                                 #
# --------------------------------------------------------------------------- #

app = FastAPI(title="EmulatorFlow Engine", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
#  Health                                                                      #
# --------------------------------------------------------------------------- #

@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0", "active_runs": len(active_runs)}


# --------------------------------------------------------------------------- #
#  Devices                                                                     #
# --------------------------------------------------------------------------- #

@app.get("/devices")
async def list_devices():
    devices = adb.get_devices()
    return {"devices": [d.dict() for d in devices]}


@app.post("/devices/scan")
async def scan_devices():
    devices = await asyncio.to_thread(adb.scan)
    await ws_manager.broadcast(
        {"type": "device_update", "devices": [d.dict() for d in devices]}
    )
    return {"devices": [d.dict() for d in devices]}


@app.post("/devices/connect")
async def connect_device(req: ConnectRequest):
    success = await asyncio.to_thread(adb.connect, req.address)
    devices = await asyncio.to_thread(adb.get_devices)
    await ws_manager.broadcast(
        {"type": "device_update", "devices": [d.dict() for d in devices]}
    )
    return {"success": success}


@app.post("/devices/disconnect")
async def disconnect_device(req: ConnectRequest):
    success = await asyncio.to_thread(adb.disconnect, req.address)
    devices = await asyncio.to_thread(adb.get_devices)
    await ws_manager.broadcast(
        {"type": "device_update", "devices": [d.dict() for d in devices]}
    )
    return {"success": success}


# --------------------------------------------------------------------------- #
#  Screenshot                                                                  #
# --------------------------------------------------------------------------- #

@app.post("/screenshot")
async def take_screenshot(req: ScreenshotRequest):
    img = await asyncio.to_thread(adb.screenshot, req.device)
    if img is None:
        return {"error": "Failed to take screenshot", "data": None}
    data = vision.image_to_base64(img)
    return {"data": data}


# --------------------------------------------------------------------------- #
#  Ad blocker                                                                  #
# --------------------------------------------------------------------------- #

@app.post("/adblocker")
async def toggle_adblock(req: AdBlockRequest):
    if req.enable:
        success = await asyncio.to_thread(ad_blocker.enable, req.device)
    else:
        success = await asyncio.to_thread(ad_blocker.disable, req.device)
    status = await asyncio.to_thread(ad_blocker.status, req.device)
    return {"success": success, "enabled": ad_blocker.is_enabled(req.device), "dns": status}

@app.get("/adblocker/status")
async def adblock_status(device: str):
    return {
        "enabled": ad_blocker.is_enabled(device),
        "dns": await asyncio.to_thread(ad_blocker.status, device),
    }


# --------------------------------------------------------------------------- #
#  Workflow execution — multi-run                                              #
# --------------------------------------------------------------------------- #

def _make_broadcaster(run_id: str):
    """Returns a broadcast function that tags every message with run_id."""
    async def broadcaster(msg: dict) -> None:
        msg["run_id"] = run_id
        await ws_manager.broadcast(msg)
    return broadcaster


@app.post("/execute/start")
async def start_execution(req: ExecuteRequest):
    run_id = str(uuid.uuid4())[:8]

    executor = FlowExecutor(
        workflow=req.workflow,
        device=req.device,
        adb=adb,
        vision=vision,
        ws_broadcast=_make_broadcaster(run_id),
    )

    task = asyncio.create_task(executor.run())
    active_runs[run_id] = {
        "executor": executor,
        "task": task,
        "name": req.workflow.name,
        "device": req.device,
    }

    def _on_done(t: asyncio.Task) -> None:
        active_runs.pop(run_id, None)
        asyncio.ensure_future(
            ws_manager.broadcast({"type": "run_ended", "run_id": run_id})
        )

    task.add_done_callback(_on_done)

    return {"run_id": run_id, "status": "started", "name": req.workflow.name}


@app.post("/execute/stop")
async def stop_execution(req: StopRequest = None):
    run_id = req.run_id if req else None

    if run_id:
        run = active_runs.get(run_id)
        if not run:
            return {"error": f"Run '{run_id}' not found"}
        await run["executor"].stop()
        run["task"].cancel()
        try:
            await run["task"]
        except asyncio.CancelledError:
            pass
    else:
        # Stop all active runs
        for rid, run in list(active_runs.items()):
            await run["executor"].stop()
            run["task"].cancel()
    return {"status": "stopped"}


@app.post("/execute/pause")
async def pause_execution(req: PauseRequest = None):
    run_id = req.run_id if req else None

    run = active_runs.get(run_id) if run_id else next(iter(active_runs.values()), None)
    if not run:
        return {"error": "No matching run found"}

    executor = run["executor"]
    if not executor.running:
        return {"error": "Run is not active"}

    await executor.pause()
    state = "paused" if executor.paused else "resumed"
    return {"status": state}


@app.get("/execute/runs")
async def list_runs():
    return {
        "runs": [
            {"run_id": rid, "name": info["name"], "device": info["device"]}
            for rid, info in active_runs.items()
        ]
    }


# --------------------------------------------------------------------------- #
#  WebSocket endpoint                                                          #
# --------------------------------------------------------------------------- #

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws_manager.connect(ws)
    try:
        devices = await asyncio.to_thread(adb.get_devices)
        await ws.send_text(
            json.dumps(
                {
                    "type": "device_update",
                    "devices": [d.dict() for d in devices],
                }
            )
        )

        # Also send current active runs on connect
        await ws.send_text(
            json.dumps(
                {
                    "type": "runs_sync",
                    "runs": [
                        {"run_id": rid, "name": info["name"], "device": info["device"]}
                        for rid, info in active_runs.items()
                    ],
                }
            )
        )

        while True:
            try:
                await asyncio.wait_for(ws.receive_text(), timeout=30.0)
            except asyncio.TimeoutError:
                await ws.send_text(json.dumps({"type": "ping"}))

    except WebSocketDisconnect:
        ws_manager.disconnect(ws)
    except Exception:
        ws_manager.disconnect(ws)


# --------------------------------------------------------------------------- #
#  Entry point                                                                 #
# --------------------------------------------------------------------------- #

if __name__ == "__main__":
    print("EmulatorFlow Engine starting on http://127.0.0.1:8765")
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8765,
        log_level="info",
    )
