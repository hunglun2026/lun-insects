// Worker 端切詞（src/tokens.ts）要跟 tools/tokens.py 一致：兩邊都跑 tests/tokens.json
import { readFileSync } from "node:fs";
import { queryTokens, ftsQuery } from "../src/tokens.ts";

const cases = JSON.parse(readFileSync(new URL("./tokens.json", import.meta.url), "utf8"));
let bad = 0;
for (const c of cases) {
  const got = JSON.stringify(queryTokens(c.q));
  if (got !== JSON.stringify(c.query)) { console.error(`✗ ${c.q}：得到 ${got}，應為 ${JSON.stringify(c.query)}`); bad++; }
}
if (ftsQuery('a" OR 1') !== '"a" "or" "1"') { console.error("✗ ftsQuery 沒把符號擋掉：" + ftsQuery('a" OR 1')); bad++; }
console.log(bad ? `切詞測試失敗 ${bad} 項` : `切詞測試通過 ${cases.length} 項`);
process.exit(bad ? 1 : 0);
