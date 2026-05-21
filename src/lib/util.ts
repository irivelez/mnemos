export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isRecent(dateStr: string | null | undefined, maxAgeDays: number): boolean {
  if (!dateStr) return false;
  const t = new Date(dateStr).getTime();
  if (Number.isNaN(t)) return false;
  return t >= Date.now() - maxAgeDays * 86_400_000;
}

export function formatAge(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const ms = Date.now() - new Date(dateStr).getTime();
  if (Number.isNaN(ms) || ms < 0) return '0h';
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${Math.max(1, hours)}h`;
  return `${Math.floor(hours / 24)}d`;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
