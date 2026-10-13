import os

from pymongo import MongoClient

from vaybooks.bms.infrastructure.config.settings import get_settings, validate_mongo_connection

_client: MongoClient | None = None


def _mongo_uri() -> str:
    settings = get_settings()
    if settings.mongo_uri:
        return settings.mongo_uri
    uri = os.environ.get("MONGODB_URI")
    if not uri:
        raise RuntimeError(
            "MONGODB_URI is required (set env or .streamlit/secrets.toml)"
        )
    return uri


def _mongo_database() -> str:
    settings = get_settings()
    if settings.db_name:
        return settings.db_name
    return os.environ.get("MONGODB_DATABASE") or "zahcci_customization"


def get_mongo_client():
    """A single MongoClient shared by this process."""
    global _client
    if _client is None:
        _client = MongoClient(
            _mongo_uri(),
            serverSelectionTimeoutMS=5000,
            maxPoolSize=50,
            retryWrites=True,
        )
    return _client


def get_database():
    client = get_mongo_client()
    return client[_mongo_database()]


def get_database_from_uri(uri: str, database_name: str):
    """Open a database from an explicit URI."""
    client = MongoClient(uri)
    return client[database_name]


def get_mongo_client_from_settings():
    """MongoClient for CLI and backup scripts."""
    settings = get_settings()
    return MongoClient(
        settings.mongo_uri,
        serverSelectionTimeoutMS=5000,
        maxPoolSize=50,
        retryWrites=True,
    )


__all__ = [
    "get_mongo_client",
    "get_database",
    "get_database_from_uri",
    "get_mongo_client_from_settings",
    "validate_mongo_connection",
]
