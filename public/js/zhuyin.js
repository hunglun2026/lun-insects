/* 注音（低年級）：頁面在要加注音的元素加 class="zy"，低年級時自動在字上方加注音，換年級立刻加上或拿掉。
   注音資料 zhuyin.json 由 scripts/build-zhuyin.py 產生：w＝整詞讀音（動物名字、多音詞），c＝單字預設讀音。
   只有低年級才下載這份資料（首頁標了 zy-always 的元素顯示時，其他年級也會下載）。 */
(function () {
  "use strict";
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  // 頁面本體與對話框整個標成 .zy；html 的 data-grade 給 CSS 用（low＝低年級）
  const tag = (r) => { if (!r.querySelectorAll) return; r.querySelectorAll("main,dialog").forEach((e) => e.classList.add("zy")); if (r.matches && r.matches("main,dialog")) r.classList.add("zy"); };
  const sync = () => { document.documentElement.dataset.grade = isLow() ? "low" : "other"; };
  let data = null, loading = null;
  const CJK = new RegExp("[" + String.fromCharCode(0x3400) + "-" + String.fromCharCode(0x9fff) + "]"); // 中文字範圍（寫成數字，字型子集才不會把這兩個邊界字當成網站用字）

  function load() {
    loading = loading || fetch("/js/zhuyin.json?v=23").then((r) => r.json()).then((d) => {
      data = d;
      data.maxW = Math.max(1, ...Object.keys(d.w).map((k) => k.length));
    }).catch(() => { loading = null; });
    return loading;
  }

  // 一個字的注音：符號直排在字的右邊，聲調（ˊˇˋ）排在符號右側最後一格，輕聲（˙）在符號上方，同課本的排法
  function rt(z) {
    const light = z[0] === "˙", tone = /[ˊˇˋ]$/.test(z) ? z.slice(-1) : "";
    const body = z.replace(/^˙/, "").replace(/[ˊˇˋ]$/, "");
    return "<rt" + (light ? ' class="q"' : "") + ">" + (light ? "<u>˙</u>" : "") + "<b>" + body + "</b>" + (tone ? "<i>" + tone + "</i>" : "") + "</rt>";
  }

  // 一段文字轉成 ruby：先找最長的整詞，找不到用單字讀音；不是中文字原樣保留
  function rubyHTML(text) {
    let out = "", i = 0;
    while (i < text.length) {
      let hit = null;
      for (let n = Math.min(data.maxW, text.length - i); n >= 2 && !hit; n--) {
        const w = text.substr(i, n);
        if (data.w[w]) hit = [w, data.w[w]];
      }
      if (hit) {
        [...hit[0]].forEach((ch, k) => { out += "<ruby>" + ch + rt(hit[1][k]) + "</ruby>"; });
        i += hit[0].length;
        continue;
      }
      const ch = text[i];
      out += CJK.test(ch) && data.c[ch] ? "<ruby>" + ch + rt(data.c[ch]) + "</ruby>" : esc(ch);
      i++;
    }
    return out;
  }

  // 把 .zy 裡的每個文字節點換成注音；原文記在 data-t，拿掉注音時換回來
  function addTo(root) {
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (CJK.test(n.nodeValue) && !n.parentElement.closest(".zyw,rt,button.spk,select,option,textarea,script,style,svg,canvas,.nozy,.w-tour,.w-credit") ? 1 : 3),
    });
    const nodes = [];
    while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach((n) => {
      const s = document.createElement("span");
      s.className = "zyw";
      s.dataset.t = n.nodeValue;
      s.innerHTML = rubyHTML(n.nodeValue);
      n.replaceWith(s);
    });
  }
  function removeFrom(root) {
    root.querySelectorAll(".zyw").forEach((s) => s.replaceWith(document.createTextNode(s.dataset.t)));
  }

  const fit = (root) => root.querySelectorAll(".acard .info>b").forEach((b) => b.style.setProperty("--n", [...b.querySelectorAll(".zyw")].reduce((n, z) => n + z.dataset.t.length, 0)));
  const isLow = () => Mu.level() === "e";
  // class="zy zy-always"：不論目前年級都加注音（首頁問年級那一題，第一次來的小一生還沒選過年級，要讀得懂才選得出來）
  // 還藏著的（hidden）不處理，顯示出來那一刻才加，免得一進首頁就讓每個人下載注音資料
  const wants = (t) => isLow() || (!!t.closest(".zy-always") && !t.closest("[hidden]"));
  async function apply(root) {
    const up = root.closest && root.closest(".zy");
    const targets = up ? [up] : [...root.querySelectorAll(".zy")];
    if (!targets.length) return;
    targets.filter((t) => !wants(t)).forEach(removeFrom);
    const on = targets.filter(wants);
    if (!on.length) return;
    await load();
    if (data) on.forEach((t) => {
      if (!wants(t)) return;
      addTo(t);
      fit(t);
      // 小百科卡片的名字：記下字數（--n），CSS 依字數把字級縮到剛好一行放得下
      if (t.matches(".acard .info>b")) t.style.setProperty("--n", [...t.querySelectorAll(".zyw")].reduce((n, z) => n + z.dataset.t.length, 0));
    });
  }

  // 新畫出來的 .zy（遊戲換題、開詳細介紹）也自動加
  tag(document); sync();
  new MutationObserver((muts) => {
    if (!isLow() && !document.querySelector(".zy-always")) return; // 不是低年級又沒有強制注音的元素，不用處理
    muts.forEach((m) => {
      if (m.type === "attributes") { if (!m.target.hidden) apply(m.target); return; } // 藏著的區塊顯示出來
      m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) tag(n);
        const e = n.nodeType === 1 ? n : n.parentElement; // 頁面直接改 textContent 時加進來的是文字節點
        if (e && !e.closest(".zyw")) apply(e);
      });
    });
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
  document.addEventListener("mu-level", () => { sync(); apply(document.body); });
  // 低年級馬上加。其他年級沒有要馬上加的（有 zy-always 的元素藏著，顯示時才由上面的觀察器處理），等頁面載完、瀏覽器閒下來再做，
  // 不跟首頁最大的畫面搶頻寬（注音資料與注音字型包合起來約 170KB，量過會讓手機首屏慢約 1 秒）
  const idle = (fn) => {
    const go = () => ("requestIdleCallback" in window ? requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500));
    document.readyState === "complete" ? go() : addEventListener("load", go, { once: true });
  };
  if (isLow()) apply(document.body); else idle(() => apply(document.body));
})();
