"""端對端測試：用無頭瀏覽器走學生與老師會按的路徑，收 JS 錯誤、失敗請求、橫向溢出，並核對畫面上的數字跟 API 一致。

用法：python scripts/e2e.py [網址，預設 http://127.0.0.1:8814] [--shots 截圖資料夾]
離場碼：有任何一項失敗就是 1。瀏覽器是自己開的獨立無頭 Chrome，跑完就關。
"""
import argparse
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PAGES = ["/", "/sp", "/search", "/guess", "/classify", "/isinsect", "/memory", "/stages", "/months", "/museum", "/book", "/teacher", "/passport", "/help"]
fails = []


def check(cond, msg):
    print(("  [OK] " if cond else "  [失敗] ") + msg, flush=True)
    if not cond:
        fails.append(msg)


def watch(page):
    errs = []
    page.on("pageerror", lambda e: errs.append("JS 錯誤：" + str(e)[:200]))
    page.on("console", lambda m: m.type == "error" and errs.append("console：" + m.text[:200]))
    page.on("requestfailed", lambda r: errs.append("請求失敗：" + r.url[:120]))
    page.on("response", lambda r: r.status >= 400 and "/img/" not in r.url and errs.append(f"HTTP {r.status}：{r.url[:120]}"))
    return errs


def ready(page, timeout=30000):
    page.wait_for_function("document.documentElement.dataset.ready", timeout=timeout)


def start_quiz(pg, base, path, lv, cb):
    pg.goto(base + path + "?cb=" + cb); ready(pg)
    pg.select_option("#lvl", lv); pg.wait_for_timeout(300)
    pg.get_by_role("button", name="開始（10 題）").click()
    pg.wait_for_selector(".opt", timeout=20000)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base", nargs="?", default="http://127.0.0.1:8814")
    ap.add_argument("--shots")
    a = ap.parse_args()
    base = a.base.rstrip("/")
    shots = Path(a.shots) if a.shots else None
    if shots:
        shots.mkdir(parents=True, exist_ok=True)
    cb = str(int(time.time()))
    with sync_playwright() as p:
        b = p.chromium.launch(channel="chrome", headless=True)
        for name, vp in (("桌機", {"width": 1280, "height": 900}), ("手機", {"width": 390, "height": 844})):
            print(f"== {name} 各頁載入", flush=True)
            ctx = b.new_context(viewport=vp)
            for path in PAGES:
                pg = ctx.new_page()
                errs = watch(pg)
                pg.goto(base + path + "?cb=" + cb)
                try:
                    ready(pg)
                    pg.wait_for_timeout(1500)
                except Exception as e:  # noqa: BLE001
                    errs.append("頁面沒有就緒：" + str(e)[:100])
                over = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
                check(not errs and over <= 0, f"{name} {path}" + (f"：{errs[:3]}" if errs else "") + (f"：橫向溢出 {over}px" if over > 0 else ""))
                if shots:
                    pg.screenshot(path=str(shots / f"{name}{path.replace('/', '_') if path != '/' else '_home'}.png"), full_page=False)
                pg.close()
            ctx.close()

        print("== 操作流程", flush=True)
        ctx = b.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        errs = watch(pg)
        pg.goto(base + "/?cb=" + cb); ready(pg)
        meta = pg.evaluate("fetch('/api/meta').then(r=>r.json())")
        # 跟前端一樣帶 m＝照片數（照片補上後快取鍵才會換新）
        sp = pg.evaluate("m => fetch('/api/species?m=' + m).then(r=>r.json())", meta["photos"])["items"]
        check(meta["insects"] >= 500 and meta["specimens"] > 140000 and len(sp) == meta["photos"],
              f"API：昆蟲 {meta['insects']} 種、非昆蟲 {meta['others']} 種、有照片 {meta['photos']}、標本 {meta['specimens']}、清單 {len(sp)} 種")

        # 首頁：今天的昆蟲盒有照片、統計數字是真實值、最後一個展示框的圖有載入
        pg.evaluate("document.getElementById('today').scrollIntoView()"); pg.wait_for_timeout(2500)
        n = pg.evaluate("[...document.querySelectorAll('#today img.photo')].filter(i=>i.naturalWidth>0).length")
        check(n >= 6, f"首頁今天的昆蟲盒顯示 {n} 張照片")
        pg.evaluate("document.querySelector('.w-stats').scrollIntoView({block:'center'})"); pg.wait_for_timeout(2000)
        nums = pg.evaluate("[...document.querySelectorAll('[data-w]')].map(e=>+e.textContent.replace(/,/g,''))")
        check(nums[0] == meta["insects"] and nums[1] == meta["specimens"] and all(nums), f"首頁數字 {nums}")
        pg.evaluate("(()=>{const t=document.getElementById('tour');scrollTo(0,t.getBoundingClientRect().top+scrollY+t.offsetHeight-innerHeight)})()")
        pg.wait_for_timeout(2500)
        last = pg.evaluate("(()=>{const i=[...document.querySelectorAll('#tour img')].pop();return i.naturalWidth})()")
        caps = pg.evaluate("[...document.querySelectorAll('#tour figcaption')].filter(f=>f.textContent).length")
        check(pg.locator("#tour .w-panel").count() == 8 and last > 0 and caps == 8, f"首頁展示框 8 個、都有圖說 {caps}、最後一張圖寬 {last}px")

        # 引導入口：學生 → 國中 → 推薦 3 個、難度變國中
        pg.evaluate("localStorage.removeItem('in-guide')"); pg.goto(base + "/?cb=" + cb); ready(pg)
        pg.click(".w-cta-row [data-pick=student]"); pg.wait_for_timeout(1200)
        pg.click("[data-lv=j]"); pg.wait_for_timeout(300)
        check(pg.locator("#g-recs .tool").count() == 3 and pg.eval_on_selector("#lvl", "e=>e.value") == "j" and pg.locator("#g-who").inner_text() == "學生・國中", "引導入口：學生・國中，推薦 3 個工具")

        # 小百科：篩選甲蟲、開詳情（照片、作者、每月長條、白話）
        pg.goto(base + "/sp?ord=Coleoptera&cb=" + cb); ready(pg); pg.wait_for_timeout(1000)
        tags = pg.evaluate("[...document.querySelectorAll('#grid .tag2:not(.hot)')].map(e=>e.textContent)")
        check(tags and all(t == "甲蟲" for t in tags), f"小百科 ?ord=Coleoptera：{len(tags)} 種都是甲蟲")
        pg.locator("#grid .acard").first.click(); pg.wait_for_selector("#dlg h2", timeout=15000); pg.wait_for_timeout(1500)
        title = pg.locator("#dlg h2").inner_text()
        big = pg.evaluate("(()=>{const i=document.querySelector('#dlg #big img');return i?i.naturalWidth:0})()")
        cr = pg.locator("#dlg #cr").inner_text()
        check(bool(title) and big > 0 and ("CC" in cr), f"詳情：{title}，大圖寬 {big}px，{cr[:40]}")
        check(pg.locator("#dlg .mbars span").count() == 12 and pg.locator("#dlg .plain").count() == 1, "詳情有 12 個月長條與白話介紹")
        pg.locator("#dlg #bk").click(); pg.wait_for_timeout(300)
        check("已在" in pg.locator("#dlg #bk").inner_text(), "加入小圖鑑")
        pg.locator("#dlg #x").click()

        # 搜尋：昆蟲（瀏覽器內比對）＋標本（API）
        pg.goto(base + "/search?t=sp&q=%E9%B3%B3%E8%9D%B6&cb=" + cb); ready(pg); pg.wait_for_timeout(1000)
        names = pg.evaluate("[...document.querySelectorAll('#out .acard b')].map(e=>e.textContent)")
        check(len(names) >= 5 and all("鳳蝶" in x for x in names[:5]), f"搜尋鳳蝶：{len(names)} 種，前幾個 {names[:3]}")
        pg.get_by_role("tab", name="🗄️ 標本").click(); pg.fill("#q", "虎頭蜂"); pg.get_by_role("button", name="搜尋").click(); pg.wait_for_timeout(3000)
        txt = pg.locator("#count").inner_text()
        rows = pg.locator("#out .arow").count()
        check("筆標本" in txt and rows == 30, f"搜尋標本虎頭蜂：{txt[:30]}，列出 {rows} 筆")

        # 三個選擇題遊戲：選項數、回饋、照片作者
        for path, title in (("/guess", "猜我是誰"), ("/classify", "分類闖關"), ("/isinsect", "是不是昆蟲")):
            for lv, k in (("e", 3), ("j", 4), ("s", 4)):
                if path == "/isinsect":
                    k = 2
                start_quiz(pg, base, path, lv, cb)
                nopt = pg.locator(".opt").count()
                pg.wait_for_function("(()=>{const i=document.querySelector('#pic img');return i&&i.complete})()", timeout=15000)
                photo = pg.evaluate("(()=>{const i=document.querySelector('#pic img');return i?i.naturalWidth:0})()")
                credit = pg.locator("#pic .credit").inner_text() if pg.locator("#pic .credit").count() else ""
                pg.locator(".opt").first.click(); pg.wait_for_timeout(400)
                fb = pg.locator("#fb").inner_text()
                check(nopt == k and photo > 0 and fb and "照片" in credit, f"{title} {lv}：{nopt} 個選項、照片寬 {photo}、回饋「{fb[:20]}」、{credit[:24]}")

        # 分類闖關國小：選項只有 6 大類的俗名
        start_quiz(pg, base, "/classify", "e", cb)
        labels = pg.evaluate("[...document.querySelectorAll('.opt')].map(o=>o.textContent)")
        allowed = {"甲蟲", "蝴蝶和蛾", "蜂和螞蟻", "蜻蜓和豆娘", "蝗蟲、蟋蟀和螽斯", "椿象、蟬和蚜蟲"}
        check(all(x in allowed for x in labels), f"分類闖關國小選項都是 6 大類：{labels}")

        # 翻牌配對：國小 6 對，把每對翻開，確認能配完
        pg.goto(base + "/memory?cb=" + cb); ready(pg)
        pg.select_option("#lvl", "e"); pg.wait_for_timeout(300)
        pg.get_by_role("button", name="開始翻牌").click()
        pg.wait_for_selector(".mcard", timeout=20000)
        cards = pg.locator(".mcard").count()
        names = pg.evaluate("[...document.querySelectorAll('.mcard')].map(c=>c.querySelector('.front b')?c.querySelector('.front b').textContent:(c.querySelector('.front img')||c.querySelector('.front .ph')).getAttribute(c.querySelector('.front img')?'alt':'aria-label'))")
        for nm in dict.fromkeys(names):
            for i in [i for i, x in enumerate(names) if x == nm][:2]:
                pg.locator(".mcard").nth(i).click(); pg.wait_for_timeout(150)
            pg.wait_for_timeout(250)
        pg.wait_for_timeout(1200)
        check(cards == 12 and "全部配對完成" in pg.locator("main").inner_text(), f"翻牌配對國小：{cards} 張牌，配完出現完成畫面")

        # 變態排排站：國中，點完順序再答變態方式
        pg.goto(base + "/stages?cb=" + cb); ready(pg)
        pg.select_option("#lvl", "j"); pg.wait_for_timeout(300)
        pg.get_by_role("button", name="開始排排站").click()
        pg.wait_for_selector(".tl-card", timeout=20000)
        pg.wait_for_function("[...document.querySelectorAll('.tl-card img')].every(i=>i.complete)", timeout=20000)
        k = pg.locator(".tl-card").count()
        imgs = pg.evaluate("[...document.querySelectorAll('.tl-card img')].filter(i=>i.naturalWidth>0).length")
        for _ in range(k):
            pg.locator(".tl-card:not([disabled])").first.click()
        pg.wait_for_timeout(400)
        marked = pg.locator(".tl-card.right, .tl-card.wrong").count()
        pg.locator("#ask .opt").first.click(); pg.wait_for_timeout(300)
        nx = pg.locator("#nx .btn").count()
        check(k >= 2 and imgs == k and marked == k and nx == 1, f"變態排排站國中：{k} 張成長照片（載入 {imgs}）、標記 {marked}、下一回合按鈕 {nx}")

        # 幾月看得到：換月份，長條與清單跟著換
        pg.goto(base + "/months?cb=" + cb); ready(pg)
        pg.locator("#mon .chip", has_text="7 月").click(); pg.wait_for_timeout(500)
        h7 = pg.locator("#out h2").nth(1).inner_text()
        top7 = pg.locator("#top .acard").count()
        check("7 月" in h7 and top7 >= 6 and pg.locator("#year button").count() == 12, f"幾月看得到 7 月：{top7} 種、12 根長條")

        # 標本館探究：主題 → 地圖、長條 → 點縣市列標本
        pg.goto(base + "/museum?cb=" + cb); ready(pg); pg.wait_for_selector(".tile", timeout=20000)
        tiles = pg.locator(".tile").count()
        cnt = pg.locator("#out .count").inner_text()
        pg.locator(".tile", has_text="宜蘭").click(); pg.wait_for_selector("#docs .arow", timeout=20000)
        lt = pg.locator("#lt").inner_text()
        rows = pg.evaluate("[...document.querySelectorAll('#docs .arow')].map(e=>e.textContent)")
        check(tiles == 22 and "宜蘭縣" in lt and rows and all("宜蘭縣" in r for r in rows), f"標本館：{tiles} 個縣市方塊、{cnt[:30]}、宜蘭 {len(rows)} 筆都在宜蘭")
        pg.locator("#topics .chip", has_text="虎頭蜂").click(); pg.wait_for_timeout(3000)
        top = pg.locator(".alist").first.inner_text()
        check("虎頭蜂" in top, "標本館虎頭蜂主題：最多的物種有虎頭蜂")

        # 小圖鑑：寫筆記、重新整理還在、投影
        pg.goto(base + "/sp?cb=" + cb); ready(pg); pg.wait_for_timeout(800)
        pg.locator("#grid .acard").nth(1).click(); pg.wait_for_selector("#dlg #bk", timeout=15000); pg.wait_for_timeout(500)
        pg.locator("#dlg #bk").click(); pg.locator("#dlg #x").click()
        pg.goto(base + "/book?cb=" + cb); ready(pg)
        rows = pg.locator(".ex-item").count()
        pg.locator(".ex-item textarea").first.fill("牠有六隻腳，翅膀亮亮的，我在公園看過。")
        pg.reload(); ready(pg)
        kept = pg.locator(".ex-item textarea").first.input_value()
        pg.get_by_role("button", name="📽️ 投影發表").click(); pg.wait_for_timeout(800)
        pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(300)
        pg_no = pg.locator("#pg").inner_text()
        pg.locator(".show #cl").click()
        check(rows >= 2 and "六隻腳" in kept and pg_no.startswith("2"), f"小圖鑑：{rows} 種、筆記重新整理後還在、投影第 {pg_no}")

        # 教師專區：學習單、課程包
        pg.goto(base + "/teacher?cb=" + cb); ready(pg)
        pg.click("#gen"); pg.wait_for_selector("#sheet .q", timeout=30000); pg.wait_for_timeout(2000)
        qn = pg.locator("#sheet .q").count()
        imgs = pg.evaluate("[...document.querySelectorAll('#sheet img')].filter(i=>i.naturalWidth>0).length")
        sheet = pg.locator("#sheet").inner_text()
        check(qn == 16 and imgs >= 16 and "CC" in sheet, f"學習單 8 題＋答案頁：{qn} 題區塊、{imgs} 張圖、附照片授權")
        pg.get_by_role("tab", name="📚 課程包").click()
        pg.get_by_role("button", name="一鍵帶入學習單").nth(1).click(); pg.wait_for_timeout(3000)
        mq = pg.evaluate("[...document.querySelectorAll('#sheet .q')].filter(q=>q.textContent.includes('變態')).length")
        check(pg.eval_on_selector("#lvl", "e=>e.value") == "j" and mq >= 10, f"昆蟲的一生課程包：難度國中、{mq} 題變態題")
        pg.goto(base + "/teacher?cb=" + cb + "#guide"); ready(pg)
        check(pg.locator("#tab-guide").is_visible(), "教師專區 #guide 直接打開課程包")

        # 使用說明：截圖全部載入、目錄連結都對得到
        pg.goto(base + "/help?cb=" + cb); ready(pg)
        r = pg.evaluate("""(async()=>{const w=ms=>new Promise(r=>setTimeout(r,ms));const imgs=[...document.querySelectorAll('main img')];
          imgs.forEach(i=>i.loading='eager');for(let k=0;k<60&&!imgs.every(i=>i.complete);k++)await w(200);
          return {n:imgs.length,bad:imgs.filter(i=>!i.naturalWidth).length,
            toc:[...document.querySelectorAll('.toc a')].filter(a=>!document.querySelector(a.getAttribute('href'))).length,faq:document.querySelectorAll('.faq').length}})()""")
        check(r["n"] >= 12 and r["bad"] == 0 and r["toc"] == 0 and r["faq"] >= 8, f"使用說明：截圖 {r['n']} 張、壞 {r['bad']}、目錄對不到 {r['toc']}、常見問題 {r['faq']} 題")

        # 護照
        pg.goto(base + "/passport?cb=" + cb); ready(pg)
        seen = pg.locator("#seen .acard").count()
        check(seen >= 1, f"護照記到看過的昆蟲 {seen} 種")
        check(not errs, "操作流程沒有 JS 錯誤" + (f"：{errs[:3]}" if errs else ""))
        b.close()
    print(f"\n結果：{'全部通過' if not fails else f'失敗 {len(fails)} 項'}")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
