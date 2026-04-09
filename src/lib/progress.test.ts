import { describe, expect, it } from 'vitest';
import { emptyMastery, isPassed, markPassed, passedCount, restoreMastery } from './progress';

describe('mastery', () => {
  it('モードごとに合格を記録する', () => {
    let m = emptyMastery();
    m = markPassed(m, '山', 'trace');
    expect(isPassed(m, '山', 'trace')).toBe(true);
    expect(isPassed(m, '山', 'blind')).toBe(false);
    m = markPassed(m, '山', 'blind');
    expect(isPassed(m, '山', 'blind')).toBe(true);
  });

  it('合格数をモード別に数える', () => {
    let m = emptyMastery();
    m = markPassed(m, '山', 'trace');
    m = markPassed(m, '川', 'trace');
    m = markPassed(m, '川', 'blind');
    expect(passedCount(m, 'trace')).toBe(2);
    expect(passedCount(m, 'blind')).toBe(1);
  });

  it('元のオブジェクトを書き換えない', () => {
    const before = emptyMastery();
    markPassed(before, '山', 'trace');
    expect(passedCount(before, 'trace')).toBe(0);
  });

  it('保存値の往復と、壊れた値の安全な復元', () => {
    let m = emptyMastery();
    m = markPassed(m, '森', 'blind');
    expect(restoreMastery(JSON.stringify(m))).toEqual(m);
    expect(restoreMastery(null)).toEqual(emptyMastery());
    expect(restoreMastery('{bad')).toEqual(emptyMastery());
    expect(restoreMastery('{"version":9}')).toEqual(emptyMastery());
  });
});
