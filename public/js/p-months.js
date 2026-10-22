/* 幾月看得到：選月份 → 全年觀察筆數長條（看出昆蟲的季節）、這個月最常被看到的昆蟲、這個月正是旺季的昆蟲。
   依據 iNaturalist 台灣研究級觀察的每月筆數（民眾拍照上傳、專家確認），反映「有人拍到」的多寡，不等於真正的數量。
   物種範圍跟著難度（國小只列最常見的 200 種）。 */
Mu.boot(async function () {
  const { esc, el } = Mu;
  const $ = (id) => document.getElementById(id);
  const all = (await Mu.species()).filter((s) => s.kind === "insect" && s.months && s.months.length === 12);
  const st = { m: new Date().getMonth() + 1, ord: "" };

  $("mon").innerHTML = Array.from({ length: 12 }, (_, i) => '<button class="chip" type="button" data-m="' + (i + 1) + '">' + (i + 1) + " 月</button>").join("");
  $("mon").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { st.m = +b.dataset.m; draw(); }));
  const ordBtns = () => {
    const lv = Mu.level();
    const list = Mu.ORDERS.filter((o) => all.some((s) => s.ord === o.id && Mu.inLevel(s, lv)));
    $("ords").innerHTML = '<span class="lab">類別</span><button class="chip" type="button" data-o="">全部</button>' +
      list.map((o) => '<button class="chip" type="button" data-o="' + o.id + '">' + o.emoji + " " + esc(o.folk) + "</button>").join("");
    $("ords").querySelectorAll(".chip").forEach((b) => (b.onclick = () => { st.ord = b.dataset.o; draw(); }));
  };

  function card(s, note) {
    const a = el('<a class="acard" href="' + Mu.spPage(s) + '"><span class="pic"></span><div class="info"><b>' + esc(s.name) + "</b><small>" + esc(note) + "</small></div></a>");
    a.querySelector(".pic").replaceWith(Mu.photo(s));
    return a;
  }

  function draw() {
    const lv = Mu.level();
    if (st.ord && !$("ords").querySelector('[data-o="' + st.ord + '"]')) st.ord = "";
    $("mon").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.m === st.m)));
    $("ords").querySelectorAll(".chip").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.o === st.ord)));
    const list = all.filter((s) => Mu.inLevel(s, lv) && (!st.ord || s.ord === st.ord));
    const i = st.m - 1;
    // 全年長條：這個範圍內所有物種每月筆數加總
    const sum = Array.from({ length: 12 }, (_, k) => list.reduce((t, s) => t + s.months[k], 0));
    const max = Math.max(...sum, 1);
    const peak = sum.indexOf(Math.max(...sum)) + 1;
    const low = sum.indexOf(Math.min(...sum)) + 1;
    const top = list.filter((s) => s.months[i] > 0).sort((a, b) => b.months[i] - a.months[i]).slice(0, 12);
    // 旺季：這個月佔牠全年筆數的比例最高的（至少 10 筆才算，避免偶然拍到一兩筆）
    const share = (s) => s.months[i] / Math.max(1, s.months.reduce((a, b) => a + b, 0));
    const season = list.filter((s) => s.months[i] >= 10 && !top.includes(s)).sort((a, b) => share(b) - share(a)).slice(0, 12);
    const box = el('<div><h2>一整年的觀察紀錄</h2><p class="count">這個範圍裡，' + peak + " 月被拍到最多次，" + low + " 月最少。點長條換月份。</p>" +
      '<div class="mbars big" id="year"></div>' +
      "<h2>" + st.m + " 月最常被看到的昆蟲</h2>" + (top.length ? "" : '<p class="lead">這個月沒有紀錄。</p>') + '<div class="grid" id="top"></div>' +
      "<h2>" + st.m + " 月正是牠們的旺季</h2><p class=\"lead\">這些昆蟲一年裡被拍到的紀錄，有很大一部分集中在 " + st.m + " 月。</p>" + '<div class="grid" id="season"></div>' +
      '<h2>想一想</h2><div class="panel"><ol><li>為什麼有些月份的紀錄特別多？跟天氣、植物開花、放假出遊有沒有關係？</li>' +
      "<li>挑一種昆蟲，看牠在小百科裡的每月長條。牠最常出現的月份，跟牠吃的東西有關嗎？</li>" +
      "<li>這些是民眾拍照上傳的紀錄。紀錄多，一定代表昆蟲真的比較多嗎？還有哪些可能的原因？</li></ol></div></div>");
    const year = box.querySelector("#year");
    sum.forEach((v, k) => {
      const b = el('<button type="button" class="' + (k === i ? "on" : "") + '" aria-label="' + (k + 1) + " 月：" + v + ' 筆"><i style="height:' + Math.max(2, (v / max) * 100) + '%"></i><small>' + (k + 1) + "</small></button>");
      b.onclick = () => { st.m = k + 1; draw(); };
      year.appendChild(b);
    });
    top.forEach((s) => box.querySelector("#top").appendChild(card(s, s.months[i].toLocaleString() + " 筆紀錄")));
    season.forEach((s) => box.querySelector("#season").appendChild(card(s, "全年有 " + Math.round(share(s) * 100) + "% 在這個月")));
    $("out").replaceChildren(box);
  }
  document.addEventListener("mu-level", () => { ordBtns(); draw(); });
  ordBtns();
  draw();
});
