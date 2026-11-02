/* 通用歡迎頁互動：問候語、滑鼠視差、選年級（存進站內用的 localStorage 鍵）。
   沒有內嵌腳本、沒有 onclick，符合嚴格的內容安全政策。 */
(function () {
  "use strict";
  var body = document.body;

  // 歡迎頁當首頁時，帶參數的連結（例如老師的班級連結 /#grade=low&fresh=1）要原樣交給舊首頁處理，不然參數會遺失
  var home = body.getAttribute("data-home");
  if (home && location.hash.length > 1) { location.replace(home + location.hash); return; }

  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 依本機時間問候
  var greet = document.querySelector("[data-greet]");
  if (greet) {
    var h = new Date().getHours();
    var word = h < 5 ? "夜深了" : h < 11 ? "早安" : h < 14 ? "午安" : h < 18 ? "下午好" : "晚安";
    greet.textContent = word + "，小探險家";
  }

  // 滑鼠視差：只在有精準指標且沒要求減少動態時啟用，rAF 節流
  if (!reduce && window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    var raf = 0, nx = 0, ny = 0;
    window.addEventListener("pointermove", function (e) {
      nx = e.clientX / window.innerWidth - 0.5;
      ny = e.clientY / window.innerHeight - 0.5;
      if (!raf) {
        raf = requestAnimationFrame(function () {
          body.style.setProperty("--px", nx.toFixed(3));
          body.style.setProperty("--py", ny.toFixed(3));
          raf = 0;
        });
      }
    }, { passive: true });
  }

  // 選年級：值寫進站內用的鍵，進站後直接生效（無痕模式寫不進去就略過）
  var key = body.getAttribute("data-level-key");
  var buttons = [].slice.call(document.querySelectorAll(".wl-lv"));
  function mark(v) {
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.getAttribute("data-value") === v)); });
  }
  if (key && buttons.length) {
    try { mark(localStorage.getItem(key) || ""); } catch (e) { /* 無痕模式 */ }
    buttons.forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-value");
        mark(v);
        try { localStorage.setItem(key, v); } catch (e) { /* 忽略 */ }
      });
    });
  }
})();
