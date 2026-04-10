import './style.css';
import {
  KANJIVG_VIEWBOX,
  emptyMastery,
  formatHash,
  isPassed,
  judgePolyline,
  judgeReasonLabels,
  kanjiData,
  markPassed,
  parseHash,
  passedCount,
  pathToPolyline,
  readings,
  restoreMastery,
  thresholdsFor,
} from './lib';
import type { Difficulty, Mastery, Mode, Point } from './lib';

const STORE_KEY = 'kakitori:mastery';
const DIFF_KEY = 'kakitori:difficulty';
const SVG_NS = 'http://www.w3.org/2000/svg';
const VB = KANJIVG_VIEWBOX;
/** この回数までのミスなら合格として記録する */
const PASS_MISS_LIMIT = 2;

const LOGO_SVG = `<svg viewBox="0 0 64 64" role="img" aria-label="kakitoriのロゴ" class="logo">
  <g fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
    <rect x="8" y="8" width="48" height="48" rx="7"/>
    <path d="M32 12v8" opacity="0.45"/><path d="M32 44v8" opacity="0.45"/>
    <path d="M12 32h8" opacity="0.45"/><path d="M44 32h8" opacity="0.45"/>
  </g>
  <path d="M22 24c6 2 14 8 20 18" fill="none" stroke="var(--accent)" stroke-width="5" stroke-linecap="round"/>
</svg>`;

function mustFind<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`${selector} が見つからない`);
  return el;
}

const app = mustFind<HTMLDivElement>('#app');

app.innerHTML = `
  <header class="site-header">
    <div class="brand">
      ${LOGO_SVG}
      <div>
        <h1>kakitori</h1>
        <p class="tagline">小学1年の80字を、筆順つきストローク判定で書き取り練習する</p>
      </div>
    </div>
    <a class="repo-link" href="https://github.com/miruky/kakitori" rel="noopener">GitHub</a>
  </header>
  <main class="layout">
    <section class="pane practice-pane" aria-label="練習">
      <div class="toolbar">
        <div class="tabs" id="mode-tabs" role="tablist" aria-label="モード"></div>
        <span class="spacer"></span>
        <div class="difficulty" id="difficulty" role="group" aria-label="判定のきびしさ"></div>
      </div>
      <div class="prompt" id="prompt" aria-live="polite"></div>
      <div class="board-wrap">
        <svg id="board" viewBox="0 0 ${VB} ${VB}" role="application"
          aria-label="ここに指やマウスで書く"></svg>
      </div>
      <div class="controls">
        <button type="button" id="btn-replay">手本を再生</button>
        <button type="button" id="btn-hint">ヒント</button>
        <button type="button" id="btn-reset">書き直す</button>
        <span class="spacer"></span>
        <button type="button" id="btn-next" class="primary">次の字</button>
      </div>
      <div class="statusbar" id="status" aria-live="polite"></div>
    </section>
    <aside class="pane chars-pane" aria-label="字の一覧">
      <div class="toolbar">
        <span class="grid-title">小学1年の漢字</span>
        <span class="spacer"></span>
        <button type="button" class="link-btn" id="btn-reset-progress">記録を消す</button>
        <span class="grid-count" id="grid-count"></span>
      </div>
      <div class="char-grid" id="char-grid"></div>
    </aside>
  </main>
  <footer class="site-footer">
    <p>筆順データはKanjiVG(CC BY-SA 3.0)に基づく。進み具合はこのブラウザにだけ保存される。MIT License</p>
  </footer>
`;

const board = mustFind<SVGSVGElement>('#board');
const promptBox = mustFind<HTMLDivElement>('#prompt');
const statusBar = mustFind<HTMLDivElement>('#status');
const modeTabs = mustFind<HTMLDivElement>('#mode-tabs');
const difficultyBar = mustFind<HTMLDivElement>('#difficulty');
const charGrid = mustFind<HTMLDivElement>('#char-grid');
const gridCount = mustFind<HTMLSpanElement>('#grid-count');
const btnReplay = mustFind<HTMLButtonElement>('#btn-replay');
const btnHint = mustFind<HTMLButtonElement>('#btn-hint');
const btnReset = mustFind<HTMLButtonElement>('#btn-reset');
const btnNext = mustFind<HTMLButtonElement>('#btn-next');
const btnResetProgress = mustFind<HTMLButtonElement>('#btn-reset-progress');

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: 'easy', label: 'やさしい' },
  { key: 'normal', label: 'ふつう' },
  { key: 'strict', label: 'きびしい' },
];

function loadDifficulty(): Difficulty {
  try {
    const v = localStorage.getItem(DIFF_KEY);
    if (v === 'easy' || v === 'normal' || v === 'strict') return v;
  } catch {
    // 取れなければ「ふつう」
  }
  return 'normal';
}

let mastery: Mastery;
try {
  mastery = restoreMastery(localStorage.getItem(STORE_KEY));
} catch {
  mastery = restoreMastery(null);
}
let difficulty: Difficulty = loadDifficulty();
let mode: Mode = 'trace';
let charIndex = 0;
let strokeIndex = 0;
let missCount = 0;
let drawing = false;
let replaying = false;
let trail: Point[] = [];
let message = '';

const expectedPolylines = new Map<string, Point[][]>();
function polylinesOf(char: string): Point[][] {
  let cached = expectedPolylines.get(char);
  if (!cached) {
    const k = kanjiData[charIndex];
    const entry = kanjiData.find((e) => e.char === char) ?? k;
    cached = (entry?.strokes ?? []).map(pathToPolyline);
    expectedPolylines.set(char, cached);
  }
  return cached;
}

function current() {
  const k = kanjiData[charIndex];
  if (!k) throw new Error('字のデータがない');
  return k;
}

function persist(): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(mastery));
  } catch {
    // 保存できなくても練習は続ける
  }
}

function persistDifficulty(): void {
  try {
    localStorage.setItem(DIFF_KEY, difficulty);
  } catch {
    // 保存できなくてもきびしさは反映する
  }
}

function prefersReduced(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function syncHash(): void {
  const target = formatHash(mode, current().char);
  if (location.hash !== target) history.replaceState(null, '', target);
}

function el(name: string, attrs: Record<string, string>): SVGElement {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

// 升目の下敷きになる十字ガイド
function appendGuide(): void {
  const guide = el('g', { class: 'grid-lines' });
  guide.append(
    el('line', { x1: String(VB / 2), y1: '4', x2: String(VB / 2), y2: String(VB - 4) }),
    el('line', { x1: '4', y1: String(VB / 2), x2: String(VB - 4), y2: String(VB / 2) }),
  );
  board.append(guide);
}

function trailD(points: readonly Point[]): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (!first) return '';
  return (
    `M${first.x.toFixed(1)},${first.y.toFixed(1)}` +
    points
      .slice(1)
      .map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join('')
  );
}

function renderBoard(opts: { hint?: boolean; wrongTrail?: Point[] } = {}): void {
  const k = current();
  board.textContent = '';
  appendGuide();

  // なぞりモードは手本全体を薄く敷く
  if (mode === 'trace') {
    const ghost = el('g', { class: 'ghost' });
    for (const d of k.strokes) ghost.append(el('path', { d }));
    board.append(ghost);
  }

  // 書き終えた画
  const done = el('g', { class: 'ink' });
  k.strokes.slice(0, strokeIndex).forEach((d) => done.append(el('path', { d })));
  board.append(done);

  // 次の画の書き始め(なぞりモードのみ)
  const next = k.strokes[strokeIndex];
  if (next !== undefined && mode === 'trace') {
    const start = polylinesOf(k.char)[strokeIndex]?.[0];
    if (start) {
      board.append(
        el('circle', { class: 'start-dot', cx: String(start.x), cy: String(start.y), r: '4' }),
      );
    }
  }

  // ヒント: 次の画が自分で描かれるアニメーション
  if (opts.hint && next !== undefined) {
    const hint = el('path', { class: 'hint-stroke', d: next });
    board.append(hint);
    const len = Math.ceil(polylineLengthOf(k.char, strokeIndex));
    hint.setAttribute('stroke-dasharray', String(len));
    hint.setAttribute('stroke-dashoffset', String(len));
    hint.getBoundingClientRect();
    hint.classList.add('animate');
  }

  // 不合格だった線を一瞬見せる
  if (opts.wrongTrail && opts.wrongTrail.length > 1) {
    board.append(el('path', { class: 'wrong-trail', d: trailD(opts.wrongTrail) }));
  }
}

function polylineLengthOf(char: string, index: number): number {
  const pts = polylinesOf(char)[index] ?? [];
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (a && b) len += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return len;
}

function renderPrompt(): void {
  const k = current();
  const r = readings.find((x) => x.char === k.char);
  promptBox.textContent = '';
  if (mode === 'trace') {
    const big = document.createElement('span');
    big.className = 'prompt-char';
    big.textContent = k.char;
    const sub = document.createElement('span');
    sub.className = 'prompt-sub';
    sub.textContent = `${r?.readings ?? ''}(${k.strokes.length}画)。手本をなぞって筆順を覚える`;
    promptBox.append(big, sub);
  } else {
    const q = document.createElement('span');
    q.className = 'prompt-question';
    q.textContent = `「${r?.usage ?? ''}」`;
    const sub = document.createElement('span');
    sub.className = 'prompt-sub';
    sub.textContent = `よみ: ${r?.readings ?? ''}。この字を手本なしで書く(${k.strokes.length}画)`;
    promptBox.append(q, sub);
  }
}

function renderStatus(): void {
  const k = current();
  const done = strokeIndex >= k.strokes.length;
  statusBar.innerHTML = [
    `<span>${strokeIndex}/${k.strokes.length}画</span>`,
    `<span>ミス ${missCount}</span>`,
    `<span class="msg${done ? ' ok' : ''}">${message}</span>`,
  ].join('');
}

function renderTabs(): void {
  modeTabs.textContent = '';
  const defs: { key: Mode; label: string }[] = [
    { key: 'trace', label: 'なぞり練習' },
    { key: 'blind', label: '暗書きテスト' },
  ];
  for (const d of defs) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `tab${mode === d.key ? ' active' : ''}`;
    btn.setAttribute('aria-pressed', String(mode === d.key));
    btn.textContent = d.label;
    btn.addEventListener('click', () => {
      mode = d.key;
      resetChar();
      renderTabs();
      renderGrid();
    });
    modeTabs.append(btn);
  }
}

function renderDifficulty(): void {
  difficultyBar.textContent = '';
  const lead = document.createElement('span');
  lead.className = 'diff-lead kicker';
  lead.textContent = 'きびしさ';
  difficultyBar.append(lead);
  for (const d of DIFFICULTIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'diff-chip';
    btn.setAttribute('aria-pressed', String(difficulty === d.key));
    btn.textContent = d.label;
    btn.addEventListener('click', () => {
      if (difficulty === d.key) return;
      difficulty = d.key;
      persistDifficulty();
      renderDifficulty();
    });
    difficultyBar.append(btn);
  }
}

function renderGrid(): void {
  charGrid.textContent = '';
  kanjiData.forEach((k, idx) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const passed = isPassed(mastery, k.char, mode);
    btn.className = `char-cell${idx === charIndex ? ' current' : ''}${passed ? ' passed' : ''}`;
    btn.textContent = k.char;
    btn.setAttribute('aria-label', `${k.char}を練習する${passed ? '(合格済み)' : ''}`);
    btn.addEventListener('click', () => {
      charIndex = idx;
      resetChar();
      renderGrid();
    });
    charGrid.append(btn);
  });
  gridCount.textContent = `合格 ${passedCount(mastery, mode)}/${kanjiData.length}`;
}

function resetChar(): void {
  strokeIndex = 0;
  missCount = 0;
  message = '';
  trail = [];
  renderPrompt();
  renderBoard();
  renderStatus();
  syncHash();
}

// 手本を一画ずつ再生する。書き終えた画は墨で残し、いま書く画を山吹で引く。
function renderReplayFrame(doneCount: number, animateIdx: number | null): void {
  const k = current();
  board.textContent = '';
  appendGuide();
  const done = el('g', { class: 'ink' });
  k.strokes.slice(0, doneCount).forEach((d) => done.append(el('path', { d })));
  board.append(done);
  if (animateIdx !== null) {
    const d = k.strokes[animateIdx];
    if (d !== undefined) {
      const hint = el('path', { class: 'hint-stroke', d });
      board.append(hint);
      const len = Math.ceil(polylineLengthOf(k.char, animateIdx));
      hint.setAttribute('stroke-dasharray', String(len));
      hint.setAttribute('stroke-dashoffset', String(len));
      hint.getBoundingClientRect();
      hint.classList.add('animate');
    }
  }
}

function replayStrokes(): void {
  if (replaying) return;
  const k = current();
  if (prefersReduced()) {
    renderReplayFrame(k.strokes.length, null);
    window.setTimeout(renderBoard, 1200);
    return;
  }
  replaying = true;
  btnReplay.disabled = true;
  let s = 0;
  const tick = (): void => {
    if (s >= k.strokes.length) {
      replaying = false;
      btnReplay.disabled = false;
      renderBoard();
      return;
    }
    renderReplayFrame(s, s);
    s += 1;
    window.setTimeout(tick, 640);
  };
  tick();
}

function resetProgress(): void {
  if (!window.confirm('合格の記録をすべて消す。よろしいか。')) return;
  mastery = emptyMastery();
  persist();
  renderGrid();
}

function applyRouteFromHash(): void {
  const route = parseHash(location.hash);
  if (!route) return;
  let changed = mode !== route.mode;
  mode = route.mode;
  if (route.char) {
    const idx = kanjiData.findIndex((k) => k.char === route.char);
    if (idx >= 0 && idx !== charIndex) {
      charIndex = idx;
      changed = true;
    }
  }
  if (changed) {
    renderTabs();
    renderGrid();
    resetChar();
  }
}

function finishChar(): void {
  const k = current();
  if (missCount <= PASS_MISS_LIMIT) {
    mastery = markPassed(mastery, k.char, mode);
    persist();
    message = `合格。「次の字」で進む`;
  } else {
    message = `書き上げた(ミス${missCount})。合格はミス${PASS_MISS_LIMIT}回まで。書き直すと再挑戦できる`;
  }
  renderGrid();
  renderStatus();
  board.classList.add('celebrate');
  setTimeout(() => board.classList.remove('celebrate'), 700);
}

function toBoardPoint(e: PointerEvent): Point {
  const rect = board.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) / rect.width) * VB,
    y: ((e.clientY - rect.top) / rect.height) * VB,
  };
}

board.addEventListener('pointerdown', (e) => {
  if (replaying) return;
  const k = current();
  if (strokeIndex >= k.strokes.length) return;
  drawing = true;
  trail = [toBoardPoint(e)];
  board.setPointerCapture(e.pointerId);
  e.preventDefault();
});

board.addEventListener('pointermove', (e) => {
  if (!drawing) return;
  const p = toBoardPoint(e);
  const last = trail[trail.length - 1];
  if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.8) {
    trail.push(p);
    renderBoard();
    board.append(el('path', { class: 'trail', d: trailD(trail) }));
  }
});

board.addEventListener('pointerup', () => {
  if (!drawing) return;
  drawing = false;
  const k = current();
  const expected = polylinesOf(k.char)[strokeIndex];
  if (!expected) return;

  const verdict = judgePolyline(trail, expected, thresholdsFor(difficulty));
  if (verdict.ok) {
    strokeIndex += 1;
    message = '';
    renderBoard();
    if (strokeIndex >= k.strokes.length) finishChar();
    else renderStatus();
  } else {
    missCount += 1;
    message = verdict.reason !== undefined ? judgeReasonLabels[verdict.reason] : 'もう一度';
    renderBoard({ wrongTrail: trail, hint: missCount >= 2 && mode === 'trace' });
    renderStatus();
    setTimeout(() => renderBoard({ hint: missCount >= 2 && mode === 'trace' }), 600);
  }
  trail = [];
});

btnHint.addEventListener('click', () => {
  renderBoard({ hint: true });
});

btnReplay.addEventListener('click', replayStrokes);
btnReset.addEventListener('click', resetChar);
btnResetProgress.addEventListener('click', resetProgress);

btnNext.addEventListener('click', () => {
  const start = (charIndex + 1) % kanjiData.length;
  let next = start;
  for (let i = 0; i < kanjiData.length; i++) {
    const idx = (start + i) % kanjiData.length;
    const k = kanjiData[idx];
    if (k && !isPassed(mastery, k.char, mode)) {
      next = idx;
      break;
    }
  }
  charIndex = next;
  resetChar();
  renderGrid();
});

window.addEventListener('hashchange', applyRouteFromHash);

// 起動時にURLハッシュからモードと字を復元する
const initialRoute = parseHash(location.hash);
if (initialRoute) {
  mode = initialRoute.mode;
  if (initialRoute.char) {
    const idx = kanjiData.findIndex((k) => k.char === initialRoute.char);
    if (idx >= 0) charIndex = idx;
  }
}

renderTabs();
renderDifficulty();
renderGrid();
resetChar();
