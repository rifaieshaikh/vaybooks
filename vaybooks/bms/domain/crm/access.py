"""CRM access policy for legacy AppUser roles and app-wide permissions."""

from __future__ import annotations

from typing import Any, Iterable, List, Optional, Set

from vaybooks.bms.domain.crm.enums import CrmRole


class CrmAccessPolicy:
    """Role + assignment scoping for CRM records."""

    def __init__(self, user=None, permission_keys: Optional[Iterable[str]] = None):
        self.user = user
        self.roles: Set[CrmRole] = set(getattr(user, "crm_roles", None) or [])
        self.permission_keys: Set[str] = set(permission_keys or [])

    @property
    def user_id(self) -> str:
        return getattr(self.user, "id", "") if self.user else ""

    def has_role(self, *roles: CrmRole) -> bool:
        return any(r in self.roles for r in roles)

    def is_admin(self) -> bool:
        return CrmRole.CRM_ADMINISTRATOR in self.roles or (
            "crm.records.view_all" in self.permission_keys
            and "crm.settings.edit" in self.permission_keys
        )

    def is_manager(self) -> bool:
        return (
            self.has_role(CrmRole.SALES_MANAGER, CrmRole.CRM_ADMINISTRATOR)
            or "crm.records.view_team" in self.permission_keys
            or "crm.leads.assign" in self.permission_keys
        )

    def is_rep(self) -> bool:
        return (
            CrmRole.SALES_REPRESENTATIVE in self.roles
            or "crm.records.view_own" in self.permission_keys
        )

    def is_collection(self) -> bool:
        return (
            CrmRole.ACCOUNTS_COLLECTION in self.roles
            or "crm.credit.manage" in self.permission_keys
            or "crm.payment_followups.create" in self.permission_keys
        )

    def can_manage_settings(self) -> bool:
        return self.is_admin() or "crm.settings.edit" in self.permission_keys

    def can_import_leads(self) -> bool:
        return (
            self.is_admin()
            or self.is_manager()
            or "crm.import.run" in self.permission_keys
        )

    def can_import_as_separate(self) -> bool:
        return self.is_admin() or "crm.corrections.auto_apply" in self.permission_keys

    def can_correct_automatic_activities(self) -> bool:
        return self.is_admin() or "crm.corrections.auto_apply" in self.permission_keys

    def can_assign(self) -> bool:
        return (
            self.is_manager()
            or "crm.leads.assign" in self.permission_keys
            or "crm.enquiries.assign" in self.permission_keys
        )

    def can_view_all(self) -> bool:
        """Org-wide visibility — admin or explicit view_all only (not team managers)."""
        return self.is_admin() or "crm.records.view_all" in self.permission_keys

    def can_view_team(self) -> bool:
        return not self.can_view_all() and (
            "crm.records.view_team" in self.permission_keys
            or self.has_role(CrmRole.SALES_MANAGER)
            or "crm.leads.assign" in self.permission_keys
        )

    def can_view_collection(self) -> bool:
        return (
            self.is_collection()
            or self.is_admin()
            or self.can_view_all()
            or self.can_view_team()
        )

    def can_send_payment_reminders(self) -> bool:
        return (
            self.can_view_collection()
            or "crm.reminders.whatsapp.send" in self.permission_keys
        )

    def actor_location_ids(self) -> List[str]:
        raw = getattr(self.user, "location_ids", None) or []
        return [str(x) for x in raw if str(x).strip()]

    def scoped_assigned_user_id(self) -> Optional[str]:
        """If set, list queries should filter to this single assignee (own scope)."""
        if not self.user:
            return None
        if self.can_view_all() or self.can_view_team():
            return None
        return self.user_id or None

    def team_user_ids_from_users(self, users: Iterable[Any]) -> Optional[List[str]]:
        """Build team assignee set via location_ids intersection.

        Returns ``None`` for view_all (no filter). Returns ``[self]`` when the
        actor has no locations (safe own-only fallback for view_team).
        """
        if self.can_view_all():
            return None
        if not self.can_view_team():
            return [self.user_id] if self.user_id else []
        actor_locs = set(self.actor_location_ids())
        if not actor_locs:
            return [self.user_id] if self.user_id else []
        ids: List[str] = []
        if self.user_id:
            ids.append(self.user_id)
        for user in users or []:
            uid = str(getattr(user, "id", "") or "")
            if not uid or uid in ids:
                continue
            their = {
                str(x)
                for x in (getattr(user, "location_ids", None) or [])
                if str(x).strip()
            }
            if their & actor_locs:
                ids.append(uid)
        return ids

    def can_access_assigned(
        self, assigned_user_id: str, *, team_user_ids: Optional[Iterable[str]] = None
    ) -> bool:
        if not self.user:
            return True
        if self.can_view_all():
            return True
        if self.can_view_team():
            if team_user_ids is None:
                return assigned_user_id == self.user_id or not assigned_user_id
            allowed = set(team_user_ids)
            return not assigned_user_id or assigned_user_id in allowed
        return assigned_user_id == self.user_id or not assigned_user_id

    @staticmethod
    def roles_from_values(values: Iterable[str | CrmRole]) -> List[CrmRole]:
        roles: List[CrmRole] = []
        for raw in values or []:
            if isinstance(raw, CrmRole):
                roles.append(raw)
                continue
            try:
                roles.append(CrmRole(str(raw)))
            except ValueError:
                continue
        return roles
