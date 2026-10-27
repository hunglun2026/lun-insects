/* 變態排排站：同一種昆蟲的卵、幼蟲（若蟲）、蛹、成蟲照片打亂，從最小的時候開始依序點。
   國小：只出完全變態（幼蟲→蛹→成蟲，有卵就多一張）；國中、高中：完全與不完全變態都出，排完還要答「是哪一種變態」。
   用點的不用拖：平板上拖曳容易誤觸。共 5 回合。照片來自 iNaturalist 上被標了成長階段的台灣觀察。 */
Mu.boot(async function () {
  const { esc, el, shuffle } = Mu;
  const root = document.getElementById("game");
  const ROUNDS = 5;
  const ORDER = ["Egg", "Larva", "Nymph", "Pupa", "Adult"];
  const NAME = { Egg: "卵", Larva: "幼蟲", Nymph: "若蟲", Pupa: "蛹", Adult: "成蟲" };
  const INTRO = {
    e: "同一種昆蟲從小到大的照片被打亂了！從最小的時候開始，依序點下去。",
    j: "有的昆蟲有蛹、有的沒有。排好順序後，再判斷牠是完全變態還是不完全變態。",
    s: "排好順序並判斷變態方式。想一想：沒有蛹的昆蟲，小時候跟長大後差在哪裡？",
  };
  const all = (await Mu.species()).filter((s) => s.st && s.ordInfo);

  function candidates(lv) {
    return all.filter((s) => (lv === "e" ? s.ordInfo.meta === "full" : true));
  }

  function menu() {
    const lv = Mu.level();
    document.getElementById("intro").textContent = INTRO[lv];
    const n = candidates(lv).length;
    root.replaceChildren(el('<div class="stage"><h2>目前年級：' + esc(Mu.LEVELS[lv].name) + "</h2><p>可以在右上角換年級。現在有 " + n +
      ' 種昆蟲的成長照片可以排。</p><p><button class="btn primary big" id="go">開始排排站</button></p></div>'));
    root.querySelector("#go").onclick = () => play(lv);
  }

  async function play(lv) {
    root.replaceChildren(el('<div class="loading">正在找昆蟲寶寶…</div>'));
    let list;
    try {
      // 國中、高中一半完全變態、一半不完全變態（不然幾乎都是蝴蝶）
      const c = candidates(lv);
      const full = shuffle(c.filter((s) => s.ordInfo.meta === "full")), half = shuffle(c.filter((s) => s.ordInfo.meta !== "full"));
      const chosen = lv === "e" ? full.slice(0, ROUNDS) : shuffle(full.slice(0, 3).concat(half.slice(0, 2))).slice(0, ROUNDS);
      list = await Promise.all(chosen.map((s) => Mu.api("/api/sp/" + s.id).then((r) => Object.assign(s, { stages: r.item.stages }))));
      if (list.length < 3) throw new Error("物種不夠");
    } catch (e) {
      console.error(e);
      root.replaceChildren(el('<div class="err">題目載入失敗，請檢查網路後再試一次。<br><button class="btn" id="re">再試一次</button></div>'));
      root.querySelector("#re").onclick = () => play(lv);
      return;
    }
    let r = 0, right = 0;
    const wrongs = [];

    function round() {
      const sp = list[r];
      const keys = ORDER.filter((k) => sp.stages[k] && !(lv === "e" && k === "Egg" && Math.random() < 0.5));
      const picked = [];
      const stage = el('<div class="stage"><div class="bar"><i style="width:' + (r / list.length) * 100 + '%"></i></div><p>第 ' + (r + 1) + " / " + list.length +
        " 回合　⭐ 答對 " + right + ' 回合</p><h2 style="margin:.3em 0">這是「' + esc(sp.name) + '」，從<b>最小的時候</b>開始依序點</h2><div class="tl-pick" id="pick"></div>' +
        '<div class="feedback" id="fb" role="status" aria-live="polite"></div><div id="ask"></div><div id="nx"></div></div>');
      const pick = stage.querySelector("#pick");
      const cardOf = new Map();
      shuffle(keys).forEach((k) => {
        const b = el('<button class="tl-card"><span class="pic"></span><b>？</b></button>');
        const ph = Mu.photo(sp, false, "", sp.stages[k].k);
        ph.loading = "eager"; // 這回合的照片一開始就要看
        b.querySelector(".pic").replaceWith(ph);
        b.title = "照片：" + Mu.credit(sp.stages[k]);
        cardOf.set(k, b);
        b.onclick = () => {
          if (b.disabled) return;
          picked.push(k);
          b.disabled = true;
          b.insertAdjacentHTML("afterbegin", '<span class="no">' + picked.length + "</span>");
          if (picked.length === keys.length) check(stage, sp, keys, picked, cardOf);
        };
        pick.appendChild(b);
      });
      root.replaceChildren(stage);
    }

    function check(stage, sp, keys, picked, cardOf) {
      const ok = picked.every((k, i) => k === keys[i]);
      const pick = stage.querySelector("#pick");
      picked.forEach((k, i) => {
        const c = cardOf.get(k);
        c.classList.add(k === keys[i] ? "right" : "wrong");
        c.querySelector("b").textContent = NAME[k];
        pick.appendChild(c);
      });
      const mt = Mu.META_TYPE[sp.ordInfo.meta];
      const fb = stage.querySelector("#fb");
      fb.className = "feedback " + (ok ? "ok" : "no");
      fb.innerHTML = (ok ? "順序全對！🎉 " : "順序有點亂掉了，正確是：") + esc(keys.map((k) => NAME[k]).join("→")) + "。";
      if (lv === "e") return finishRound(stage, sp, ok, ok);
      // 國中、高中：再問變態方式
      Fx[ok ? "right" : "wrong"]();
      const ask = stage.querySelector("#ask");
      ask.innerHTML = '<h3 style="margin:.6em 0 .3em">那「' + esc(sp.name) + '」是哪一種變態？</h3><div class="opts"></div>';
      ["full", "half"].forEach((t) => {
        const b = el('<button class="opt">' + esc(Mu.META_TYPE[t].name) + "</button>");
        b.onclick = () => {
          const ok2 = sp.ordInfo.meta === t || (t === "half" && sp.ordInfo.meta === "none");
          ask.querySelectorAll(".opt").forEach((x) => (x.disabled = true));
          b.classList.add(ok2 ? "right" : "wrong");
          fb.innerHTML += "<br>" + (ok2 ? "變態方式也答對了！" : "變態方式答錯了。") + "牠是" + esc(sp.ordInfo.folk) + "，屬於" + esc(mt.name) + "：" + esc(mt.hint) + "。";
          finishRound(stage, sp, ok && ok2, null);
        };
        ask.querySelector(".opts").appendChild(b);
      });
    }

    function finishRound(stage, sp, ok, sound) {
      if (ok) right++; else wrongs.push({ item: sp, answer: Mu.META_TYPE[sp.ordInfo.meta].name });
      if (sound !== null) Fx[ok ? "right" : "wrong"]();
      if (lv === "e") stage.querySelector("#fb").innerHTML += "<br>" + esc(sp.ordInfo.folk) + "是" + esc(Mu.META_TYPE[sp.ordInfo.meta].name) + "：" + esc(Mu.META_TYPE[sp.ordInfo.meta].hint) + "。";
      const last = r === list.length - 1;
      const next = el('<button class="btn primary big">' + (last ? "看成績 🏆" : "下一回合 ➜") + "</button>");
      next.onclick = () => { r++; last ? finish() : round(); };
      stage.querySelector("#nx").appendChild(next);
      next.focus();
    }

    function finish() {
      const total = list.length;
      const stars = right >= total ? 3 : right >= Math.ceil(total * 0.6) ? 2 : right > 0 ? 1 : 0;
      Progress.stars("stages-" + lv, stars);
      if (stars === 3) Fx.confetti();
      const box = el('<div class="stage"><h2>變態排排站（' + esc(Mu.LEVELS[lv].name) + '）完成！</h2><div class="stars" aria-label="' + stars + ' 顆星">' +
        "⭐".repeat(stars) + "☆".repeat(3 - stars) + '</div><div class="score">' + right + " / " + total + "</div>" +
        "<p>" + (stars === 3 ? "昆蟲的一生你全都懂了！" : stars === 2 ? "很不錯，再玩一次可以拿到三顆星！" : "沒關係，多排幾次就記住了。") + "</p>" +
        '<div id="rv"></div><p><button class="btn primary big" id="again">再玩一次</button> <a class="btn big" href="/passport">看我的護照</a></p></div>');
      box.querySelector("#rv").appendChild(Quiz.review(wrongs));
      box.querySelector("#again").onclick = () => play(lv);
      root.replaceChildren(box);
    }
    round();
  }
  document.addEventListener("mu-level", menu);
  menu();
});
