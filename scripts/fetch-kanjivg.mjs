// KanjiVG(https://github.com/KanjiVG/kanjivg, CC BY-SA 3.0)から
// 小学1年配当の80字のストロークデータを取得し、TypeScriptのデータに変換する。
// 生成物はリポジトリにコミットするため、CIや利用者はネットワークを必要としない。
import { writeFileSync } from 'node:fs';

const GRADE1 =
  '一右雨円王音下火花貝学気九休玉金空月犬見五口校左三山子四糸字耳七車手十出女小上森人水正生青夕石赤千川先早草足村大男竹中虫町天田土二日入年白八百文木本名目立力林六';

const chars = [...GRADE1];

function fileNameOf(ch) {
  return `${ch.codePointAt(0).toString(16).padStart(5, '0')}.svg`;
}

function extractStrokes(svg) {
  // path要素は筆順どおりに -s1, -s2, ... のidで並んでいる
  const out = [];
  const re = /<path[^>]*\bd="([^"]+)"[^>]*\/>/g;
  let m;
  while ((m = re.exec(svg)) !== null) out.push(m[1]);
  return out;
}

const entries = [];
for (const ch of chars) {
  const url = `https://raw.githubusercontent.com/KanjiVG/kanjivg/master/kanji/${fileNameOf(ch)}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.error(`${ch}: 取得失敗 ${res.status}`);
    process.exit(1);
  }
  const svg = await res.text();
  const strokes = extractStrokes(svg);
  if (strokes.length === 0) {
    console.error(`${ch}: ストロークが見つからない`);
    process.exit(1);
  }
  entries.push({ char: ch, strokes });
  console.log(`${ch}: ${strokes.length}画`);
  await new Promise((r) => setTimeout(r, 120));
}

const body = entries
  .map(
    (e) =>
      `  {\n    char: '${e.char}',\n    strokes: [\n${e.strokes
        .map((s) => `      '${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',`)
        .join('\n')}\n    ],\n  },`,
  )
  .join('\n');

const ts = `// このファイルは scripts/fetch-kanjivg.mjs が生成する。手で編集しない。
// ストロークデータの出典はKanjiVG(c) Ulrich Apel、CC BY-SA 3.0。
// 座標系はKanjiVGのviewBox(0 0 109 109)に従う。
export interface KanjiStrokes {
  char: string;
  strokes: string[];
}

export const KANJIVG_VIEWBOX = 109;

export const kanjiData: readonly KanjiStrokes[] = [
${body}
];
`;

writeFileSync('src/lib/data/strokes.ts', ts);
console.log(`${entries.length}字を src/lib/data/strokes.ts に書き出した`);
