/** 字ごとの習熟。なぞりで合格するとtraced、暗書きで合格するとblindが立つ */
export interface Mastery {
  version: 1;
  chars: Record<string, { traced?: boolean; blind?: boolean }>;
}

export type Mode = 'trace' | 'blind';

export function emptyMastery(): Mastery {
  return { version: 1, chars: {} };
}

export function markPassed(m: Mastery, char: string, mode: Mode): Mastery {
  const entry = { ...m.chars[char] };
  if (mode === 'trace') entry.traced = true;
  else entry.blind = true;
  return { version: 1, chars: { ...m.chars, [char]: entry } };
}

export function isPassed(m: Mastery, char: string, mode: Mode): boolean {
  const entry = m.chars[char];
  return mode === 'trace' ? entry?.traced === true : entry?.blind === true;
}

export function passedCount(m: Mastery, mode: Mode): number {
  return Object.values(m.chars).filter((e) => (mode === 'trace' ? e.traced : e.blind)).length;
}

export function restoreMastery(raw: string | null): Mastery {
  if (raw === null) return emptyMastery();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as { version?: unknown }).version === 1 &&
      typeof (parsed as { chars?: unknown }).chars === 'object'
    ) {
      return parsed as Mastery;
    }
  } catch {
    // 壊れた保存値は捨てる
  }
  return emptyMastery();
}
