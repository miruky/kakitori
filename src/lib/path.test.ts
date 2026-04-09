import { describe, expect, it } from 'vitest';
import { pathToPolyline, polylineLength, resample } from './path';

describe('pathToPolyline', () => {
  it('直線コマンドを座標列に展開する', () => {
    const pts = pathToPolyline('M0,0 L10,0 L10,10');
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[pts.length - 1]).toEqual({ x: 10, y: 10 });
    expect(polylineLength(pts)).toBeCloseTo(20);
  });

  it('三次ベジェの端点が正確に一致する', () => {
    const pts = pathToPolyline('M0,0 C0,10 10,10 10,0');
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    const last = pts[pts.length - 1];
    expect(last?.x).toBeCloseTo(10);
    expect(last?.y).toBeCloseTo(0);
  });

  it('相対コマンドと滑らかな続き(s)を解釈する', () => {
    // KanjiVGに典型的な形: 絶対Mのあと相対cとsが続く
    const pts = pathToPolyline('M32.25,21.5c0.75,1.25,1,2.5,1,4.5s-0.25,6-1,8');
    expect(pts[0]?.x).toBeCloseTo(32.25);
    const last = pts[pts.length - 1];
    expect(last?.x).toBeCloseTo(32.25);
    expect(last?.y).toBeCloseTo(34);
  });

  it('H・V・Zも扱える', () => {
    const pts = pathToPolyline('M0,0 H10 V10 Z');
    const last = pts[pts.length - 1];
    expect(last).toEqual({ x: 0, y: 0 });
    expect(polylineLength(pts)).toBeCloseTo(10 + 10 + Math.hypot(10, 10));
  });
});

describe('resample', () => {
  it('指定した点数に弧長等間隔で取り直す', () => {
    const pts = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
      5,
    );
    expect(pts).toHaveLength(5);
    expect(pts.map((p) => p.x)).toEqual([0, 2.5, 5, 7.5, 10]);
  });

  it('折れ線の角をまたいでも総数と端点を保つ', () => {
    const pts = resample(
      [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ],
      9,
    );
    expect(pts).toHaveLength(9);
    expect(pts[0]).toEqual({ x: 0, y: 0 });
    expect(pts[8]?.x).toBeCloseTo(10);
    expect(pts[8]?.y).toBeCloseTo(10);
  });

  it('空配列・単一点でも壊れない', () => {
    expect(resample([], 4)).toEqual([]);
    const single = resample([{ x: 3, y: 4 }], 3);
    expect(single).toHaveLength(3);
    expect(single[2]).toEqual({ x: 3, y: 4 });
  });
});
