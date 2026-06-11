import subprocess
import re
import io
import os
import sys
from PIL import Image

try:
    from models import DeviceInfo
except ImportError:
    from engine.models import DeviceInfo


def _find_adb() -> str:
    """Return adb path — prefers the binary bundled by PyInstaller."""
    if getattr(sys, 'frozen', False):
        bundled = os.path.join(sys._MEIPASS, 'adb.exe')
        if os.path.exists(bundled):
            return bundled
    return 'adb'


_ADB = _find_adb()

# The engine runs as a windowed app (PyInstaller console=False), so every
# subprocess on Windows would otherwise spawn a visible console window —
# the device-polling loop made a CMD flash every few seconds.
_CREATE_NO_WINDOW = 0x08000000 if os.name == "nt" else 0


class ADBManager:
    KNOWN_EMULATOR_PORTS = [
        ("BlueStacks 5",        5555),
        ("BlueStacks 5 (alt)",  5585),
        ("LDPlayer",            5555),  # 5554 is the emulator console port, not adb
        ("MEmu",                21503),
        ("NoxPlayer",           62001),
        ("MuMu Player",         7555),
        ("Genymotion",          5555),
        ("Andy",                5555),
    ]

    # ------------------------------------------------------------------ #
    #  Internal helpers                                                    #
    # ------------------------------------------------------------------ #

    def _run(self, args: list[str], device: str = None) -> tuple[int, str, str]:
        """Run an adb command. Returns (returncode, stdout, stderr)."""
        cmd = [_ADB]
        if device:
            cmd += ["-s", device]
        cmd += args
        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                encoding="utf-8",   # adb always outputs UTF-8; the Windows
                errors="replace",   # locale default (cp1252) would crash on it
                timeout=15,
                creationflags=_CREATE_NO_WINDOW,
            )
            return result.returncode, result.stdout.strip(), result.stderr.strip()
        except subprocess.TimeoutExpired:
            return 1, "", "adb command timed out"
        except FileNotFoundError:
            return 1, "", "adb not found – make sure Android SDK platform-tools is on PATH"
        except Exception as exc:
            return 1, "", str(exc)

    # ------------------------------------------------------------------ #
    #  Device management                                                   #
    # ------------------------------------------------------------------ #

    def get_devices(self) -> list[DeviceInfo]:
        """Return a list of all currently connected ADB devices."""
        code, out, err = self._run(["devices"])
        devices: list[DeviceInfo] = []

        if code != 0:
            return devices

        lines = out.splitlines()
        # Skip the header line ("List of devices attached")
        for line in lines[1:]:
            line = line.strip()
            if not line:
                continue
            # Each line is: <serial>\t<state>
            parts = re.split(r"\s+", line, maxsplit=1)
            if len(parts) < 2:
                continue
            serial, state = parts[0], parts[1]
            if state == "offline":
                status = "offline"
            elif state in ("device", "emulator"):
                status = "connected"
            else:
                status = state  # e.g. "unauthorized", "recovery" …

            # Try to get a friendly name (model property). Fall back to serial.
            name = self._get_device_name(serial) if status == "connected" else serial

            devices.append(DeviceInfo(id=serial, name=name, status=status))

        return devices

    def _get_device_name(self, serial: str) -> str:
        """Return the device model name, or the serial if it cannot be read."""
        code, out, _ = self._run(
            ["shell", "getprop", "ro.product.model"], device=serial
        )
        if code == 0 and out:
            return out.strip()
        return serial

    def scan(self) -> list[DeviceInfo]:
        """
        Attempt to connect to all known emulator ports on localhost,
        then return the refreshed device list.
        """
        seen_ports: set[int] = set()
        for _name, port in self.KNOWN_EMULATOR_PORTS:
            if port in seen_ports:
                continue
            seen_ports.add(port)
            try:
                subprocess.run(
                    [_ADB, "connect", f"127.0.0.1:{port}"],
                    capture_output=True,
                    timeout=3,
                    creationflags=_CREATE_NO_WINDOW,
                )
            except Exception:
                pass
        return self.get_devices()

    def connect(self, address: str) -> bool:
        """Connect to a device by TCP/IP address. Returns True on success."""
        if ":" not in address:
            address = f"{address}:5555"
        code, out, err = self._run(["connect", address])
        out_lower = out.lower()
        return "connected" in out_lower or "already connected" in out_lower

    def disconnect(self, address: str) -> bool:
        """Disconnect a TCP/IP device."""
        code, out, err = self._run(["disconnect", address])
        return code == 0

    # ------------------------------------------------------------------ #
    #  Screen capture                                                      #
    # ------------------------------------------------------------------ #

    def screenshot(self, device: str) -> Image.Image | None:
        """
        Capture the screen of *device* via ADB and return a PIL Image (RGB),
        or None if the capture failed.
        """
        try:
            result = subprocess.run(
                [_ADB, "-s", device, "exec-out", "screencap", "-p"],
                capture_output=True,
                timeout=15,
                creationflags=_CREATE_NO_WINDOW,
            )
        except subprocess.TimeoutExpired:
            return None
        except FileNotFoundError:
            return None
        except Exception:
            return None

        if result.returncode != 0 or not result.stdout:
            return None

        try:
            img = Image.open(io.BytesIO(result.stdout))
            return img.convert("RGB")
        except Exception:
            return None

    # ------------------------------------------------------------------ #
    #  Input actions                                                       #
    # ------------------------------------------------------------------ #

    def tap(self, device: str, x: int, y: int, duration: int = 100) -> bool:
        """Simulate a tap (or long-press when duration > ~500 ms) at (x, y)."""
        code, _, _ = self._run(
            ["shell", "input", "swipe",
             str(x), str(y), str(x), str(y), str(duration)],
            device=device,
        )
        return code == 0

    def swipe(
        self,
        device: str,
        x1: int,
        y1: int,
        x2: int,
        y2: int,
        duration: int = 500,
    ) -> bool:
        """Swipe from (x1, y1) to (x2, y2) over *duration* ms."""
        code, _, _ = self._run(
            ["shell", "input", "swipe",
             str(x1), str(y1), str(x2), str(y2), str(duration)],
            device=device,
        )
        return code == 0

    def type_text(self, device: str, text: str) -> bool:
        """Type a string of text on the device."""
        # Escape characters that the shell input command treats specially
        escaped = text.replace("\\", "\\\\")
        for ch in " '\"&;<>|()~`$#!*":
            escaped = escaped.replace(ch, "%s" if ch == " " else f"\\{ch}")
        code, _, _ = self._run(["shell", "input", "text", escaped], device=device)
        return code == 0

    # ------------------------------------------------------------------ #
    #  DNS / ad-blocking helpers                                           #
    # ------------------------------------------------------------------ #

    def set_dns(
        self,
        device: str,
        dns1: str = "94.140.14.14",
        dns2: str = "94.140.14.15",
    ) -> None:
        """Override the global DNS servers (requires ADB shell access)."""
        self._run(
            ["shell", "settings", "put", "global", "dns1", dns1],
            device=device,
        )
        self._run(
            ["shell", "settings", "put", "global", "dns2", dns2],
            device=device,
        )

    def reset_dns(
        self,
        device: str,
        dns1: str = "8.8.8.8",
        dns2: str = "8.8.4.4",
    ) -> None:
        """Restore DNS servers to Google's public resolvers."""
        self._run(
            ["shell", "settings", "put", "global", "dns1", dns1],
            device=device,
        )
        self._run(
            ["shell", "settings", "put", "global", "dns2", dns2],
            device=device,
        )
