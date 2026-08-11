import { useCallback } from 'react';
import { useAppSelector } from './hooks';

/** True if session grants the concrete permission key (login returns expanded keys). */
export function canPermission(permissions: string[] | undefined | null, key: string): boolean {
  const k = (key || '').trim();
  if (!k) return true;
  const perms = permissions || [];
  if (perms.includes('*')) return true;
  return perms.includes(k);
}

/** Module id enabled for the org (authoritative when enabledModules is non-empty). */
export function moduleEnabled(
  enabledModules: string[] | undefined | null,
  permissions: string[] | undefined | null,
  moduleId: string | undefined | null,
): boolean {
  const mod = (moduleId || '').trim();
  if (!mod) return true;
  const modules = enabledModules || [];
  if (modules.length > 0) {
    return modules.includes(mod);
  }
  const perms = permissions || [];
  if (perms.includes(`module.${mod}`)) return true;
  // No entitlement data yet — fail open only for always-on shell modules
  return mod === 'core' || mod === 'settings' || mod === 'parties';
}

export function useCan() {
  const permissions = useAppSelector((s) => s.session.permissions);
  return useCallback((key: string) => canPermission(permissions, key), [permissions]);
}

export function useModuleEnabled() {
  const enabledModules = useAppSelector((s) => s.session.enabledModules);
  const permissions = useAppSelector((s) => s.session.permissions);
  return useCallback(
    (moduleId: string | undefined) => moduleEnabled(enabledModules, permissions, moduleId),
    [enabledModules, permissions],
  );
}

export function usePermissions() {
  return useAppSelector((s) => s.session.permissions);
}

export function useEnabledModules() {
  return useAppSelector((s) => s.session.enabledModules);
}
