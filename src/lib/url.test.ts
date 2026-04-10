import { describe, expect, it } from 'vitest';
import { formatHash, isRouteMode, parseHash } from './url';

describe('parseHash', () => {
  it('モードだけのハッシュを読む', () => {
    expect(parseHash('#trace')).toEqual({ mode: 'trace', char: null });
    expect(parseHash('blind')).toEqual({ mode: 'blind', char: null });
  });

  it('字つきのハッシュを読む', () => {
    expect(parseHash('#blind/' + encodeURIComponent('学'))).toEqual({ mode: 'blind', char: '学' });
  });

  it('字は先頭の1文字だけ取る', () => {
    expect(parseHash('#trace/' + encodeURIComponent('学校'))).toEqual({
      mode: 'trace',
      char: '学',
    });
  });

  it('空・未知のモード・壊れたエスケープは適切に処理する', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#walk')).toBeNull();
    expect(parseHash('#trace/%E0%A4%A')).toEqual({ mode: 'trace', char: null });
  });
});

describe('formatHash', () => {
  it('字がなければモードだけ', () => {
    expect(formatHash('trace', null)).toBe('#trace');
  });

  it('字つきはエスケープして載せる', () => {
    expect(formatHash('blind', '学')).toBe('#blind/' + encodeURIComponent('学'));
  });

  it('parseHashと往復できる', () => {
    for (const h of ['#trace', '#blind', '#blind/' + encodeURIComponent('雨')]) {
      const route = parseHash(h);
      expect(route).not.toBeNull();
      expect(formatHash(route!.mode, route!.char)).toBe(h);
    }
  });
});

describe('isRouteMode', () => {
  it('規定のモードだけを受け入れる', () => {
    expect(isRouteMode('trace')).toBe(true);
    expect(isRouteMode('blind')).toBe(true);
    expect(isRouteMode('nope')).toBe(false);
  });
});
