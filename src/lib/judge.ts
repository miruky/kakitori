import type { Point } from './path';
import { pathToPolyline, polylineLength, resample } from './path';

export interface StrokeVerdict {
  ok: boolean;
  /** 対応点どうしの平均距離(viewBox座標) */
  avgDistance: number;
  startDistance: number;
  endDistance: number;
  lengthRatio: number;
  /** 不合格の主因。UIのヒント表示に使う */
  reason?: 'start' | 'end' | 'shape' | 'length' | 'too-short';
}

const SAMPLES = 32;

// しきい値はviewBox(109)に対する値。子どもの手書きを想定してやや緩めに取り、
// 逆順(書き始めと終わりが逆)は対応点の距離が大きく出るので自然に弾かれる
const MAX_AVG = 13;
const MAX_ENDPOINT = 20;
const MIN_LENGTH_RATIO = 0.45;
const MAX_LENGTH_RATIO = 2.2;
const MIN_DRAWN_LENGTH = 4;

export function judgeStroke(drawn: readonly Point[], expectedPathD: string): StrokeVerdict {
  const expected = pathToPolyline(expectedPathD);
  return judgePolyline(drawn, expected);
}

export function judgePolyline(drawn: readonly Point[], expected: readonly Point[]): StrokeVerdict {
  const fail = (reason: StrokeVerdict['reason']): StrokeVerdict => ({
    ok: false,
    avgDistance: Number.POSITIVE_INFINITY,
    startDistance: Number.POSITIVE_INFINITY,
    endDistance: Number.POSITIVE_INFINITY,
    lengthRatio: 0,
    reason,
  });

  if (drawn.length < 2) return fail('too-short');
  const drawnLength = polylineLength(drawn);
  if (drawnLength < MIN_DRAWN_LENGTH) return fail('too-short');

  const a = resample(drawn, SAMPLES);
  const b = resample(expected, SAMPLES);
  const first = { a: a[0], b: b[0] };
  const last = { a: a[SAMPLES - 1], b: b[SAMPLES - 1] };
  if (!first.a || !first.b || !last.a || !last.b) return fail('shape');

  const startDistance = Math.hypot(first.a.x - first.b.x, first.a.y - first.b.y);
  const endDistance = Math.hypot(last.a.x - last.b.x, last.a.y - last.b.y);

  let sum = 0;
  for (let i = 0; i < SAMPLES; i++) {
    const p = a[i];
    const q = b[i];
    if (p && q) sum += Math.hypot(p.x - q.x, p.y - q.y);
  }
  const avgDistance = sum / SAMPLES;
  const expectedLength = polylineLength(expected);
  const lengthRatio = expectedLength === 0 ? 0 : drawnLength / expectedLength;

  let reason: StrokeVerdict['reason'];
  if (startDistance > MAX_ENDPOINT) reason = 'start';
  else if (endDistance > MAX_ENDPOINT) reason = 'end';
  else if (lengthRatio < MIN_LENGTH_RATIO || lengthRatio > MAX_LENGTH_RATIO) reason = 'length';
  else if (avgDistance > MAX_AVG) reason = 'shape';

  return {
    ok: reason === undefined,
    avgDistance,
    startDistance,
    endDistance,
    lengthRatio,
    ...(reason !== undefined ? { reason } : {}),
  };
}

export const judgeReasonLabels: Record<NonNullable<StrokeVerdict['reason']>, string> = {
  start: '書き始めの位置が違う',
  end: '書き終わりの位置が違う',
  shape: '線の形が手本と離れている',
  length: '線の長さが手本と合わない',
  'too-short': '線が短すぎる',
};
