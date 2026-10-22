// 搜尋切詞：跟 tools/tokens.py 同一套規則（測試共用 tests/tokens.json）。
// 一個字就查單字；兩字以上只查「兩字一組」，全部都要命中。
const CJK = /[㐀-鿿豈-﫿]+/g;
const WORD = /[0-9a-z]+/g;

export function queryTokens(q: string): string[] {
  const t = (q || "").toLowerCase();
  const out: string[] = [];
  for (const run of t.match(CJK) ?? []) {
    const chars = Array.from(run);
    if (chars.length === 1) out.push(run);
    else for (let i = 0; i < chars.length - 1; i++) out.push(chars[i] + chars[i + 1]);
  }
  for (const w of t.match(WORD) ?? []) out.push(w);
  return [...new Set(out)];
}

// FTS5 查詢字串：每個詞加雙引號，避免使用者打的符號被當成語法
export const ftsQuery = (q: string) => queryTokens(q).slice(0, 12).map((w) => `"${w}"`).join(" ");
