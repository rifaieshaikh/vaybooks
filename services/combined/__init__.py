"""Combined desktop/cloud single-process API."""

from services.combined.main import app, create_combined_app

__all__ = ["app", "create_combined_app"]
