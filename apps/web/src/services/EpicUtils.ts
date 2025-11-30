export function isEpicSandbox(epicId?: string): boolean {
  if (!epicId) return false;
  return epicId === 'sandbox_epic' || epicId === 'sandbox_epic_r4';
}
