/* 我的小圖鑑：改圖鑑名稱、寫觀察筆記（依難度給提示）、調整順序、移除；列印圖鑑卡、全螢幕投影發表。
   資料在 book.js（localStorage）。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const root = document.getElementById("game");
  const HINT = {
    e: "牠長什麼樣子？有幾隻腳、什麼顏色？你在哪裡看過牠？",
    j: "牠屬於哪一目？身體有什麼特徵？幾月最容易看到？吃什麼、住在哪裡？",
    s: "牠的構造怎麼幫助牠生活（口器、翅膀、保護色）？跟同一目的昆蟲比有什麼不同？",
  };
  let st = Book.get();
  const save = () => Book.save(st);
  const item = (x) => Mu.enrich({ id: x.id, name: x.name, ord: Mu.ORDER[x.ord] ? x.ord : null, grp: Mu.OTHER[x.ord] ? x.ord : null, kind: Mu.OTHER[x.ord] ? "other" : "insect", img: x.img, photo: x.img ? 1 : 0 });
  const sub = (x) => (Mu.ORDER[x.ord] ? Mu.ORDER[x.ord].zh + "（" + Mu.ORDER[x.ord].folk + "）" : Mu.OTHER[x.ord] ? Mu.OTHER[x.ord].folk : "");

  function draw() {
    const lv = Mu.level();
    if (!st.items.length) {
      root.replaceChildren(el('<div class="stage"><h2>小圖鑑還是空的</h2><p>到昆蟲小百科挑幾種喜歡的昆蟲，按「加入我的小圖鑑」。</p><p><a class="btn primary big" href="/sp">去挑昆蟲 📖</a></p></div>'));
      return;
    }
    const box = el(
      '<div><div class="ex-edit"><div class="form-row"><label style="flex:1">圖鑑名稱<input type="text" id="title" maxlength="30"></label></div>' +
      '<p><button class="btn primary" id="show">📽️ 投影發表</button> <button class="btn" id="print">🖨️ 列印圖鑑卡</button> <button class="btn danger" id="clear">清空小圖鑑</button></p>' +
      '<p class="lead">觀察筆記提示（' + esc(Mu.LEVELS[lv].name) + "）：" + esc(HINT[lv]) + '</p><div class="ex-list" id="list"></div></div>' +
      '<div class="ex-print" id="prt"></div></div>'
    );
    const title = box.querySelector("#title");
    title.value = st.title;
    title.oninput = () => { st.title = title.value; save(); };
    const list = box.querySelector("#list");
    st.items.forEach((x, i) => {
      const row = el('<div class="ex-item"><span class="pic"></span><div><b>' + (i + 1) + ". " + esc(x.name) + "</b> <small>" + esc(sub(x)) + "</small>" +
        '<textarea aria-label="' + esc(x.name) + ' 的觀察筆記" placeholder="' + esc(HINT[lv]) + '"></textarea>' +
        '<div class="row"><button class="btn" data-a="up" aria-label="往前移">⬆</button><button class="btn" data-a="down" aria-label="往後移">⬇</button>' +
        '<a class="btn" href="' + Mu.spPage(x) + '" target="_blank" rel="noopener">看介紹</a><button class="btn danger" data-a="del">移除</button></div></div></div>');
      row.querySelector(".pic").replaceWith(Mu.photo(item(x)));
      const ta = row.querySelector("textarea");
      ta.value = x.note || "";
      ta.oninput = () => { x.note = ta.value; save(); };
      row.querySelectorAll("[data-a]").forEach((b) => (b.onclick = async () => {
        const a = b.dataset.a;
        if (a === "up" && i > 0) [st.items[i - 1], st.items[i]] = [st.items[i], st.items[i - 1]];
        else if (a === "down" && i < st.items.length - 1) [st.items[i + 1], st.items[i]] = [st.items[i], st.items[i + 1]];
        else if (a === "del") {
          if (x.note && !(await Mu.dialog("「" + x.name + "」的觀察筆記已經寫了字，確定要移除嗎？", [{ label: "取消", value: false }, { label: "移除", value: true, danger: true }]))) return;
          st.items.splice(i, 1);
        } else return;
        save(); draw();
      }));
      list.appendChild(row);
    });
    box.querySelector("#show").onclick = () => show(0);
    box.querySelector("#print").onclick = () => printCards(box.querySelector("#prt"));
    box.querySelector("#clear").onclick = async () => {
      if (await Mu.dialog("確定要清空整本小圖鑑嗎？寫好的觀察筆記也會一起刪除，無法復原。", [{ label: "取消", value: false }, { label: "清空", value: true, danger: true }])) {
        st = { title: "我的昆蟲小圖鑑", items: [] }; save(); draw();
      }
    };
    root.replaceChildren(box);
  }

  // 列印：每種一張圖鑑卡（照片、名稱、分類、學生寫的筆記），等照片載完才印
  async function printCards(prt) {
    prt.innerHTML = '<h2 style="grid-column:1/-1">' + esc(st.title) + "</h2>" + st.items.map((x) =>
      '<div class="ex-card">' + (x.img ? '<img src="' + esc(Mu.imgUrl(x.img, true)) + '" alt="">' : "") + "<h3>" + esc(x.name) + "</h3><small>" + esc(sub(x)) + "</small>" +
      '<p style="white-space:pre-line">' + esc(x.note || "") + '</p><small>作者：＿＿＿＿＿＿　照片來源：iNaturalist（作者與授權見昆蟲探險家小百科）</small></div>').join("");
    const imgs = [...prt.querySelectorAll("img")].filter((i) => !i.complete);
    await Promise.all(imgs.map((i) => new Promise((r) => { i.addEventListener("load", r); i.addEventListener("error", r); })));
    window.print();
  }

  // 投影發表：全螢幕一種一頁，← → 鍵或按鈕換頁，Esc 離開
  function show(i) {
    const ov = el('<div class="show" role="dialog" aria-label="投影發表"><div class="slide" id="sl"></div><div class="bar2"><button class="btn" id="pv">◀ 上一種</button><span id="pg"></span><button class="btn" id="nx">下一種 ▶</button><button class="btn" id="cl">離開 ✕</button></div></div>');
    document.body.appendChild(ov);
    const drawSlide = () => {
      const x = st.items[i];
      const s = el('<div class="slide" id="sl"><span class="pic"></span><div><p style="font-size:1.1rem;opacity:.7;margin:0">' + esc(st.title) + "</p><h2>" + esc(x.name) + '</h2><p style="opacity:.8">' + esc(sub(x)) + "</p><p>" + esc(x.note || "（還沒寫觀察筆記）") + "</p></div></div>");
      s.querySelector(".pic").replaceWith(Mu.photo(item(x), true));
      ov.querySelector("#sl").replaceWith(s);
      ov.querySelector("#pg").textContent = i + 1 + " / " + st.items.length;
    };
    const go = (d) => { i = Math.max(0, Math.min(st.items.length - 1, i + d)); drawSlide(); };
    const key = (e) => { if (e.key === "ArrowRight") go(1); else if (e.key === "ArrowLeft") go(-1); else if (e.key === "Escape") close(); };
    function close() {
      document.removeEventListener("keydown", key);
      ov.remove();
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    }
    ov.querySelector("#pv").onclick = () => go(-1);
    ov.querySelector("#nx").onclick = () => go(1);
    ov.querySelector("#cl").onclick = close;
    document.addEventListener("keydown", key);
    if (ov.requestFullscreen) ov.requestFullscreen().catch(() => {});
    drawSlide();
  }

  document.addEventListener("mu-level", draw);
  draw();
});
