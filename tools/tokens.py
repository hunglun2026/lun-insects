"""搜尋切詞：中文切成「單字＋兩字一組」，英數字整個字。

D1 的 FTS5 若用 trigram，兩個字的詞（青花、玉璧）查不到；所以自己切好再交給 unicode61（只按空白分）。
src/tokens.ts 是同一套規則（Worker 查詢時用），兩邊的測試用同一組例子（tests/tokens.json）。
"""
import re

CJK = re.compile(r"[㐀-鿿豈-﫿]+")
WORD = re.compile(r"[0-9a-z]+")


def index_tokens(text: str) -> str:
    """建索引用：單字＋兩字一組，去重後以空白串起來。"""
    out = []
    t = (text or "").lower()
    for run in CJK.findall(t):
        out.extend(run)
        out.extend(run[i:i + 2] for i in range(len(run) - 1))
    out.extend(WORD.findall(t))
    return " ".join(dict.fromkeys(out))


def query_tokens(q: str) -> list:
    """查詢用：一個字就查單字；兩字以上只查兩字一組（全部都要命中）。"""
    out = []
    t = (q or "").lower()
    for run in CJK.findall(t):
        out.extend([run] if len(run) == 1 else [run[i:i + 2] for i in range(len(run) - 1)])
    out.extend(WORD.findall(t))
    return list(dict.fromkeys(out))
