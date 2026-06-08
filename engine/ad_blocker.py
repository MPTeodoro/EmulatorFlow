try:
    from adb_manager import ADBManager
except ImportError:
    from engine.adb_manager import ADBManager

ADGUARD_HOST = "dns.adguard.com"
ADGUARD_DNS1 = "94.140.14.14"
ADGUARD_DNS2 = "94.140.14.15"


class AdBlocker:
    def __init__(self, adb: ADBManager) -> None:
        self.adb = adb
        self._enabled: dict[str, bool] = {}

    def _android_api(self, device: str) -> int:
        """Return Android API level (e.g. 28 for Android 9)."""
        try:
            _, out, _ = self.adb._run(
                ["shell", "getprop", "ro.build.version.sdk"], device
            )
            return int(out.strip())
        except Exception:
            return 0

    def enable(self, device: str) -> bool:
        try:
            api = self._android_api(device)

            if api >= 28:
                # Android 9+ — Private DNS (DoT). Works in emulators.
                self.adb._run(["shell", "settings", "put", "global",
                               "private_dns_mode", "hostname"], device)
                self.adb._run(["shell", "settings", "put", "global",
                               "private_dns_specifier", ADGUARD_HOST], device)
            else:
                # Older Android — fallback to global DNS settings
                self.adb.set_dns(device, ADGUARD_DNS1, ADGUARD_DNS2)

            self._enabled[device] = True
            return True
        except Exception:
            return False

    def disable(self, device: str) -> bool:
        try:
            api = self._android_api(device)

            if api >= 28:
                # Restore to automatic Private DNS
                self.adb._run(["shell", "settings", "put", "global",
                               "private_dns_mode", "opportunistic"], device)
                self.adb._run(["shell", "settings", "delete", "global",
                               "private_dns_specifier"], device)
            else:
                self.adb._run(["shell", "settings", "delete", "global", "dns1"], device)
                self.adb._run(["shell", "settings", "delete", "global", "dns2"], device)

            self._enabled[device] = False
            return True
        except Exception:
            return False

    def status(self, device: str) -> dict:
        """Return current DNS mode and specifier for diagnostics."""
        try:
            _, mode, _  = self.adb._run(["shell", "settings", "get", "global",
                                          "private_dns_mode"], device)
            _, spec, _  = self.adb._run(["shell", "settings", "get", "global",
                                          "private_dns_specifier"], device)
            return {"mode": mode.strip(), "specifier": spec.strip()}
        except Exception:
            return {"mode": "unknown", "specifier": "unknown"}

    def is_enabled(self, device: str) -> bool:
        return self._enabled.get(device, False)
