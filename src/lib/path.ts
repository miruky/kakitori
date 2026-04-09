export interface Point {
  x: number;
  y: number;
}

interface Cursor {
  x: number;
  y: number;
  startX: number;
  startY: number;
  prevCtrlX: number | null;
  prevCtrlY: number | null;
}

const CURVE_STEPS = 16;

function cubicAt(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const u = 1 - t;
  return u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
}

function quadAt(p0: number, p1: number, p2: number, t: number): number {
  const u = 1 - t;
  return u * u * p0 + 2 * u * t * p1 + t * t * p2;
}

function tokenize(d: string): (string | number)[] {
  const out: (string | number)[] = [];
  const re = /([MmLlHhVvCcSsQqTtZz])|(-?\d*\.?\d+(?:e[-+]?\d+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(d)) !== null) {
    if (m[1] !== undefined) out.push(m[1]);
    else out.push(Number(m[2]));
  }
  return out;
}

/**
 * SVGパスのd属性を折れ線に展開する。KanjiVGが使うM/C/S系を中心に、
 * L/H/V/Q/T/Zも解釈する。曲線は固定ステップで分割する。
 */
export function pathToPolyline(d: string): Point[] {
  const tokens = tokenize(d);
  const pts: Point[] = [];
  const cur: Cursor = { x: 0, y: 0, startX: 0, startY: 0, prevCtrlX: null, prevCtrlY: null };
  let i = 0;
  let cmd = '';

  const num = (): number => {
    const t = tokens[i];
    i += 1;
    return typeof t === 'number' ? t : 0;
  };

  const push = (x: number, y: number): void => {
    const last = pts[pts.length - 1];
    if (!last || last.x !== x || last.y !== y) pts.push({ x, y });
    cur.x = x;
    cur.y = y;
  };

  const cubicTo = (
    c1x: number,
    c1y: number,
    c2x: number,
    c2y: number,
    x: number,
    y: number,
  ): void => {
    const fromX = cur.x;
    const fromY = cur.y;
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      push(cubicAt(fromX, c1x, c2x, x, t), cubicAt(fromY, c1y, c2y, y, t));
    }
    cur.prevCtrlX = c2x;
    cur.prevCtrlY = c2y;
  };

  const quadTo = (cx: number, cy: number, x: number, y: number): void => {
    const fromX = cur.x;
    const fromY = cur.y;
    for (let s = 1; s <= CURVE_STEPS; s++) {
      const t = s / CURVE_STEPS;
      push(quadAt(fromX, cx, x, t), quadAt(fromY, cy, y, t));
    }
    cur.prevCtrlX = cx;
    cur.prevCtrlY = cy;
  };

  while (i < tokens.length) {
    const t = tokens[i];
    if (typeof t === 'string') {
      cmd = t;
      i += 1;
    }
    const rel = cmd === cmd.toLowerCase() && cmd !== 'Z' && cmd !== 'z';
    const base = rel ? { x: cur.x, y: cur.y } : { x: 0, y: 0 };

    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = base.x + num();
        const y = base.y + num();
        push(x, y);
        cur.startX = x;
        cur.startY = y;
        cur.prevCtrlX = null;
        cur.prevCtrlY = null;
        // 後続の座標は暗黙のL/l
        cmd = rel ? 'l' : 'L';
        break;
      }
      case 'L': {
        push(base.x + num(), base.y + num());
        cur.prevCtrlX = null;
        cur.prevCtrlY = null;
        break;
      }
      case 'H': {
        push(base.x + num(), cur.y);
        cur.prevCtrlX = null;
        cur.prevCtrlY = null;
        break;
      }
      case 'V': {
        push(cur.x, base.y + num());
        cur.prevCtrlX = null;
        cur.prevCtrlY = null;
        break;
      }
      case 'C': {
        cubicTo(
          base.x + num(),
          base.y + num(),
          base.x + num(),
          base.y + num(),
          base.x + num(),
          base.y + num(),
        );
        break;
      }
      case 'S': {
        const c1x = cur.prevCtrlX !== null ? 2 * cur.x - cur.prevCtrlX : cur.x;
        const c1y = cur.prevCtrlY !== null ? 2 * cur.y - cur.prevCtrlY : cur.y;
        cubicTo(c1x, c1y, base.x + num(), base.y + num(), base.x + num(), base.y + num());
        break;
      }
      case 'Q': {
        quadTo(base.x + num(), base.y + num(), base.x + num(), base.y + num());
        break;
      }
      case 'T': {
        const cx = cur.prevCtrlX !== null ? 2 * cur.x - cur.prevCtrlX : cur.x;
        const cy = cur.prevCtrlY !== null ? 2 * cur.y - cur.prevCtrlY : cur.y;
        quadTo(cx, cy, base.x + num(), base.y + num());
        break;
      }
      case 'Z': {
        push(cur.startX, cur.startY);
        break;
      }
      default: {
        i += 1;
        break;
      }
    }
  }
  return pts;
}

export function polylineLength(pts: readonly Point[]): number {
  let len = 0;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    if (a && b) len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

/** 折れ線を弧長で等間隔のn点に取り直す。形の比較の前処理 */
export function resample(pts: readonly Point[], n: number): Point[] {
  if (pts.length === 0 || n <= 0) return [];
  const first = pts[0];
  if (!first) return [];
  if (pts.length === 1) return Array.from({ length: n }, () => ({ ...first }));

  const total = polylineLength(pts);
  if (total === 0) return Array.from({ length: n }, () => ({ ...first }));

  const out: Point[] = [{ ...first }];
  const step = total / (n - 1);
  let acc = 0;
  let k = 1;
  let prev = first;
  while (out.length < n && k < pts.length) {
    const next = pts[k];
    if (!next) break;
    const seg = Math.hypot(next.x - prev.x, next.y - prev.y);
    if (acc + seg >= step && seg > 0) {
      const t = (step - acc) / seg;
      const nx = prev.x + (next.x - prev.x) * t;
      const ny = prev.y + (next.y - prev.y) * t;
      out.push({ x: nx, y: ny });
      prev = { x: nx, y: ny };
      acc = 0;
    } else {
      acc += seg;
      prev = next;
      k += 1;
    }
  }
  const last = pts[pts.length - 1];
  while (out.length < n && last) out.push({ ...last });
  return out;
}
