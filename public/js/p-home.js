/* 首頁（歡迎頁）：引導入口、捲動放大切換、捲到才浮現、數字跳動、今天的昆蟲盒。
   捲動切換照搬故宮探險家 p-home.js（原本參考 www.hunglun.com landing.js 的 tour-zoom）。樣式在 css/style.css 的「首頁」段。 */
(function () {
  "use strict";
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  // ---- 引導入口：身分 → 年級 → 推薦。身分記在這台裝置，年級就是全站難度（Mu.setLevel） ----
  const GKEY = "in-guide";
  const R = (href, ico, name, why) => ({ href, ico, name, why });
  const RECS = {
    student: {
      e: [R("/sp", "📖", "昆蟲小百科", "有白話介紹，先挑一隻最喜歡的昆蟲"), R("/isinsect", "🕷️", "是不是昆蟲", "數數腳，分出蜘蛛和昆蟲")],
      j: [R("/classify", "🧩", "分類闖關", "看翅膀和身體分出是哪一目"), R("/guess", "🔍", "猜猜我是誰", "四選一，還有 60 秒挑戰")],
      s: [R("/guess", "🔍", "猜猜我是誰", "同一科的昆蟲來比，附學名")],
    },
    teacher: {
      e: [R("/teacher#guide", "📚", "課程包「什麼是昆蟲」", "40 分鐘流程，一鍵帶入學習單"), R("/isinsect", "🕷️", "是不是昆蟲", "投影全班搶答，不用每人一台"), R("/help", "📘", "使用說明", "三分鐘看懂每個工具怎麼用")],
      j: [R("/teacher#guide", "📚", "課程包「昆蟲的一生」「昆蟲分類」", "40 分鐘流程，一鍵帶入學習單")],
      s: [R("/teacher#guide", "📚", "課程包「昆蟲分類」", "40 分鐘流程，一鍵帶入學習單"), R("/guess", "🔍", "猜猜我是誰", "投影全班搶答，不用每人一台")],
    },
  };
  const WHO = { student: "學生", teacher: "老師" };
  const guide = document.getElementById("start");
  const steps = guide ? [...guide.querySelectorAll(".g-step")] : [];
  let who = null;
  try { who = (JSON.parse(localStorage.getItem(GKEY) || "{}").who) || null; } catch (e) { /* 無痕模式 */ }
  if (!WHO[who]) who = null;

  function show(name) {
    steps.forEach((s) => (s.hidden = s.dataset.step !== name));
  }
  function done() {
    const lv = Mu.level();
    document.getElementById("g-who").textContent = WHO[who] + "・" + Mu.LEVELS[lv].name;
    const box = document.getElementById("g-recs");
    box.innerHTML = RECS[who][lv].map((r) =>
      '<a class="tool" href="' + r.href + '"><div class="ico">' + r.ico + "</div><h3>" + Mu.esc(r.name) + '</h3><span class="why">' + Mu.esc(r.why) + "</span></a>").join("");
    show("done");
  }
  if (guide) {
    const pick = (w) => {
      who = w;
      try { localStorage.setItem(GKEY, JSON.stringify({ who })); } catch (e) { /* 忽略 */ }
      document.getElementById("g-lvq").textContent = who === "teacher" ? "你教幾年級？" : "你幾年級？";
      guide.querySelectorAll("[data-lv]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.lv === Mu.level())));
      show("lv");
    };
    guide.querySelectorAll("[data-who]").forEach((b) => (b.onclick = () => pick(b.dataset.who)));
    // 開場的「我是學生」「我是老師」：直接選好身分，捲到引導區問年級（沒有 JS 時就只是連到 #start）
    document.querySelectorAll("[data-pick]").forEach((a) => (a.onclick = (e) => {
      e.preventDefault();
      pick(a.dataset.pick);
      guide.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }));
    guide.querySelectorAll("[data-lv]").forEach((b) => (b.onclick = () => {
      Mu.setLevel(b.dataset.lv);
      const sel = document.getElementById("lvl");
      if (sel) sel.value = b.dataset.lv; // 頁首的難度選單跟著換
      done();
    }));
    guide.querySelector("[data-back]").onclick = () => show("who");
    guide.querySelector("[data-reset]").onclick = () => {
      who = null;
      try { localStorage.removeItem(GKEY); } catch (e) { /* 忽略 */ }
      show("who");
    };
    document.addEventListener("mu-level", () => { if (who && !guide.querySelector('[data-step="done"]').hidden) done(); });
    if (who) done();
  }

  // ---- 捲動放大切換：區塊高度＝張數 × 85vh，畫面固定，捲動進度決定現在顯示哪一個展示框 ----
  const tour = document.getElementById("tour");
  const panels = tour ? [...tour.querySelectorAll(".w-panel")] : [];
  const n = panels.length;
  const dotsBox = tour && tour.querySelector(".w-dots");
  const dots = panels.map((p, i) => {
    const b = document.createElement("button");
    b.setAttribute("aria-label", "跳到第 " + (i + 1) + " 個");
    b.tabIndex = -1; // 鍵盤使用者直接用每個展示框的按鈕，不用跳過一排圓點
    b.onclick = () => {
      const top = tour.getBoundingClientRect().top + scrollY;
      scrollTo({ top: top + (tour.offsetHeight - innerHeight) * (i / Math.max(n - 1, 1)), behavior: reduce ? "auto" : "smooth" });
    };
    if (dotsBox) dotsBox.appendChild(b);
    return b;
  });
  if (tour) tour.style.setProperty("--n", n);
  const parts = panels.map((el) => ({ txt: el.querySelector(".w-panel-text"), links: [...el.querySelectorAll("a")], img: el.querySelector("img") }));
  // 圖延後載入：8 個展示框疊在同一個固定畫面裡，瀏覽器的懶載入會以為都在畫面上而一次全抓；
  // 改成只載入目前這個和前後各一個。照片網址在資料載入後由 fillTour 放進 data-src
  function loadImg(i) {
    const im = parts[i] && parts[i].img;
    if (!im || !im.dataset.src) return;
    im.src = im.dataset.src;
    delete im.dataset.src;
  }
  let lastIndex = 0;
  function drawTour() {
    if (!tour || reduce) return;
    const rect = tour.getBoundingClientRect();
    const progress = clamp(-rect.top / Math.max(rect.height - innerHeight, 1), 0, 1);
    const cur = progress * Math.max(n - 1, 1);
    const index = Math.min(n - 1, Math.round(cur));
    lastIndex = index;
    if (rect.top < innerHeight * 1.5) [index - 1, index, index + 1, index + 2].forEach(loadImg); // 快捲到時才開始抓
    panels.forEach((el, i) => {
      const off = i - cur; // 負的＝已經看過（放大淡出），正的＝還沒輪到
      const opacity = off < 0 ? clamp(1 + 1.3 * off, 0, 1) : clamp(2 * (1 - off), 0, 1);
      const scale = off < 0 ? 1 - 0.4 * off : 1 - 0.1 * Math.min(off, 1);
      el.style.opacity = opacity;
      el.style.transform = "scale(" + scale + ")";
      el.style.zIndex = off >= 0 ? 10 - Math.ceil(off) : 20;
      el.style.pointerEvents = opacity > 0.85 ? "auto" : "none";
      parts[i].links.forEach((a) => (a.tabIndex = opacity > 0.85 ? 0 : -1));
      const txt = parts[i].txt;
      txt.style.transform = "translateY(" + 8 * off + "vh)";
      txt.style.opacity = clamp(1 - 1.7 * Math.abs(off), 0, 1);
    });
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
  }
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; drawTour(); });
  };
  addEventListener("scroll", onScroll, { passive: true });
  addEventListener("resize", onScroll);
  drawTour();

  // ---- 捲到才浮現 ----
  const reveals = document.querySelectorAll(".w-reveal");
  if (reduce || !("IntersectionObserver" in window)) reveals.forEach((el) => el.classList.add("in-view"));
  else {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("in-view"); io.unobserve(e.target); }
    }), { threshold: 0.15 });
    reveals.forEach((el) => io.observe(el));
  }

  // ---- 數字：等資料載入後換成真實數字，捲到時從 0 跳上去 ----
  function countUp(el, target) {
    if (reduce) { el.textContent = target.toLocaleString(); return; }
    const start = performance.now();
    const tick = (now) => {
      const t = clamp((now - start) / 1400, 0, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3))).toLocaleString();
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // 每個展示框放 data-ord 那一目最常見、有照片的昆蟲（_other＝不是昆蟲的）；減少動態效果時直接全部載入
  function fillTour(all) {
    panels.forEach((p, i) => {
      const fig = p.querySelector(".w-case");
      const ord = fig.dataset.ord;
      const sp = all.find((s) => (ord === "_other" ? s.kind === "other" : s.ord === ord) && s.img);
      if (!sp) return;
      parts[i].img.alt = sp.name;
      parts[i].img.dataset.src = Mu.imgUrl(sp.img, true);
      fig.querySelector("figcaption").textContent = sp.name + "．" + (sp.ordInfo ? sp.ordInfo.folk : sp.otherInfo ? sp.otherInfo.folk : "");
      fig.title = "照片：" + Mu.credit(sp);
    });
    if (reduce) panels.forEach((_, i) => { parts[i].img.loading = "lazy"; loadImg(i); });
    else [lastIndex - 1, lastIndex, lastIndex + 1].forEach(loadImg);
  }

  Mu.boot(async function (meta) {
    const all = await Mu.species();
    fillTour(all);
    const stats = { insects: meta.insects, specimens: meta.specimens, orders: new Set(all.map((s) => s.ord).filter(Boolean)).size, endemic: all.filter((s) => s.endemic).length };
    const nums = [...document.querySelectorAll("[data-w]")];
    nums.forEach((el) => (el.dataset.target = stats[el.dataset.w]));
    const box = document.querySelector(".w-stats");
    const run = () => nums.forEach((el) => countUp(el, +el.dataset.target));
    if (!box || reduce || !("IntersectionObserver" in window)) run();
    else {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) { run(); io.disconnect(); }
      }, { threshold: 0.4 });
      io.observe(box);
    }
    today(all);
  });

  // ---- 今天的昆蟲盒：從不同的目各抽一隻常見的（國小範圍），最後放一隻不是昆蟲的 ----
  function today(all) {
    const { esc, el, shuffle } = Mu;
    const box = document.getElementById("today");
    const byOrd = {};
    shuffle(all.filter((s) => s.kind === "insect" && s.lv === "e")).forEach((s) => (byOrd[s.ord] = byOrd[s.ord] || s));
    const picks = shuffle(Object.values(byOrd)).slice(0, 7).concat(shuffle(all.filter((s) => s.kind === "other")).slice(0, 1));
    picks.forEach((s) => {
      const a = el('<a class="acard" href="' + Mu.spPage(s) + '"><span class="pic"></span><div class="info"><b>' + esc(s.name) + "</b><small>" +
        esc(s.ordInfo ? s.ordInfo.folk : s.otherInfo ? s.otherInfo.folk + "（不是昆蟲）" : "") + "</small></div></a>");
      a.querySelector(".pic").replaceWith(Mu.photo(s));
      box.appendChild(a);
    });
  }
})();
