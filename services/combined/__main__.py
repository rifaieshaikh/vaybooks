"""Run combined VayBooks API."""

from __future__ import annotations

import argparse
import os

import uvicorn

from services.combined.main import app


def main() -> None:
    parser = argparse.ArgumentParser(description="VayBooks combined API")
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.environ.get("VAYBOOKS_API_PORT", "8000")),
        help="Listen port (default: VAYBOOKS_API_PORT or 8000)",
    )
    parser.add_argument("--host", default="127.0.0.1")
    args = parser.parse_args()
    uvicorn.run(app, host=args.host, port=args.port)


if __name__ == "__main__":
    main()
