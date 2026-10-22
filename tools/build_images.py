"""CACHE/img/src/*.jpg → CACHE/img/600/*.webp（詳情頁、遊戲大圖）＋ CACHE/img/240/*.webp（卡片、翻牌）。

已轉過的跳過，可以邊抓邊轉。用法：python tools/build_images.py
"""
import sys
from concurrent.futures import ProcessPoolExecutor

from PIL import Image

from common import CACHE

SIZES = {600: 80, 240: 72}  # 長邊像素：webp 品質


def convert(src):
    key = src.stem
    out = []
    try:
        with Image.open(src) as im:
            im = im.convert("RGB")
            for size, quality in SIZES.items():
                dst = CACHE / "img" / str(size) / f"{key}.webp"
                if dst.exists():
                    continue
                cp = im.copy()
                cp.thumbnail((size, size))
                cp.save(dst, "WEBP", quality=quality, method=6)
                out.append(size)
    except Exception as e:  # noqa: BLE001  壞圖記下來，不中斷整批
        return key, f"失敗：{e}"
    return key, out


def main():
    for s in SIZES:
        (CACHE / "img" / str(s)).mkdir(parents=True, exist_ok=True)
    todo = [p for p in (CACHE / "img" / "src").glob("*.jpg") if not (CACHE / "img" / "240" / f"{p.stem}.webp").exists()]
    print(f"待轉 {len(todo)} 張")
    bad = 0
    with ProcessPoolExecutor() as ex:
        for key, r in ex.map(convert, todo, chunksize=64):
            if isinstance(r, str):
                bad += 1
                print(key, r)
    print(f"完成，失敗 {bad} 張")


if __name__ == "__main__":
    sys.exit(main())
