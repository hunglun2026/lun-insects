"""依 CACHE/img/uploaded.txt 把線上 species 的 photo 重新標成 1 → CACHE/build/remark_photos.sql。
為什麼：重新匯入 species，期間背景上傳標的 photo=1 會寫在被換掉的舊表上；匯入後補標一次。
用法：python tools/remark_photos.py（tools/import.sh species 會自動跑）
"""
import sys

from common import CACHE

CHUNK = 2000  # 一句 UPDATE 放 2000 個代號，約 40KB，低於 D1 單句 100KB


def main():
    keys = sorted(set((CACHE / "img" / "uploaded.txt").read_text("utf-8").split()), key=int)
    path = CACHE / "build" / "remark_photos.sql"
    with open(path, "w", encoding="utf-8") as f:
        for i in range(0, len(keys), CHUNK):
            part = ",".join(keys[i: i + CHUNK])
            f.write(f"UPDATE species SET photo=1 WHERE photo=0 AND img IN ({part});\n")
    print(f"補標 {len(keys)} 個照片編號 → {path}")


if __name__ == "__main__":
    sys.exit(main())
