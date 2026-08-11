"""VayBooks API gateway."""

from services.gateway.app import create_gateway_app
from services.gateway.embedded import create_embedded_gateway

__all__ = ["create_gateway_app", "create_embedded_gateway"]
