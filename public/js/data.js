/* 昆蟲探險家：共用資料層。所有頁面先載入這支，再各自畫畫面。
   負責：向 API 拿資料（物種約 1,700 種一次載完，在瀏覽器裡篩選出題；標本 14.8 萬筆才走 API）、目名表、三級難度、照片、範本白話句、小工具與自製對話框。 */
(function () {
  "use strict";

  // ---- 目名表：唯一來源是 data/orders.json，經 /api/meta 拿到（Mu.ORDERS、Mu.ORDER） ----
  let ORDERS = [];
  let ORDER = {};
  const META_TYPE = {
    full: { name: "完全變態", steps: ["卵", "幼蟲", "蛹", "成蟲"], hint: "小時候和長大後長得完全不一樣，中間要經過「蛹」" },
    half: { name: "不完全變態", steps: ["卵", "若蟲", "成蟲"], hint: "小時候（若蟲）就長得有點像成蟲，沒有「蛹」，脫幾次皮就長大" },
    none: { name: "無變態", steps: ["卵", "幼體", "成蟲"], hint: "從小到大樣子幾乎不變，只是越長越大，一輩子都沒有翅膀" },
  };

  // ---- 不是昆蟲的節肢動物（「是不是昆蟲」用）。鍵跟 tools/fetch_data.py 的 OTHERS 一致 ----
  const OTHER = {
    Arachnida: { zh: "蛛形綱", folk: "蜘蛛、蠍子、蟎和盲蛛", emoji: "🕷️", why: "有 8 隻腳、沒有觸角" },
    Chilopoda: { zh: "唇足綱", folk: "蜈蚣", emoji: "🐛", why: "身體有很多節，每一節有一對腳" },
    Diplopoda: { zh: "倍足綱", folk: "馬陸", emoji: "🐛", why: "身體有很多節，大部分的節有兩對腳" },
    Isopoda: { zh: "等足目", folk: "鼠婦和海蟑螂", emoji: "🦐", why: "是甲殼類，跟蝦子、螃蟹是親戚，有 14 隻腳" },
  };
  const INSECT_RULE = "昆蟲的身體分成頭、胸、腹三段，有 6 隻腳和一對觸角，很多種類有翅膀";

  // ---- 三個年級（跟動物探險家一樣：低、中、高年級）。低年級最簡單且有注音；高年級最難也只到原本的國中程度。存在 localStorage，頁首可切換。物種的 lv 是「最早在哪個難度出現」（越常見越早） ----
  const LEVELS = {
    e: { name: "低年級", choices: 3, rank: 0 },
    j: { name: "中年級", choices: 3, rank: 1 },
    s: { name: "高年級", choices: 4, rank: 1 },
  };
  const LKEY = "in-level";
  function level() {
    try { const v = localStorage.getItem(LKEY); if (LEVELS[v]) return v; } catch (e) { /* 無痕模式 */ }
    return "e";
  }
  function setLevel(v) {
    try { localStorage.setItem(LKEY, v); } catch (e) { /* 忽略 */ }
    document.dispatchEvent(new CustomEvent("mu-level", { detail: v }));
  }
  const inLevel = (sp, lv) => !!sp.lv && LEVELS[sp.lv].rank <= LEVELS[lv || level()].rank;
  // 分類闖關考哪些目：orders.json 的 lv 欄，而且出題池裡要有 2 種以上（物種載入後才知道，所以用 species() 算好的 ordCount）
  let ordCount = null;
  const ordersFor = (lv) => ORDERS.filter((o) => o.lv && LEVELS[o.lv].rank <= LEVELS[lv || level()].rank && (!ordCount || (ordCount[o.id] || 0) >= 2));

  // ---- API：同一頁面同一網址只抓一次；m 帶 meta 的照片數，照片上傳後快取鍵就換新 ----
  const memo = new Map();
  let meta = null;
  async function api(path, params) {
    const q = new URLSearchParams(params || {});
    for (const [k, v] of [...q]) if (v === "" || v == null) q.delete(k);
    if (meta && path !== "/api/meta") q.set("m", meta.photos);
    const url = path + (q.toString() ? "?" + q : "");
    if (memo.has(url)) return memo.get(url);
    const p = fetch(url).then((r) => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
    memo.set(url, p);
    p.catch(() => memo.delete(url));
    return p;
  }
  async function loadMeta() {
    meta = await api("/api/meta");
    ORDERS = meta.orders || [];
    ORDER = Object.fromEntries(ORDERS.map((o) => [o.id, o]));
    return meta;
  }

  // 全部物種（有照片的出題池），enrich 過；list() 再依條件篩
  let all = null;
  async function species() {
    if (!all) all = api("/api/species").then((r) => {
      const list = r.items.map(enrich);
      ordCount = {};
      list.forEach((x) => x.ord && (ordCount[x.ord] = (ordCount[x.ord] || 0) + 1));
      return list;
    });
    return all;
  }
  async function byId(id) {
    return (await species()).find((s) => s.id === +id) || null;
  }

  function enrich(sp) {
    if (!sp || sp._ok) return sp;
    sp._ok = true;
    sp.name = sp.zh || sp.sci;
    sp.ordInfo = ORDER[sp.ord] || null;
    sp.otherInfo = sp.kind === "other" ? OTHER[sp.grp] || null : null;
    sp.emoji = sp.ordInfo ? sp.ordInfo.emoji : sp.otherInfo ? sp.otherInfo.emoji : "🐞";
    return sp;
  }

  // ---- 照片：本站 R2（iNaturalist 可商用授權照片，縮成 600／240） ----
  const imgUrl = (k, big) => (k ? "/img/" + (big ? 600 : 240) + "/" + k + ".webp" : "");
  function placeholder(sp, cls) {
    const d = document.createElement("div");
    d.className = "ph " + (cls || "");
    d.innerHTML = '<span aria-hidden="true">' + ((sp && sp.emoji) || "🐞") + "</span><small>照片整理中</small>";
    d.setAttribute("role", "img");
    d.setAttribute("aria-label", (sp && sp.name) || "昆蟲");
    return d;
  }
  // photo(sp, big, cls, key)：key 可指定別張照片（詳情頁的其他照片、成長階段照片）
  function photo(sp, big, cls, key) {
    const k = key || (sp.photo !== 0 && sp.img);
    if (!k) return placeholder(sp, cls);
    const img = new Image();
    img.className = "photo " + (cls || "");
    img.loading = "lazy";
    img.decoding = "async";
    img.alt = sp.name || "";
    img.src = imgUrl(k, big);
    img.onerror = () => img.replaceWith(placeholder(sp, cls));
    return img;
  }
  // 照片授權標示：「(c) 某某, some rights reserved (CC BY)」這類原文照 iNaturalist 的寫法
  const LIC = { cc0: "CC0", "cc-by": "CC BY 4.0", "cc-by-sa": "CC BY-SA 4.0" };
  const credit = (p) => (p ? (p.by || "").replace(/, uploaded by .*$/, "") + "（" + (LIC[p.lic] || p.lic) + "），經 iNaturalist" : "");

  // ---- 月份：iNaturalist 台灣研究級觀察的每月筆數 ----
  // 最常被看到的月份：筆數 ≥ 最多那個月的一半，回傳月份陣列（1～12）
  function peakMonths(sp) {
    const m = sp.months || [];
    const max = Math.max(...m, 0);
    if (!max) return [];
    return m.map((v, i) => (v >= max / 2 ? i + 1 : 0)).filter(Boolean);
  }
  // [3,4,5,9] → 「3～5 月、9 月」
  function monthText(list) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      let j = i;
      while (j + 1 < list.length && list[j + 1] === list[j] + 1) j++;
      out.push(j > i ? list[i] + "～" + list[j] + " 月" : list[i] + " 月");
      i = j;
    }
    return out.join("、");
  }
  const topMonth = (sp) => { const m = sp.months || []; const max = Math.max(...m, 0); return max ? m.indexOf(max) + 1 : 0; };

  // ---- 範本白話句（不用 AI，不編造內容，只把資料欄位接成句子）----
  const PROT = { I: "第一級保育類（瀕臨絕種）", II: "第二級保育類（珍貴稀有）", III: "第三級保育類（其他應予保育）" };
  function plain(sp) {
    if (sp.kind === "other") {
      const g = sp.otherInfo || {};
      return "「" + sp.name + "」不是昆蟲，牠屬於" + (g.zh || "") + "（" + (g.folk || "") + "）。分辨的方法：牠" + (g.why || "") + "；" + INSECT_RULE + "。";
    }
    const o = sp.ordInfo;
    const parts = [];
    parts.push("「" + sp.name + "」是" + (o ? o.zh + "（" + o.folk + "）" : "") + "的昆蟲" + (sp.fam_zh ? "，屬於" + sp.fam_zh : "") + "。");
    if (o) parts.push(o.folk + "的特徵是：" + o.hint + "。");
    if (sp.endemic) parts.push("牠是台灣特有種，世界上只有台灣有。");
    if (sp.alien === "invasive") parts.push("牠原本不住在台灣，是從外地來的入侵種。");
    else if (sp.alien === "naturalized") parts.push("牠原本不住在台灣，是從外地來、已經在野外住下來的歸化種。");
    if (sp.prot && PROT[sp.prot]) parts.push("牠是" + PROT[sp.prot] + "，受法律保護，不可以隨便抓。");
    const pm = peakMonths(sp);
    if (pm.length && pm.length < 12) parts.push("在台灣，大家最常在 " + monthText(pm) + "看到牠。");
    if (o && META_TYPE[o.meta]) parts.push("牠的一生是「" + META_TYPE[o.meta].name + "」：" + META_TYPE[o.meta].steps.join("→") + "。");
    return parts.join("");
  }
  const spPage = (sp) => "/sp#" + sp.id;
  const ordName = (id, lv) => { const o = ORDER[id]; if (!o) return id || ""; return (lv || level()) === "e" ? o.folk : o.zh; };

  // ---- 台灣縣市方塊地圖（標本館探究用）：[縣市, 欄, 列]，是示意位置，不是比例地圖 ----
  const TILES = [
    ["連江縣", 1, 2], ["基隆市", 6, 1], ["台北市", 5, 1], ["新北市", 5, 2], ["桃園市", 4, 2], ["宜蘭縣", 6, 3],
    ["新竹市", 3, 3], ["新竹縣", 4, 3], ["苗栗縣", 4, 4], ["金門縣", 1, 5], ["台中市", 4, 5], ["花蓮縣", 5, 5],
    ["彰化縣", 3, 6], ["南投縣", 4, 6], ["雲林縣", 3, 7], ["嘉義縣", 4, 7], ["澎湖縣", 1, 8], ["嘉義市", 3, 8],
    ["台東縣", 5, 8], ["台南市", 3, 9], ["高雄市", 4, 9], ["屏東縣", 4, 10],
  ];

  // ---- 小工具 ----
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const pick = (arr, n) => shuffle(arr).slice(0, n);
  // el(html)：HTML 字串轉成「單一」元素。多個頂層元素要自己包一層 <div>
  const el = (html) => {
    const t = document.createElement("template");
    t.innerHTML = html.trim();
    if (t.content.children.length > 1) console.warn("Mu.el：HTML 有多個頂層元素，只會用第一個", html.slice(0, 60));
    return t.content.firstElementChild;
  };

  // 自製確認對話框（不用瀏覽器內建的 alert／confirm）
  function dialog(message, buttons) {
    return new Promise((resolve) => {
      const d = document.createElement("dialog");
      d.className = "zdlg";
      d.innerHTML = "<p>" + esc(message) + '</p><div class="row"></div>';
      (buttons || [{ label: "好", value: true, primary: true }]).forEach((b) => {
        const btn = document.createElement("button");
        btn.className = "btn" + (b.primary ? " primary" : "") + (b.danger ? " danger" : "");
        btn.textContent = b.label;
        btn.onclick = () => { d.close(); d.remove(); resolve(b.value); };
        d.lastChild.appendChild(btn);
      });
      document.body.appendChild(d);
      d.showModal();
    });
  }

  window.Mu = {
    META_TYPE, OTHER, INSECT_RULE, LEVELS, level, setLevel, inLevel, ordersFor, api, loadMeta, species, byId, enrich,
    photo, imgUrl, placeholder, credit, peakMonths, monthText, topMonth, plain, spPage, ordName, TILES, PROT,
    esc, shuffle, pick, el, dialog,
    get meta() { return meta; },
    get ORDERS() { return ORDERS; },
    get ORDER() { return ORDER; },
  };
})();
