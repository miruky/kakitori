// 現在のモードと練習中の字をURLハッシュに載せ、共有・ブックマークできるようにする。
// 例: #trace 、 #blind 、 #blind/学
export type RouteMode = 'trace' | 'blind';

const MODES: readonly RouteMode[] = ['trace', 'blind'];

export function isRouteMode(value: string): value is RouteMode {
  return (MODES as readonly string[]).includes(value);
}

export interface Route {
  mode: RouteMode;
  /** 1文字。実在する字かどうかは呼び出し側が確かめる。 */
  char: string | null;
}

/** location.hash を解釈する。未知のモードは null を返す。 */
export function parseHash(hash: string): Route | null {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;
  const slash = raw.indexOf('/');
  const modePart = slash === -1 ? raw : raw.slice(0, slash);
  let mode: string;
  try {
    mode = decodeURIComponent(modePart);
  } catch {
    return null;
  }
  if (!isRouteMode(mode)) return null;
  let char: string | null = null;
  if (slash !== -1) {
    try {
      const decoded = decodeURIComponent(raw.slice(slash + 1));
      char = decoded === '' ? null : ([...decoded][0] ?? null);
    } catch {
      char = null;
    }
  }
  return { mode, char };
}

/** 現在のモードと字をハッシュ文字列にする。 */
export function formatHash(mode: RouteMode, char: string | null): string {
  return char ? `#${mode}/${encodeURIComponent(char)}` : `#${mode}`;
}
