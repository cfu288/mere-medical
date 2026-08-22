/**
 * The endpoint classes the API proxy can resolve for each vendor it serves.
 *
 * `base`, `authorize`, and `token` are published on every catalog entry;
 * `register` is derived, and only Epic defines a derivation for it.
 */
export const PROXY_TARGET_TYPES_BY_VENDOR = {
  epic: ['base', 'authorize', 'token', 'register'],
  healow: ['base', 'authorize', 'token'],
} as const;

export type ProxyVendor = keyof typeof PROXY_TARGET_TYPES_BY_VENDOR;

export type ProxyTargetTypeOf<V extends ProxyVendor> =
  (typeof PROXY_TARGET_TYPES_BY_VENDOR)[V][number];

export type ProxyTarget = {
  [V in ProxyVendor]: { vendor: V; targetType: ProxyTargetTypeOf<V> };
}[ProxyVendor];

/**
 * Normalizes a raw `target_type` query value into the vendor's vocabulary.
 *
 * A value the vendor does not serve resolves to `base`, the same fallback the
 * proxy has always applied to unknown target types.
 */
export function parseProxyTarget(
  vendor: ProxyVendor,
  rawTargetType: string | undefined,
): ProxyTarget {
  const allowed: readonly string[] = PROXY_TARGET_TYPES_BY_VENDOR[vendor];
  const targetType =
    rawTargetType !== undefined && allowed.includes(rawTargetType)
      ? rawTargetType
      : 'base';
  return { vendor, targetType } as ProxyTarget;
}
