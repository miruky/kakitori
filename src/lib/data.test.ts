import { describe, expect, it } from 'vitest';
import { kanjiData } from './data/strokes';
import { readings } from './data/readings';
import { pathToPolyline, polylineLength } from './path';

describe('筆順データ', () => {
  it('小学1年配当の80字を収録している', () => {
    expect(kanjiData).toHaveLength(80);
    expect(new Set(kanjiData.map((k) => k.char)).size).toBe(80);
  });

  it('全ストロークが折れ線に展開でき、長さを持つ', () => {
    for (const k of kanjiData) {
      expect(k.strokes.length).toBeGreaterThan(0);
      for (const d of k.strokes) {
        const pts = pathToPolyline(d);
        expect(pts.length).toBeGreaterThan(1);
        expect(polylineLength(pts)).toBeGreaterThan(0);
      }
    }
  });

  it('代表的な字の画数が正しい', () => {
    const count = (ch: string): number =>
      kanjiData.find((k) => k.char === ch)?.strokes.length ?? -1;
    expect(count('一')).toBe(1);
    expect(count('二')).toBe(2);
    expect(count('川')).toBe(3);
    expect(count('五')).toBe(4);
    expect(count('六')).toBe(4);
    expect(count('森')).toBe(12);
  });
});

describe('読みデータ', () => {
  it('筆順データと同じ80字をちょうど収録している', () => {
    const strokeChars = new Set(kanjiData.map((k) => k.char));
    expect(readings).toHaveLength(80);
    for (const r of readings) {
      expect(strokeChars.has(r.char)).toBe(true);
    }
  });

  it('用例はかな書きで、答えの漢字を含まない', () => {
    for (const r of readings) {
      expect(r.usage).not.toContain(r.char);
      expect(r.usage).toMatch(/^[ぁ-ゖァ-ヶー 、。ノ]+$/u);
      expect(r.readings.length).toBeGreaterThan(0);
    }
  });
});
