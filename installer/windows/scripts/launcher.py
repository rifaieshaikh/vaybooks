#!/usr/bin/env python3
"""VayBooks desktop launcher — ensure local API (if any) then start Electron."""

from __future__ import annotations

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


SERVICE_NAME = "VayBooksBMS"
DEFAULT_PORT = 8000
ELECTRON_REL = Path("electron") / "win-unpacked" / "VayBooks.exe"


def _install_dir() -> Path:
    env = os.environ.get("VAYBOOKS_INSTALL_DIR")
    if env:
        return Path(env)
    # launcher lives in tools/ or is frozen beside install root
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent.parent
    return Path(__file__).resolve().parents[2]


def _data_dir() -> Path | None:
    raw = os.environ.get("VAYBOOKS_DATA_DIR")
    if raw:
        return Path(raw)
    return None


def _read_config() -> dict[str, str]:
    values: dict[str, str] = {}
    data_dir = _data_dir()
    if not data_dir:
        # Default ProgramData path on Windows
        program_data = os.environ.get("PROGRAMDATA")
        if program_data:
            data_dir = Path(program_data) / "VayBooks-BMS"
    if not data_dir:
        return values
    config_path = data_dir / "config" / "config.toml"
    if not config_path.exists():
        return values
    for line in config_path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, val = stripped.partition("=")
        values[key.strip()] = val.strip().strip('"').strip("'")
    return values


def _backend_mode(cfg: dict[str, str]) -> str:
    return (cfg.get("BACKEND_MODE") or os.environ.get("BACKEND_MODE") or "local").strip().lower()


def _api_base(cfg: dict[str, str]) -> str:
    url = (
        cfg.get("API_BASE_URL")
        or os.environ.get("API_BASE_URL")
        or os.environ.get("VAYBOOKS_UI_URL")
        or f"http://127.0.0.1:{cfg.get('APP_PORT') or DEFAULT_PORT}"
    )
    url = url.strip()
    return url if url.endswith("/") else url + "/"


def _service_running() -> bool:
    if sys.platform != "win32":
        return True
    result = subprocess.run(
        ["sc", "query", SERVICE_NAME],
        capture_output=True,
        text=True,
    )
    return "RUNNING" in result.stdout


def _start_service() -> None:
    if sys.platform != "win32":
        return
    subprocess.run(["net", "start", SERVICE_NAME], capture_output=True)


def _wait_for_health(base_url: str, timeout: float = 60.0) -> bool:
    health = base_url.rstrip("/") + "/health"
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(health, timeout=2) as resp:
                if 200 <= resp.status < 400:
                    return True
        except (urllib.error.URLError, TimeoutError, ValueError):
            time.sleep(1)
    return False


def _start_electron(install_dir: Path, cfg: dict[str, str]) -> int:
    electron = install_dir / ELECTRON_REL
    if not electron.exists():
        # alternate layout if staged differently
        alt = install_dir / "electron" / "VayBooks.exe"
        electron = alt if alt.exists() else electron
    if not electron.exists():
        print(f"Electron executable not found under {install_dir}", file=sys.stderr)
        return 1
    env = os.environ.copy()
    env["API_BASE_URL"] = _api_base(cfg)
    env["VAYBOOKS_UI_URL"] = env["API_BASE_URL"]
    data_dir = _data_dir()
    if data_dir:
        env["VAYBOOKS_DATA_DIR"] = str(data_dir)
    env["VAYBOOKS_INSTALL_DIR"] = str(install_dir)
    subprocess.Popen([str(electron)], cwd=str(electron.parent), env=env)
    return 0


def main() -> int:
    cfg = _read_config()
    install_dir = _install_dir()
    mode = _backend_mode(cfg)
    base = _api_base(cfg)

    if mode == "remote":
        return _start_electron(install_dir, cfg)

    if sys.platform == "win32" and not _service_running():
        _start_service()
        if not _wait_for_health(base):
            print("Local API service did not become ready in time.", file=sys.stderr)
            return 1
    elif not _wait_for_health(base, timeout=5):
        print(f"API not reachable at {base}", file=sys.stderr)
        return 1

    return _start_electron(install_dir, cfg)


if __name__ == "__main__":
    raise SystemExit(main())
