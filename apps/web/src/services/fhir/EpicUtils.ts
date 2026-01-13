export const EPIC_SANDBOX_IDS = ['sandbox_epic', 'sandbox_epic_r4'] as const;

export function isEpicSandbox(epicId?: string): boolean {
  if (!epicId) return false;
  return EPIC_SANDBOX_IDS.includes(epicId as (typeof EPIC_SANDBOX_IDS)[number]);
}
