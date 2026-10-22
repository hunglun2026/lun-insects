/* 標本館探究：林試所昆蟲標本館的標本紀錄。主題或關鍵字 → 台灣縣市方塊地圖（顏色越深越多）、每十年長條、各目、最多的物種、國外標本；
   點縣市或年代列出那些標本。網址 ?q=、?ord=、?sp= 可以分享或從小百科連過來。
   探究問題只寫開放式提問，不在題目裡放事實當答案（避免網站寫錯的內容被當成標準答案）。 */
Mu.boot(function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const TOPICS = [
    ["全部標本", {}], ["🐝 虎頭蜂", { q: "虎頭蜂" }], ["🦋 蝴蝶和蛾", { ord: "Lepidoptera" }], ["🪲 甲蟲", { ord: "Coleoptera" }],
    ["🐝 蜂和螞蟻", { ord: "Hymenoptera" }], ["🦗 蝗蟲蟋蟀", { ord: "Orthoptera" }], ["🌲 福山", { q: "福山" }], ["⛰️ 合歡山", { q: "合歡山" }],
  ];
  const QUESTIONS = [
    "標本最多的縣市是哪裡？你覺得為什麼研究人員常去那裡採集？（想想森林、研究站、交通）",
    "哪個年代的標本最多？那段時間可能發生了什麼事，讓採集變多或變少？",
    "標本館裡「蝴蝶和蛾」特別多，可能跟採集的方法有關嗎？查查看什麼是「燈光誘集」。",
    "挑一種昆蟲，比較牠的標本採集地點和小百科裡的照片。牠喜歡住在什麼樣的環境？",
  ];
  const st = { p: {}, seq: 0 };

  $("topics").innerHTML = '<span class="lab">主題</span>' + TOPICS.map((t, i) => '<button class="chip" type="button" data-i="' + i + '">' + esc(t[0]) + "</button>").join("");
  $("topics").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { $("q").value = TOPICS[b.dataset.i][1].q || ""; go(TOPICS[b.dataset.i][1], b.textContent); }));
  $("f").onsubmit = (e) => { e.preventDefault(); const q = $("q").value.trim(); go(q ? { q } : {}, q ? "「" + q + "」" : "全部標本"); };

  const bars = (rows, label, max) => rows.map((r) => '<button class="hbar" type="button" data-k="' + esc(r.k) + '"><span class="hl">' + esc(label(r)) + '</span><span class="ht"><i style="width:' +
    Math.max(2, (r.n / max) * 100) + '%"></i></span><span class="hn">' + r.n.toLocaleString() + "</span></button>").join("");

  async function go(p, title) {
    st.p = p;
    $("topics").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(JSON.stringify(TOPICS[b.dataset.i][1]) === JSON.stringify(p))));
    history.replaceState(null, "", "?" + new URLSearchParams(p));
    const seq = ++st.seq;
    $("out").replaceChildren(el('<div class="loading">正在打開標本櫃…</div>'));
    let h;
    try { h = await Mu.api("/api/spec/stats", p); } catch (e) {
      $("out").replaceChildren(el('<div class="err">載入失敗，請檢查網路後再試一次。</div>'));
      return;
    }
    if (seq !== st.seq) return; // 連續換主題時只畫最新的
    if (!h.total) { $("out").replaceChildren(el('<p class="lead">標本館裡找不到' + esc(title) + "，換個詞試試看。</p>")); return; }
    const cmap = Object.fromEntries(h.counties.map((c) => [c.county, c.n]));
    const cmax = Math.max(...h.counties.map((c) => c.n), 1);
    const tw = h.counties.reduce((t, c) => t + c.n, 0);
    const topCounty = h.counties.slice().sort((a, b) => b.n - a.n)[0];
    const peak = h.decades.reduce((a, b) => (b.n > a.n ? b : a), { n: 0 });
    const dmax = Math.max(...h.decades.map((d) => d.n), 1);
    const omax = Math.max(...h.orders.map((o) => o.n), 1);
    const box = el(
      '<div><p class="count">' + esc(title) + "共 <b>" + h.total.toLocaleString() + "</b> 筆標本" + (topCounty ? "，台灣最多採自" + esc(topCounty.county) + "（" + topCounty.n.toLocaleString() + " 筆）" : "") +
      (peak.n ? "，最多的年代是 " + peak.decade + " 年代" : "") + "。點地圖或長條看那些標本。</p>" +
      '<div class="mus"><div><h2>在哪裡採到</h2><div class="tmap" id="map"></div><p class="credit">方塊位置是示意，不是比例地圖。灰色＝沒有紀錄；台灣標本共 ' + tw.toLocaleString() + " 筆有縣市。</p></div>" +
      '<div><h2>哪個年代採到</h2><div class="hist" id="dec">' + bars(h.decades.map((d) => ({ k: d.decade, n: d.n })), (r) => r.k + " 年代", dmax) + "</div></div></div>" +
      '<h2>是哪些昆蟲</h2><div class="hist" id="ord">' + bars(h.orders.map((o) => ({ k: o.ord || "", n: o.n })), (r) => (r.k ? Mu.ordName(r.k) : "只鑑定到更高的分類"), omax) + "</div>" +
      (h.top.length ? "<h2>標本最多的 10 種</h2><div class=\"alist\">" + h.top.map((t) => (t.sp ? '<a class="arow" href="/sp#' + t.sp + '">' : '<div class="arow">') +
        '<span class="y">' + t.n.toLocaleString() + " 筆</span><span><b>" + esc(t.zh || "（沒有中文名）") + "</b><br><small><i>" + esc(t.sci) + "</i>" + (t.sp ? "　看照片 ➜" : "") + "</small></span>" + (t.sp ? "</a>" : "</div>")).join("") + "</div>" : "") +
      (h.abroad.length ? "<h2>國外的標本</h2><p>" + h.abroad.map((a) => esc(a.country) + " " + a.n.toLocaleString() + " 筆").join("、") + "</p>" : "") +
      '<h2 id="lt" hidden></h2><div class="alist" id="docs"></div><p class="more"><button class="btn" id="more" hidden>載入更多</button></p>' +
      '<h2>探究問題</h2><div class="panel"><ol>' + QUESTIONS.map((q) => "<li>" + esc(q) + "</li>").join("") + "</ol>" +
      '<p class="noprint"><button class="btn" id="print">🖨️ 列印探究學習單</button></p></div></div>'
    );
    const map = box.querySelector("#map");
    Mu.TILES.forEach(([c, x, y]) => {
      const n = cmap[c] || 0;
      const t = el('<button type="button" class="tile" style="grid-column:' + x + ";grid-row:" + y + '"><b>' + esc(/^(新竹|嘉義)/.test(c) ? c : c.replace(/[縣市]$/, "")) + "</b><small>" + n.toLocaleString() + "</small></button>");
      // 顏色深淺用開根號，不然宜蘭一個縣就把其他縣市都壓成淺色
      if (n) t.style.setProperty("--a", (0.15 + 0.85 * Math.sqrt(n / cmax)).toFixed(2)); else t.classList.add("none");
      t.setAttribute("aria-label", c + " " + n + " 筆");
      t.onclick = () => list(box, { county: c }, c + "的標本");
      map.appendChild(t);
    });
    box.querySelectorAll("#dec .hbar").forEach((b) => (b.onclick = () => list(box, { dec: b.dataset.k }, b.dataset.k + "～" + (+b.dataset.k + 9) + " 年的標本")));
    box.querySelectorAll("#ord .hbar").forEach((b) => (b.onclick = () => b.dataset.k && list(box, { ord: b.dataset.k }, Mu.ordName(b.dataset.k) + "的標本")));
    box.querySelector("#print").onclick = () => window.print();
    $("out").replaceChildren(box);
  }

  // 列出標本：主題條件＋點的條件，30 筆一頁
  async function list(box, extra, title) {
    let after = 0;
    const p = Object.assign({}, st.p, extra);
    const docs = box.querySelector("#docs"), more = box.querySelector("#more"), lt = box.querySelector("#lt");
    lt.hidden = false;
    lt.textContent = title;
    docs.replaceChildren();
    const load = async () => {
      more.disabled = true;
      const r = await Mu.api("/api/specimens", Object.assign({ after }, p));
      r.items.forEach((s) => {
        const name = s.zh || s.raw || "未鑑定";
        const where = [s.country !== "台灣" ? s.country : "", s.county, s.place].filter(Boolean).join(" ");
        const row = el((s.sp ? '<a class="arow" href="/sp#' + s.sp + '">' : '<div class="arow">') + '<span class="y">' + (s.year || "年代未詳") + "</span><span><b>" + esc(name) + "</b>" +
          (s.zh && s.raw ? " <small><i>" + esc(s.raw) + "</i></small>" : "") + "<br><small>" + esc([where, s.who && "採集：" + s.who, "館號 " + s.no].filter(Boolean).join("｜")) + "</small></span>" + (s.sp ? "</a>" : "</div>"));
        docs.appendChild(row);
      });
      if (r.items.length) after = r.items[r.items.length - 1].n;
      more.hidden = r.items.length < 30;
      more.disabled = false;
    };
    more.onclick = load;
    await load();
    lt.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const u = new URLSearchParams(location.search);
  const p0 = {};
  ["q", "ord", "sp"].forEach((k) => u.get(k) && (p0[k] = u.get(k)));
  if (p0.q) $("q").value = p0.q;
  (async () => {
    let title = p0.q ? "「" + p0.q + "」" : p0.ord ? Mu.ordName(p0.ord) : "全部標本";
    if (p0.sp) { const s = await Mu.byId(p0.sp); title = s ? "「" + s.name + "」" : "這種昆蟲"; }
    go(p0, title);
  })();
});
