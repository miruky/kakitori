import { describe, expect, it } from 'vitest';
import { kanjiData } from './data/strokes';
import { judgeStroke } from './judge';
import { pathToPolyline } from './path';
import type { Point } from './path';

const strokeOf = (char: string, index: number): string => {
  const k = kanjiData.find((e) => e.char === char);
  const d = k?.strokes[index];
  if (d === undefined) throw new Error(`${char} の ${index} 画目がない`);
  return d;
};

const jitter = (pts: Point[], dx: number, dy: number): Point[] =>
  pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));

describe('judgeStroke', () => {
  it('手本どおりの線は合格する', () => {
    const d = strokeOf('一', 0);
    const drawn = pathToPolyline(d);
    const v = judgeStroke(drawn, d);
    expect(v.ok).toBe(true);
    expect(v.avgDistance).toBeLessThan(1);
  });

  it('少しずれた線も許容する', () => {
    const d = strokeOf('一', 0);
    const drawn = jitter(pathToPolyline(d), 5, -4);
    expect(judgeStroke(drawn, d).ok).toBe(true);
  });

  it('逆向きに書いた線は弾く', () => {
    const d = strokeOf('一', 0);
    const drawn = [...pathToPolyline(d)].reverse();
    const v = judgeStroke(drawn, d);
    expect(v.ok).toBe(false);
  });

  it('別の画を書いたら弾く(縦棒と横棒)', () => {
    // 「十」は1画目が横、2画目が縦
    const yoko = strokeOf('十', 0);
    const tate = strokeOf('十', 1);
    const v = judgeStroke(pathToPolyline(tate), yoko);
    expect(v.ok).toBe(false);
  });

  it('短すぎる入力は too-short で弾く', () => {
    const d = strokeOf('一', 0);
    const v = judgeStroke([{ x: 10, y: 10 }], d);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe('too-short');
  });

  it('全80字・全画で「手本どおり」が合格する', () => {
    for (const k of kanjiData) {
      k.strokes.forEach((d, i) => {
        const v = judgeStroke(pathToPolyline(d), d);
        if (!v.ok) {
          throw new Error(`${k.char} の ${i + 1} 画目が自己一致で不合格: ${v.reason ?? ''}`);
        }
      });
    }
  });
});
