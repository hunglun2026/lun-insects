"""data/ai_plain.json（白話改寫）→ CACHE/build/import_ai.sql，整張表換掉。
改寫內容是本站寫的，改哪一種就直接改 data/ai_plain.json，再跑這支＋ bash tools/import.sh ai。
用法：python tools/ai_sql.py
"""
import json
import sys

from build_sql import inserts
from common import CACHE, ROOT


def main():
    data = json.loads((ROOT / "data" / "ai_plain.json").read_text("utf-8"))
    path = CACHE / "build" / "import_ai.sql"
    with open(path, "w", encoding="utf-8") as f:
        f.write("DELETE FROM ai_plain;\n")
        rows = sorted((int(k), v["text"], v.get("src")) for k, v in data.items())
        for s in inserts("ai_plain", ["id", "text", "src"], rows):
            f.write(s + "\n")
        f.write(f"INSERT OR REPLACE INTO meta (k, v) VALUES ('ai_count', '{len(data)}');\n")
    print(f"白話改寫 {len(data)} 種 → {path}")


if __name__ == "__main__":
    sys.exit(main())
