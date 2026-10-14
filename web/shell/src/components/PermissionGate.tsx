import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import {
  canPermission,
  moduleEnabled,
  useAppSelector,
  useCan,
  useMeQuery,
  useModuleEnabled,
} from '@vaybooks/store';

export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const can = useCan();
  if (!can(permission)) return <>{fallback}</>;
  return <>{children}</>;
}

export function RequireModule({
  module,
  children,
}: {
  module: string;
  children: ReactNode;
}) {
  const accessToken = useAppSelector((s) => s.session.accessToken);
  const enabledModules = useAppSelector((s) => s.session.enabledModules);
  const permissions = useAppSelector((s) => s.session.permissions);
  const me = useMeQuery(undefined, { skip: !accessToken });
  const moduleOk = useModuleEnabled();

  const mePending = Boolean(accessToken) && (me.isUninitialized || me.isLoading || me.isFetching);
  const meMods = Array.isArray(me.data?.user?.enabled_modules)
    ? (me.data!.user.enabled_modules as unknown[]).map(String)
    : null;
  const mods = enabledModules.length > 0 ? enabledModules : meMods || [];

  if (accessToken && mods.length === 0 && mePending) {
    return <p>Loading…</p>;
  }

  const allowed =
    mods.length > 0
      ? moduleEnabled(mods, permissions, module)
      : moduleOk(module);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const accessToken = useAppSelector((s) => s.session.accessToken);
  const sessionPerms = useAppSelector((s) => s.session.permissions);
  const me = useMeQuery(undefined, { skip: !accessToken });
  const can = useCan();

  const mePerms = Array.isArray(me.data?.user?.permissions)
    ? (me.data!.user.permissions as unknown[]).map(String)
    : null;
  const effectivePerms = sessionPerms.length > 0 ? sessionPerms : mePerms || [];

  const mePending = Boolean(accessToken) && (me.isUninitialized || me.isLoading || me.isFetching);

  if (accessToken && effectivePerms.length === 0 && mePending) {
    return <p>Loading permissions…</p>;
  }

  const allowed =
    effectivePerms.length > 0
      ? canPermission(effectivePerms, permission)
      : can(permission);

  if (!allowed) return <Navigate to="/" replace />;
  return <>{children}</>;
}
