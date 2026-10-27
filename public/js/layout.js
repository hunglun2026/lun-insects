/* 頁首（導覽列＋難度切換）、頁尾（授權標示）與頁面啟動器。每頁 <body data-page="..."> 決定導覽列亮哪一個。 */
(function () {
  "use strict";
  const NAV = [
    ["sp", "小百科", "/sp"],
    ["search", "搜尋", "/search"],
    ["guess", "猜我是誰", "/guess"],
    ["classify", "分類闖關", "/classify"],
    ["isinsect", "是不是昆蟲", "/isinsect"],
    ["memory", "翻牌", "/memory"],
    ["stages", "變態排排站", "/stages"],
    ["months", "幾月看得到", "/months"],
    ["museum", "標本館", "/museum"],
    ["book", "小圖鑑", "/book"],
    ["passport", "護照", "/passport"],
    ["teacher", "老師專區", "/teacher"],
    ["help", "使用說明", "/help"],
  ];
  const page = document.body.dataset.page || "";
  const wrap = document.createElement("div");
  wrap.className = "wrap";
  const main = document.querySelector("main");
  main.before(wrap);
  const lv = Mu.level();
  wrap.innerHTML =
    '<header class="top"><a class="logo" href="/">🐞 昆蟲探險家</a><nav aria-label="主選單">' +
    NAV.map((n) => '<a href="' + n[2] + '"' + (n[0] === page ? ' aria-current="page"' : "") + ">" + n[1] + "</a>").join("") +
    '</nav><label class="lvl">難度<select id="lvl" aria-label="題目難度">' +
    Object.entries(Mu.LEVELS).map(([k, v]) => '<option value="' + k + '"' + (k === lv ? " selected" : "") + ">" + v.name + "</option>").join("") +
    "</select></label></header>";
  wrap.appendChild(main);
  wrap.querySelector("#lvl").onchange = (e) => Mu.setLevel(e.target.value);

  // 授權標示：林試所標本資料依政府資料開放授權條款；照片逐張標作者與 CC 授權（詳情頁、學習單都有）；TaiCOL 名錄 CC BY 4.0
  const foot = document.createElement("footer");
  foot.className = "foot";
  foot.innerHTML =
    "<div class=\"foot-brand\"><img src=\"/img/hunglun-logo.webp\" alt=\"鴻綸科技\" width=\"156\" height=\"56\"></div>" +
    "<p class=\"foot-links\"><a href=\"/open-data\">資料開放宣告</a><a href=\"/privacy\">隱私權及資訊安全政策</a></p>" +
    "<p class=\"foot-copy\">本站資料由政府單位開放資料取得，鴻綸科技利用這些資料製作本站。本站程式、介面設計與整理編排 © 2026 鴻綸科技股份有限公司 版權所有，未經書面同意，不得轉載、複製、改作或仿製。</p>" +
    '<p id="data-stamp" hidden></p>';
  wrap.appendChild(foot);

  // Mu.boot(fn)：載入 meta 後呼叫 fn(meta)，處理載入中與失敗畫面
  window.Mu.boot = async function (fn) {
    main.insertAdjacentHTML("beforeend", '<div class="loading" id="boot">正在打開昆蟲盒…🐞</div>');
    try {
      const meta = await Mu.loadMeta();
      document.getElementById("boot").remove();
      document.getElementById("data-stamp").textContent =
        "目前收錄昆蟲 " + meta.insects.toLocaleString() + " 種（另有 " + meta.others + " 種不是昆蟲的節肢動物）、林試所標本 " + meta.specimens.toLocaleString() +
        " 筆。資料匯入日期：" + String(meta.importedAt || "").slice(0, 10) + "。";
      document.querySelectorAll("[data-stat]").forEach((e) => {
        const v = meta[e.dataset.stat];
        if (v != null) e.textContent = Number(v).toLocaleString();
      });
      await fn(meta);
      // 量「畫面可以操作」的時間用：測試腳本讀 <html data-ready>（毫秒）
      performance.mark("mu-ready");
      document.documentElement.dataset.ready = Math.round(performance.now());
    } catch (e) {
      console.error(e);
      const b = document.getElementById("boot");
      if (b) { b.className = "err"; b.innerHTML = '資料載入失敗了。請檢查網路後重新整理。<br><button class="btn" onclick="location.reload()">重新整理</button>'; }
    }
  };
})();
