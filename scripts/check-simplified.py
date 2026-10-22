"""掃簡體字：網站程式與頁面＋出題池物種的中文名、別名、科名、白話介紹（有就離場碼 1）。
判斷方式在 tools/zh.py（zhconv 逐字比對＋Big5 字集，不手寫字表）。物種名稱的簡體字 normalize.py 已經逐字換成繁體，這裡是最後把關。"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "tools"))
from zh import bad_chars  # noqa: E402


def main() -> int:
    bad = 0
    for p in list((ROOT / "public").rglob("*")) + list((ROOT / "src").rglob("*.ts")):
        if p.suffix in (".html", ".js", ".css", ".ts"):
            b = bad_chars(p.read_text(encoding="utf-8"))
            if b:
                bad += 1
                print(f"[簡體] {p.relative_to(ROOT)}: {b}")
    path = Path(os.environ.get("LUN_INSECTS_CACHE", r"D:\lun-insects-cache")) / "build" / "species.jsonl"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            r = json.loads(line)
            if r["pool"]:
                b = bad_chars("".join([r["zh"] or "", *r["alt"], r["fam_zh"] or ""]))
                if b:
                    bad += 1
                    print(f"[簡體] 物種 {r['id']} {r['zh']}: {b}")
    ai = ROOT / "data" / "ai_plain.json"
    if ai.exists():
        for k, v in json.loads(ai.read_text(encoding="utf-8")).items():
            b = bad_chars(v["text"])
            if b:
                bad += 1
                print(f"[簡體] 白話介紹 {k}: {b}")
    print("沒有發現簡體字" if not bad else f"共 {bad} 處需要看")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
