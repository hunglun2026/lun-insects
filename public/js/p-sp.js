/* 昆蟲小百科：依目與標籤篩選（全部物種已在瀏覽器裡，篩選不必再問伺服器）、一次列 60 種、#編號 開詳情對話框。
   詳情：多張照片與作者、中文名與別名、分類、變態方式、保育與紅皮書、每月觀察長條、林試所標本、白話介紹。 */
Mu.boot(async function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const all = await Mu.species();
  const st = { ord: "", tag: "", shown: 0 };
  const RED = { NCR: "極危", NEN: "瀕危", NVU: "易危", NNT: "接近受脅", NLC: "暫無危機", NDD: "資料缺乏" };
  const TAGS = [["", "全部"], ["endemic", "🏝️ 台灣特有種"], ["prot", "🛡️ 保育類"], ["alien", "✈️ 外來種"], ["spec", "🗄️ 標本館有標本"]];
  const tagOk = { "": () => true, endemic: (s) => s.endemic, prot: (s) => !!s.prot, alien: (s) => s.alien === "invasive" || s.alien === "naturalized", spec: (s) => s.spec > 0 };

  function chips(box, list, key, label) {
    box.innerHTML = label ? '<span class="lab">' + label + "</span>" : "";
    list.forEach(([id, name]) => {
      const b = el('<button class="chip" aria-pressed="' + (st[key] === id) + '">' + esc(name) + "</button>");
      b.onclick = () => { st[key] = id; box.querySelectorAll(".chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); reset(); };
      box.appendChild(b);
    });
  }
  // 只列有物種的目，依物種數排序；最後加「不是昆蟲」
  const cnt = {};
  all.forEach((s) => (cnt[s.ord || "_other"] = (cnt[s.ord || "_other"] || 0) + 1));
  const ordList = Mu.ORDERS.filter((o) => cnt[o.id]).sort((a, b) => cnt[b.id] - cnt[a.id]).map((o) => [o.id, o.emoji + " " + o.folk]);
  // 網址 ?ord=Coleoptera 可以直接篩選（首頁、課程包會連過來）；要在畫篩選鈕之前設好，按鈕才會亮對
  const o0 = new URLSearchParams(location.search).get("ord");
  if (o0 && (Mu.ORDER[o0] || o0 === "_other")) st.ord = o0;
  chips($("ords"), [["", "全部"]].concat(ordList, [["_other", "🕷️ 不是昆蟲"]]), "ord", "類別");
  chips($("tags"), TAGS, "tag", "標籤");

  function list() {
    return all.filter((s) => (!st.ord || (st.ord === "_other" ? s.kind === "other" : s.ord === st.ord)) && tagOk[st.tag](s));
  }
  function card(s) {
    const c = el('<button class="acard"><span class="pic"></span><div class="info"><b>' + esc(s.name) + '</b><div class="meta">' +
      (s.ordInfo ? '<span class="tag2">' + esc(s.ordInfo.folk) + "</span>" : s.otherInfo ? '<span class="tag2">' + esc(s.otherInfo.folk) + "</span>" : "") +
      (s.endemic ? '<span class="tag2 hot">特有</span>' : "") + (s.prot ? '<span class="tag2 hot">保育</span>' : "") + "</div></div></button>");
    c.querySelector(".pic").replaceWith(Mu.photo(s));
    c.onclick = () => (location.hash = s.id);
    return c;
  }
  function more() {
    const l = list();
    l.slice(st.shown, st.shown + 60).forEach((s) => $("grid").appendChild(card(s)));
    st.shown = Math.min(l.length, st.shown + 60);
    $("more").hidden = st.shown >= l.length;
    $("count").textContent = l.length ? "共 " + l.length + " 種，越常見的排越前面（目前顯示 " + st.shown + " 種）" : "這個條件沒有昆蟲，換一個試試看。";
  }
  function reset() { st.shown = 0; $("grid").replaceChildren(); more(); }
  $("more").onclick = more;

  // ---- 詳情 ----
  function monthBars(m) {
    const max = Math.max(...m, 1);
    return '<div class="mbars" role="img" aria-label="每月觀察筆數">' + m.map((v, i) =>
      '<span title="' + (i + 1) + " 月：" + v + ' 筆"><i style="height:' + Math.max(2, (v / max) * 100) + '%"></i><small>' + (i + 1) + "</small></span>").join("") + "</div>";
  }
  async function open(id) {
    const r = await Mu.api("/api/sp/" + id);
    if (!r.item) return;
    const s = Object.assign(Mu.enrich(r.item), { photo: 1 });
    Progress.seen(s);
    const o = s.ordInfo;
    const mt = o && Mu.META_TYPE[o.meta];
    const photos = (s.photos || []).filter((p) => p.k);
    const facts = [
      ["學名", "<i>" + esc(s.sci) + "</i>"],
      s.alt ? ["別名", esc(s.alt)] : null,
      o ? ["分類", esc(o.zh + "（" + o.folk + "）") + (s.fam ? "・" + esc(s.fam_zh || s.fam) : "")] : s.otherInfo ? ["分類", esc(s.otherInfo.zh + "（" + s.otherInfo.folk + "），不是昆蟲")] : null,
      mt ? ["一生的變化", esc(mt.name + "：" + mt.steps.join("→"))] : null,
      s.endemic ? ["台灣特有種", "世界上只有台灣有"] : null,
      s.alien === "invasive" ? ["外來種", "入侵種，原本不住在台灣"] : s.alien === "naturalized" ? ["外來種", "歸化種，原本不住在台灣"] : null,
      s.prot ? ["保育類", esc(Mu.PROT[s.prot] || s.prot)] : null,
      RED[s.red] ? ["臺灣紅皮書", esc(RED[s.red]) + "（" + esc(s.red) + "）"] : null,
      ["台灣觀察紀錄", s.obs.toLocaleString() + " 筆（iNaturalist 研究級）"],
    ].filter(Boolean);
    const stages = s.stages ? ["Egg", "Larva", "Nymph", "Pupa", "Adult"].filter((k) => s.stages[k]) : [];
    const STAGE = { Egg: "卵", Larva: "幼蟲", Nymph: "若蟲", Pupa: "蛹", Adult: "成蟲" };
    const sp = r.spec || {};
    const box = el(
      '<div><div class="dlg-bar"><button class="btn" id="x">關閉 ✕</button></div><div class="detail"><div><div id="big"></div><p class="credit" id="cr"></p><div class="thumbs" id="th"></div></div><div>' +
      '<h2 style="margin-top:0">' + esc(s.name) + "</h2>" +
      (s.ai_text
        ? '<div class="plain">' + esc(s.ai_text) + '<br><small class="credit">AI 依' + (s.ai_src ? '<a href="' + esc(s.ai_src) + '" target="_blank" rel="noopener">維基百科條目</a>' : "維基百科") + "改寫（CC BY-SA 4.0），已查核</small></div>"
        : '<p class="plain">' + esc(Mu.plain(s)) + "</p>") +
      '<div class="facts">' + facts.map((f) => '<div class="fact"><h4>' + esc(f[0]) + "</h4><p>" + f[1] + "</p></div>").join("") + "</div>" +
      (s.months ? "<h3>每個月有多少人看到牠</h3>" + monthBars(s.months) : "") +
      (stages.length ? '<h3>牠的成長過程</h3><div class="stg" id="stg"></div>' : "") +
      (s.spec ? "<h3>林試所標本館</h3><p>有 <b>" + s.spec + "</b> 件標本" + (sp.y0 ? "，採集年代 " + sp.y0 + (sp.y1 !== sp.y0 ? "～" + sp.y1 : "") + " 年" : "") +
        (sp.counties && sp.counties.length ? "，最多採自" + sp.counties.slice(0, 3).map((c) => esc(c.county) + " " + c.n + " 件").join("、") : "") +
        '。<a href="/museum?sp=' + s.id + '">到標本館探究看分布 →</a></p>' : "") +
      '<p><button class="btn primary" id="bk"></button> <a class="btn" href="https://www.inaturalist.org/taxa/' + s.id + '" target="_blank" rel="noopener">iNaturalist ↗</a>' +
      (s.taicol ? ' <a class="btn" href="https://taicol.tw/zh-hant/taxon/' + esc(s.taicol) + '" target="_blank" rel="noopener">臺灣物種名錄 ↗</a>' : "") + "</p>" +
      '<p class="credit">中文名、保育等級：臺灣物種名錄 TaiCOL（CC BY 4.0）。照片與每月筆數：iNaturalist。</p>' +
      "</div></div></div>"
    );
    // 照片：大圖＋縮圖，點縮圖換大圖與作者標示
    const show = (p) => {
      box.querySelector("#big").replaceChildren(Mu.photo(s, true, "xl", p.k));
      box.querySelector("#cr").textContent = "照片：" + Mu.credit(p);
      box.querySelectorAll(".thumbs button").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.k === p.k)));
    };
    if (photos.length > 1) photos.forEach((p, i) => {
      const b = el('<button type="button" aria-label="第 ' + (i + 1) + ' 張照片"></button>');
      b.dataset.k = p.k;
      b.appendChild(Mu.photo(s, false, "", p.k));
      b.onclick = () => show(p);
      box.querySelector("#th").appendChild(b);
    });
    if (photos.length) show(photos[0]); else box.querySelector("#big").appendChild(Mu.placeholder(s, "xl"));
    stages.forEach((k) => {
      const f = el('<figure><span class="pic"></span><figcaption>' + STAGE[k] + "</figcaption></figure>");
      f.querySelector(".pic").replaceWith(Mu.photo(s, false, "", s.stages[k].k));
      f.title = "照片：" + Mu.credit(s.stages[k]);
      box.querySelector("#stg").appendChild(f);
    });
    $("dlgIn").replaceChildren(box);
    box.querySelector("#x").onclick = () => $("dlg").close();
    const bk = box.querySelector("#bk");
    const bkLabel = () => (bk.textContent = Book.has(s.id) ? "✓ 已在我的小圖鑑" : "📚 加入我的小圖鑑");
    bkLabel();
    bk.onclick = async () => {
      const res = Book.add(s);
      if (res === "full") await Mu.dialog("小圖鑑最多放 " + Book.MAX + " 種，先到「我的小圖鑑」拿掉幾種再加。");
      else if (res === "added") Fx.right();
      bkLabel();
    };
    if (!$("dlg").open) $("dlg").showModal();
  }
  $("dlg").addEventListener("close", () => { if (location.hash) history.replaceState(null, "", location.pathname + location.search); });
  const fromHash = () => { const n = parseInt(location.hash.slice(1), 10); if (n) open(n); };
  window.addEventListener("hashchange", fromHash);

  reset();
  fromHash();
});
