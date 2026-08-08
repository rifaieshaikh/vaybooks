"""Non-Streamlit access/identity service container (Mongo only)."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Optional

logger = logging.getLogger(__name__)

_CONTAINER: Optional["AccessContainer"] = None


@dataclass
class AccessContainer:
    backend: str  # always "mongo"
    users: Any
    roles: Any
    authorization: Any
    audit: Any
    feature_flags: Any
    plans: Any


def _mongo_uri() -> str:
    from packages.services_kit.mongo_env import mongo_uri

    return mongo_uri()


def _db_name() -> str:
    from packages.services_kit.mongo_env import mongo_db_name

    return mongo_db_name()


def _require_uri() -> str:
    uri = _mongo_uri()
    if not uri:
        raise RuntimeError(
            "MONGODB_URI is required (set env or .streamlit/secrets.toml); "
            "memory backend is disabled"
        )
    return uri


def _api_actor() -> tuple[str, str]:
    return "api", "API"


def _build_mongo(uri: str) -> AccessContainer:
    from pymongo import MongoClient

    from vaybooks.bms.application.entitlements.authorization import AuthorizationService
    from vaybooks.bms.application.entitlements.service import (
        FeatureFlagAppService,
        PlanAppService,
    )
    from vaybooks.bms.application.identity.audit import AccessAuditAppService
    from vaybooks.bms.application.identity.service import RoleAppService, UserAppService
    from vaybooks.bms.infrastructure.repositories.entitlements.mongo_entitlement_repository import (
        MongoFeatureFlagRepository,
        MongoOrgEntitlementRepository,
        MongoPlanRepository,
    )
    from vaybooks.bms.infrastructure.repositories.identity.mongo_access_audit_repository import (
        MongoAccessAuditRepository,
    )
    from vaybooks.bms.infrastructure.repositories.identity.mongo_user_repository import (
        MongoRoleRepository,
        MongoUserRepository,
    )
    from vaybooks.bms.infrastructure.repositories.projects.mongo_app_user_repository import (
        MongoProjectMembershipRepository,
    )

    client = MongoClient(uri, serverSelectionTimeoutMS=5000, maxPoolSize=50, retryWrites=True)
    client.admin.command("ping")
    db = client[_db_name()]

    user_repo = MongoUserRepository(db)
    role_repo = MongoRoleRepository(db)
    feature_flag_repo = MongoFeatureFlagRepository(db)
    plan_repo = MongoPlanRepository(db)
    org_entitlement_repo = MongoOrgEntitlementRepository(db)
    membership_repo = MongoProjectMembershipRepository(db)
    access_audit_repo = MongoAccessAuditRepository(db)

    authorization = AuthorizationService(
        user_repo=user_repo,
        role_repo=role_repo,
        plan_repo=plan_repo,
        flag_repo=feature_flag_repo,
        org_entitlement_repo=org_entitlement_repo,
        membership_repo=membership_repo,
    )
    audit = AccessAuditAppService(
        access_audit_repo,
        actor_resolver=_api_actor,
        async_write=False,
    )
    users = UserAppService(
        user_repo,
        role_repo=role_repo,
        authorization=authorization,
        audit=audit,
    )
    roles = RoleAppService(role_repo, authorization=authorization, audit=audit)
    feature_flags = FeatureFlagAppService(
        feature_flag_repo, authorization=authorization, audit=audit
    )
    plans = PlanAppService(
        plan_repo,
        org_entitlement_repo,
        authorization=authorization,
        audit=audit,
    )
    return AccessContainer(
        backend="mongo",
        users=users,
        roles=roles,
        authorization=authorization,
        audit=audit,
        feature_flags=feature_flags,
        plans=plans,
    )


def build_access_container() -> AccessContainer:
    uri = _require_uri()
    container = _build_mongo(uri)
    logger.info("Access container using Mongo backend db=%s", _db_name())
    return container


def get_access_container() -> AccessContainer:
    global _CONTAINER
    if _CONTAINER is None:
        _CONTAINER = build_access_container()
    return _CONTAINER


def set_access_container(container: AccessContainer | None) -> None:
    global _CONTAINER
    _CONTAINER = container


def reset_access_container() -> AccessContainer:
    set_access_container(None)
    return get_access_container()
