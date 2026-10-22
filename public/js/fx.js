/* 答題回饋效果：音效、撒彩紙、頁首的音效開關。只管「回饋」，遊戲規則不放這裡。
   Fx.right() 答對、Fx.wrong() 答錯、Fx.tick() 倒數、Fx.ding() 時間到、Fx.confetti() 三顆星撒彩紙 */
window.Fx = (function () {
  "use strict";
  const KEY = "in-sound";
  let on = true;
  try { on = localStorage.getItem(KEY) !== "off"; } catch (e) { /* 無痕模式 */ }
  let ctx = null;

  // notes：[頻率, 開始秒數, 長度]。用 WebAudio 現場產生，不必下載音效檔
  function play(notes, type) {
    if (!on) return;
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.state === "suspended") ctx.resume();
      notes.forEach(([f, t, d]) => {
        const o = ctx.createOscillator(), g = ctx.createGain(), at = ctx.currentTime + t;
        o.type = type || "sine";
        o.frequency.value = f;
        o.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.18, at);
        g.gain.exponentialRampToValueAtTime(0.001, at + d);
        o.start(at); o.stop(at + d + 0.02);
      });
    } catch (e) { /* 沒有音效也不影響作答 */ }
  }
  const right = () => play([[660, 0, 0.12], [990, 0.1, 0.22]]);
  const wrong = () => play([[220, 0, 0.25]], "triangle");
  const tick = () => play([[1000, 0, 0.06]]);
  const ding = () => play([[880, 0, 0.18], [880, 0.25, 0.18], [880, 0.5, 0.3]]);

  // 撒彩紙：純 CSS 動畫，2.5 秒後自己清掉；使用者設定「減少動態效果」就不撒
  function confetti() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = document.createElement("div");
    box.className = "confetti";
    box.setAttribute("aria-hidden", "true");
    const colors = ["#e07a3f", "#3a8fd9", "#5a9e4b", "#b0558f", "#d9a520", "#2fb5a0"];
    for (let i = 0; i < 70; i++) {
      const p = document.createElement("i");
      p.style.left = Math.random() * 100 + "%";
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.animationDuration = 1.6 + Math.random() * 0.9 + "s";
      box.appendChild(p);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 3200);
  }

  // 頁首加音效開關（layout.js 先畫好頁首，這支要在它後面載入）
  const nav = document.querySelector("header.top");
  if (nav) {
    const b = document.createElement("button");
    b.className = "sound";
    const draw = () => {
      b.textContent = on ? "🔊" : "🔇";
      b.setAttribute("aria-label", on ? "音效開啟中，按一下關閉" : "音效已關閉，按一下開啟");
      b.setAttribute("aria-pressed", String(on));
    };
    b.onclick = () => {
      on = !on;
      try { localStorage.setItem(KEY, on ? "on" : "off"); } catch (e) { /* 忽略 */ }
      draw();
      if (on) right();
    };
    draw();
    nav.appendChild(b);
  }

  return { right, wrong, tick, ding, confetti };
})();
