/* 搜尋：昆蟲與標本兩個分頁。昆蟲在瀏覽器裡比對（中文名、別名、學名、科名、目名），標本走 API 全文搜尋。
   網址帶 ?t=&q= 可以分享或從別頁連過來。 */
Mu.boot(async function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const u = new URLSearchParams(location.search);
  const st = { t: u.get("t") === "spec" ? "spec" : "sp", q: u.get("q") || "", after: 0, shown: 0, seq: 0, hits: [] };
  const HOT = { sp: ["獨角仙", "鳳蝶", "螢火蟲", "蟬", "鍬形蟲", "蜻蜓", "螳螂", "蜘蛛"], spec: ["虎頭蜂", "福山", "蘭嶼", "鍬形蟲", "天蛾", "Vespa", "合歡山", "1960"] };
  const all = await Mu.species();

  const tabs = document.querySelectorAll(".tab");
  function setTab(t) {
    st.t = t;
    tabs.forEach((x) => x.setAttribute("aria-selected", String(x.dataset.t === t)));
    $("q").placeholder = t === "sp" ? "例如：獨角仙、金龜、鳳蝶" : "例如：虎頭蜂、福山、採集者姓名";
    $("hot").innerHTML = '<span class="lab">試試看</span>' + HOT[t].map((w) => '<button class="chip" type="button">' + esc(w) + "</button>").join("");
    $("hot").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { $("q").value = b.textContent; go(); }));
  }
  tabs.forEach((b) => (b.onclick = () => { setTab(b.dataset.t); if ($("q").value.trim()) go(); }));

  // 昆蟲：每個字都要出現在名稱、別名、學名、科名或目名裡（空白隔開多個詞）
  function spHits(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const text = (s) => [s.zh, s.alt, s.sci, s.fam_zh, s.fam, s.ordInfo && s.ordInfo.zh, s.ordInfo && s.ordInfo.folk, s.otherInfo && s.otherInfo.folk].filter(Boolean).join(" ").toLowerCase();
    return all.filter((s) => { const t = text(s); return words.every((w) => t.includes(w)); })
      .sort((a, b) => (b.zh === q) - (a.zh === q) || (a.kind > b.kind) - (a.kind < b.kind) || (a.rank || 9e9) - (b.rank || 9e9));
  }
  function spCard(s) {
    const a = el('<a class="acard" href="' + Mu.spPage(s) + '"><span class="pic"></span><div class="info"><b>' + esc(s.name) + "</b><small>" +
      esc(s.ordInfo ? s.ordInfo.folk : s.otherInfo ? s.otherInfo.folk + "（不是昆蟲）" : "") + "</small></div></a>");
    a.querySelector(".pic").replaceWith(Mu.photo(s));
    return a;
  }
  function specRow(s) {
    const where = [s.country !== "台灣" ? s.country : "", s.county, s.place].filter(Boolean).join(" ");
    return el((s.sp ? '<a class="arow" href="/sp#' + s.sp + '">' : '<div class="arow">') + '<span class="y">' + (s.year || "年代未詳") + "</span><span><b>" + esc(s.zh || s.raw || "未鑑定") + "</b>" +
      (s.zh && s.raw ? " <small><i>" + esc(s.raw) + "</i></small>" : "") + "<br><small>" + esc([where, s.who && "採集：" + s.who, "館號 " + s.no].filter(Boolean).join("｜")) + "</small></span>" + (s.sp ? "</a>" : "</div>"));
  }

  async function load() {
    $("more").disabled = true;
    let box = $("out").firstElementChild;
    if (!box) { box = el('<div class="' + (st.t === "sp" ? "grid" : "alist") + '"></div>'); $("out").appendChild(box); }
    if (st.t === "sp") {
      st.hits.slice(st.shown, st.shown + 60).forEach((s) => box.appendChild(spCard(s)));
      st.shown = Math.min(st.hits.length, st.shown + 60);
      $("count").textContent = st.hits.length ? "找到 " + st.hits.length + " 種，常見的排前面（目前顯示 " + st.shown + " 種）" : "找不到「" + st.q + "」，換個詞或到「標本」分頁找找看。";
      $("more").hidden = st.shown >= st.hits.length;
    } else {
      const seq = ++st.seq; // 連續搜尋時舊請求可能比較晚回來，回來時已經不是最新的就丟掉
      const [r, h] = await Promise.all([Mu.api("/api/specimens", { q: st.q, after: st.after }), Mu.api("/api/spec/stats", { q: st.q })]);
      if (seq !== st.seq) return;
      r.items.forEach((s) => box.appendChild(specRow(s)));
      if (r.items.length) st.after = r.items[r.items.length - 1].n;
      const shown = box.children.length;
      $("count").innerHTML = h.total ? "找到 " + h.total.toLocaleString() + " 筆標本（目前顯示 " + shown + " 筆）。" +
        '<a href="/museum?q=' + encodeURIComponent(st.q) + '">看地圖和年代分布 →</a>' : "標本館裡找不到「" + esc(st.q) + "」，換個詞試試看。";
      $("more").hidden = r.items.length < 30;
    }
    $("more").disabled = false;
  }
  function go() {
    st.q = $("q").value.trim();
    st.after = 0; st.shown = 0;
    $("out").replaceChildren();
    history.replaceState(null, "", "?t=" + st.t + "&q=" + encodeURIComponent(st.q));
    if (!st.q) { $("count").textContent = ""; $("more").hidden = true; return; }
    if (st.t === "sp") st.hits = spHits(st.q);
    load();
  }
  $("f").onsubmit = (e) => { e.preventDefault(); go(); };
  $("more").onclick = load;

  setTab(st.t);
  $("q").value = st.q;
  if (st.q) go();
});
