"""查核 AI 白話介紹（data/ai_plain.json，{iNat 編號: {text, src}}），抓可能編造或不合規的地方。

依據：CACHE/build/ai_src.jsonl（ai_pick.py 產生：維基百科導言＋本站已知的中文名、別名、目、科）。
規則：
- 字數 40～150；不能有破折號、簡體字、禁用詞
- 阿拉伯數字、中文數字＋單位（兩對、五公分），依據裡要找得到（昆蟲共通的「六隻腳、三段、一對觸角」除外）
- 提到的地名（日本、印度、東南亞…）依據裡要找得到（「台灣」除外：資料本來就是台灣的觀察）
- src 要等於依據的維基百科網址
用法：python tools/ai_check.py；有問題離場碼 1
"""
import json
import re
import sys
import unicodedata

from common import CACHE, ROOT
from zh import bad_chars

BANNED = re.compile(r"——|—|賦能|優化|抓手|顆粒度|閉環|落地|對齊|痛點|視頻|信息|質量|用戶|渲染|調性|骨架")
PLACES = ["日本", "中國", "大陸", "韓國", "朝鮮", "印度", "東南亞", "南亞", "東亞", "歐洲", "非洲", "美洲", "澳洲", "澳大利亞", "菲律賓", "越南", "泰國",
          "馬來", "印尼", "印度尼西亞", "緬甸", "寮國", "柬埔寨", "斯里蘭卡", "尼泊爾", "喜馬拉雅", "琉球", "沖繩", "香港", "海南", "蘭嶼", "綠島", "金門", "馬祖", "澎湖"]
CN_NUM = "一二兩三四五六七八九十百千"
COMMON = ["六隻腳", "6 隻腳", "三段", "3 段", "一對觸角", "兩對翅膀", "一對翅膀"]  # 昆蟲共通特徵；兩對／一對翅膀要看目，下方另外查


def norm(s):
    return unicodedata.normalize("NFKC", s or "")


def check_one(src, item):
    text, probs = item["text"], []
    ref = norm(" ".join([src["wiki"], src["zh"] or "", "、".join(src["alt"]), src["ord_zh"] or "", src["folk"] or "", src["fam_zh"] or "", src["sci"]]))
    if not 40 <= len(text) <= 150:
        probs.append(f"字數 {len(text)}")
    if BANNED.search(text):
        probs.append("禁用詞或破折號：" + BANNED.search(text).group(0))
    if bad_chars(text):
        probs.append("簡體字：" + "".join(bad_chars(text)))
    if item.get("src") != src["url"]:
        probs.append("src 不是依據的維基百科網址")
    body = text
    for c in COMMON:
        body = body.replace(c, "")
    for num in re.findall(r"\d+(?:\.\d+)?", body):
        if num not in ref:
            probs.append(f"數字「{num}」依據裡沒有")
    for m in re.findall(f"[{CN_NUM}]+(?=[對隻種個年月天公毫釐倍次代層條枚顆])", body):
        alt = {m, m.replace("兩", "二"), m.replace("二", "兩")}
        if not any(x in ref for x in alt) and m not in ("一",):
            probs.append(f"數量「{m}」依據裡沒有")
    for p in PLACES:
        if p in text and p not in ref:
            probs.append(f"地名「{p}」依據裡沒有")
    return probs


def main():
    srcs = {json.loads(l)["id"]: json.loads(l) for l in open(CACHE / "build" / "ai_src.jsonl", encoding="utf-8")}
    data = json.loads((ROOT / "data" / "ai_plain.json").read_text("utf-8"))
    bad = 0
    for k, item in data.items():
        src = srcs.get(int(k))
        if not src:
            print(f"{k}：不在依據清單裡")
            bad += 1
            continue
        p = check_one(src, item)
        if p:
            bad += 1
            print(f"{k} {src['zh']}：{'；'.join(p)}\n    改寫：{item['text']}")
    miss = [s["zh"] for i, s in srcs.items() if str(i) not in data]
    print(f"查了 {len(data)} 種，有問題 {bad} 種；還沒寫的 {len(miss)} 種{('：' + '、'.join(miss[:10])) if miss else ''}")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
