"""產生自架中文字型子集 public/fonts/mu-sans-<包>-<雜湊>.woff2（Noto Sans TC，SIL OFL 1.1）。

拆包：瀏覽器靠 @font-face 的 unicode-range 只下載畫面上真的出現的字所在的那包。
  第 0 包＝介面文字；第 1 包＝出題池昆蟲名稱裡最常見的字；之後＝其餘名稱與說明，依出現次數每包約 400 字。
  檔名帶內容雜湊，可以放心設長快取；@font-face 由本腳本寫進 style.css 的 FONTS:BEGIN～END 區塊（不要手改）。

為什麼自架：不自架的話，每台電腦會退回不同系統字型，字形不一致；Google Fonts 又多一次外部連線。
字元範圍（多收沒關係，少收才會退回系統字型）：
  1. 網站所有頁面與程式裡的文字
  2. 出題池物種的名稱、別名、科名，標本的中文名、地點、採集者，來源 CACHE/build/species.jsonl、specimens.jsonl
  資料更新後跑 --check 補切
用法：
  python scripts/build-font.py           重新切字型
  python scripts/build-font.py --check   檢查現有資料與網站文字有沒有字不在任何一包裡（有就離場碼 1）
來源字型沿用 tools/web-design 的快取（~/.cache/web-design/fonts/），不用重新下載 12MB。
"""
import csv
import hashlib
import io
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, r"D:\ClaudeOnly\tools\web-design")
from webdesign import fonts  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FONTS = ROOT / "public" / "fonts"
CSS = ROOT / "public" / "css" / "style.css"
CHUNK = 400
EMOJI = re.compile("[\u2190-\u2bff\u3030\u303d\u3297\u3299\U0001f000-\U0001faff\ufe0f\u200d\u20e3]")




def ui_text() -> str:
    return "".join(p.read_text(encoding="utf-8") for ext in ("html", "js", "css") for p in (ROOT / "public").rglob(f"*.{ext}"))


def data_rows() -> list:
    """會顯示在畫面上的資料文字：出題池物種的名稱、別名、科名（name 欄，最常見的字切成第 1 包），
    標本的中文名、縣市與地點（desc 欄），以及白話介紹。"""
    import json, os
    build = Path(os.environ.get("LUN_INSECTS_CACHE", r"D:\lun-insects-cache")) / "build"
    rows = []
    for line in (build / "species.jsonl").read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        if r["pool"]:
            rows.append({"name": r["zh"] or "", "desc": "".join(r["alt"]) + (r["fam_zh"] or ""), "era": ""})
    places = set()
    for line in (build / "specimens.jsonl").read_text(encoding="utf-8").splitlines():
        r = json.loads(line)
        places.add("".join(filter(None, [r["zh"], r["country"], r["county"], r["place"], r["who"]])))
    rows += [{"name": "", "desc": p, "era": ""} for p in places]
    ai = ROOT / "data" / "ai_plain.json"
    if ai.exists():
        rows += [{"name": "", "desc": v["text"], "era": ""} for v in json.loads(ai.read_text(encoding="utf-8")).values()]
    return rows


def keep(text: str) -> set:
    skip = "\r\n\t" + chr(0xFFFD)  # 0xFFFD 是 csv.ts 偵測來源壞字用的比對字元，不是要顯示的字
    return {c for c in text if ord(c) >= 0x20 and c not in skip and not EMOJI.match(c)}


def needed() -> set:
    rows = "".join("".join(r.values()) for r in data_rows())
    return keep(ui_text() + rows)


def chunks() -> list:
    """回傳每包的字（字串清單），互不重疊、合起來＝needed()。"""
    need = needed()
    first = set(fonts.charset([ui_text()])) & need | (set(fonts.charset([""])))  # 介面＋基本符號
    rows = data_rows()
    nfreq = {}
    for r in rows:
        for c in r["name"]:
            nfreq[c] = nfreq.get(c, 0) + 1
    names = set(sorted((c for c in keep("".join(nfreq)) if c not in first), key=lambda c: -nfreq[c])[:CHUNK])
    names &= need
    rest = need - first - names
    freq = {}
    for r in rows:
        for c in "".join(r.values()):
            if c in rest:
                freq[c] = freq.get(c, 0) + 1
    ordered = sorted(rest, key=lambda c: (-freq.get(c, 0), c))
    out = ["".join(sorted(first)), "".join(sorted(names))]
    rest_chunks = [ordered[i:i + CHUNK] for i in range(0, len(ordered), CHUNK)]
    if len(rest_chunks) > 1 and len(rest_chunks[-1]) < CHUNK // 4:  # 最後一包太小就併進前一包，少一個請求
        tail = rest_chunks.pop()  # 先 pop 再接：寫成 a[-2] += a.pop() 會在 pop 後寫回錯的位置
        rest_chunks[-1] += tail
    out += ["".join(sorted(c)) for c in rest_chunks]
    return [c for c in out if c]


def ranges(chars: str) -> str:
    """字元轉 unicode-range（連續的合併成 U+4E00-4E05）。"""
    cps = sorted({ord(c) for c in chars})
    parts, start = [], cps[0]
    for prev, cur in zip(cps, cps[1:] + [None]):
        if cur != prev + 1:
            parts.append(f"U+{start:X}" if start == prev else f"U+{start:X}-{prev:X}")
            start = cur
    return ",".join(parts)


def main() -> int:
    if "--check" in sys.argv:
        from fontTools.ttLib import TTFont

        cmap = set()
        for f in FONTS.glob("mu-sans-*.woff2"):
            cmap |= set(TTFont(f).getBestCmap())
        # 來源字型 Noto Sans TC 本來就沒有的字（阿拉伯文、梵文拼音、擴充區罕用字、故宮原文夾的簡化字）
        # 切幾次都收不進來，只能退回系統字型：列出來但不算失敗。只有「來源有、子集漏了」才要重切
        source = set(TTFont(fonts._instanced("sans")).getBestCmap())
        gaps = sorted(c for c in needed() if ord(c) not in cmap)
        missing = [c for c in gaps if ord(c) in source]
        print(f"字型 {len(list(FONTS.glob('mu-sans-*.woff2')))} 包共 {len(cmap)} 字；網站與資料用到 {len(needed())} 字；"
              f"來源字型沒有、退回系統字型 {len(gaps) - len(missing)} 字；需要重切 {len(missing)} 字")
        if missing:
            print("需要重切（不帶參數跑一次）：", "".join(missing))
        return 1 if missing else 0

    FONTS.mkdir(parents=True, exist_ok=True)
    for old in FONTS.glob("mu-sans*.woff2"):
        old.unlink()
    faces, total = [], 0
    for i, chars in enumerate(chunks()):
        blob = fonts.subset_woff2("sans", chars)
        name = f"mu-sans-{i}-{hashlib.sha1(blob).hexdigest()[:8]}.woff2"
        (FONTS / name).write_bytes(blob)
        total += len(blob)
        faces.append('@font-face{font-family:"MuSans";src:url("/fonts/%s") format("woff2");font-weight:400 800;font-display:swap;unicode-range:%s}' % (name, ranges(chars)))
        print(f"第 {i} 包：{len(chars)} 字，{len(blob) / 1024:.0f} KB → {name}")
    css = CSS.read_text(encoding="utf-8")
    a, b = css.index("/* FONTS:BEGIN"), css.index("/* FONTS:END */")
    CSS.write_text(css[:a] + "/* FONTS:BEGIN 由 scripts/build-font.py 產生，不要手改 */\n" + "\n".join(faces) + "\n" + css[b:], encoding="utf-8")
    lic = fonts.cache_dir() / "OFL-LICENSE.txt"
    if lic.exists():
        shutil.copy(lic, FONTS / "LICENSE-OFL.txt")
    print(f"共 {len(faces)} 包 {total / 1024:.0f} KB；已更新 style.css。記得全站升 ?v=N（style.css 變了）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
