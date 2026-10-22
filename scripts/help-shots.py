"""拍使用說明頁（help.html）的畫面截圖：1100×760 拍、縮成 880 寬 webp，存 public/img/help/。

功能或畫面改了就重拍：先開本機 `npx wrangler dev --remote --port 8814`，再跑
  python scripts/help-shots.py [網址，預設 http://127.0.0.1:8814]
瀏覽器是自己開的獨立無頭 Chrome，跑完就關。檔名要跟 help.html 裡的 <img src> 一致。
"""
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8814").rstrip("/")
DEST = Path(__file__).resolve().parent.parent / "public" / "img" / "help"
# 先存在快取資料夾，拍完才複製進 public/：wrangler dev 看到 public/ 有檔案變動會重載，打斷拍攝中的請求
OUT = Path(r"D:\lun-insects-cache\help-shots")


def ready(page):
    page.wait_for_function("document.documentElement.dataset.ready", timeout=30000)


def photos_loaded(page):
    # 畫面上看得到的圖都載完才拍
    page.wait_for_function("[...document.querySelectorAll('main img')].filter(i=>{const r=i.getBoundingClientRect();return r.bottom>0&&r.top<innerHeight}).every(i=>i.complete)", timeout=20000)
    page.wait_for_timeout(400)


def shot(page, name):
    png = page.screenshot()
    im = Image.open(io.BytesIO(png)).convert("RGB")
    im = im.resize((880, round(im.height * 880 / im.width)), Image.LANCZOS)
    im.save(OUT / f"{name}.webp", "WEBP", quality=80)
    print(f"  {name}.webp {im.size} {(OUT / f'{name}.webp').stat().st_size // 1024} KB", flush=True)


def go(page, path, level="e"):
    page.goto(BASE + "/")
    page.evaluate(f"localStorage.setItem('in-level','{level}')")
    page.goto(BASE + path)
    ready(page)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        ctx = b.new_context(viewport={"width": 1100, "height": 760}, reduced_motion="reduce")
        page = ctx.new_page()

        # 首頁引導入口：老師 → 國中
        go(page, "/", "j")
        page.evaluate("localStorage.removeItem('in-guide')")
        page.reload(); ready(page)
        page.click("[data-who=teacher]")
        page.click("[data-lv=j]")
        page.evaluate("document.getElementById('start').scrollIntoView()")
        page.evaluate("scrollBy(0,-12)")
        page.wait_for_timeout(300)
        shot(page, "guide")

        go(page, "/sp"); photos_loaded(page); shot(page, "sp")

        # 白話介紹：挑一種有 AI 改寫的常見昆蟲
        ai = page.evaluate("""async () => { const s = (await (await fetch('/api/species')).json()).items.filter(x => x.lv === 'e');
          for (const x of s.slice(0, 80)) { const r = await (await fetch('/api/sp/' + x.id)).json(); if (r.item.ai_text) return x.id; } return s[0].id; }""")
        go(page, f"/sp#{ai}", "e")
        page.wait_for_selector("dialog[open] .plain")
        photos_loaded(page); shot(page, "detail")

        go(page, "/search?t=sp&q=" + "鳳蝶"); page.wait_for_selector("#out .acard"); photos_loaded(page); shot(page, "search")

        for name, start, sel in (("guess", "#go10", ".stage"), ("classify", "#go10", ".stage"), ("isinsect", "#go10", ".stage"),
                                 ("stages", "#go", ".tl-card"), ("memory", "#go", ".mcard")):
            go(page, "/" + name)
            page.click(start)
            page.wait_for_selector(sel)
            page.wait_for_timeout(600)
            photos_loaded(page)
            if sel == ".stage":
                page.evaluate("document.querySelector('.stage').scrollIntoView({block:'start'});scrollBy(0,-12)")
                page.wait_for_timeout(200)
            shot(page, name)

        go(page, "/months"); page.wait_for_selector("#top .acard"); photos_loaded(page); shot(page, "months")
        go(page, "/museum?q=" + "虎頭蜂", "s"); page.wait_for_selector(".tile"); page.wait_for_timeout(500)
        page.evaluate("document.querySelector('.mus').scrollIntoView({block:'start'});scrollBy(0,-60)"); page.wait_for_timeout(300); shot(page, "museum")

        # 小圖鑑示範：兩種常見昆蟲，第一種寫好筆記
        sp = page.evaluate("fetch('/api/species').then(r=>r.json()).then(d=>d.items.filter(x=>x.lv==='e'&&x.kind==='insect').slice(0,3))")
        book = {"title": "我們班的校園昆蟲", "items": [{"id": x["id"], "name": x["zh"], "ord": x["ord"], "img": x["img"], "note": ""} for x in sp]}
        book["items"][0]["note"] = "我在學校的水池邊看過牠。牠有六隻腳，翅膀亮亮的，停下來時會一直搧翅膀。"
        page.evaluate("bk => localStorage.setItem('in-book-v1', JSON.stringify(bk))", book)
        go(page, "/book"); photos_loaded(page); shot(page, "book")

        go(page, "/passport"); shot(page, "passport")

        go(page, "/teacher#guide"); shot(page, "teacher-pack")
        go(page, "/teacher")
        page.click("#gen"); page.wait_for_selector("#sheet .q"); photos_loaded(page)
        page.evaluate("document.getElementById('sheet').scrollIntoView({block:'start'});scrollBy(0,-12)")
        page.wait_for_timeout(300); shot(page, "teacher-sheet")
        go(page, "/teacher#slides")
        page.click("#gen2"); page.wait_for_timeout(1200); photos_loaded(page)
        page.evaluate("document.getElementById('slide').scrollIntoView({block:'start'});scrollBy(0,-12)")
        page.wait_for_timeout(300); shot(page, "teacher-slide")
        go(page, "/teacher#board"); shot(page, "teacher-board")
        b.close()
    import shutil
    DEST.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.webp"):
        shutil.copy2(f, DEST / f.name)
    print(f"已複製到 {DEST}")


if __name__ == "__main__":
    main()
