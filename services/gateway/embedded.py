"""Embedded gateway factory for desktop combined process."""

from __future__ import annotations

from fastapi import FastAPI

from services.gateway.app import create_gateway_app


def create_embedded_gateway() -> FastAPI:
    """Return the same gateway app factory used for desktop combined mode."""
    return create_gateway_app()
