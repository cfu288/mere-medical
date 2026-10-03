export function crawlDelaySeconds(robotsTxt: string): number {
  let agents: string[] = [];
  let inRules = false;
  for (const raw of robotsTxt.split('\n')) {
    const line = raw.replace(/#.*/, '').trim();
    const colon = line.indexOf(':');
    if (colon === -1) {
      continue;
    }
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line.slice(colon + 1).trim();
    if (key === 'user-agent') {
      agents = inRules ? [value] : [...agents, value];
      inRules = false;
    } else {
      inRules = true;
      if (key === 'crawl-delay' && agents.includes('*')) {
        const seconds = Number(value);
        return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
      }
    }
  }
  return 0;
}
