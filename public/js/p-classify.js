/* 分類闖關：看昆蟲照片選牠屬於哪一「目」。名字先不給（名字裡常有「蝶」「蜂」會洩漏答案），答完才揭曉。
   國小：6 大類用俗名（甲蟲、蝴蝶和蛾…），三選一；國中：12 目，四選一；高中：再加水生昆蟲等目，干擾選項專挑容易混的。
   各目平均抽題，不然一半都是蝴蝶和蛾。 */
Mu.boot(function () {
  Quiz.page({
    key: "classify", title: "分類闖關", timed: true,
    intro: {
      e: "看照片，猜猜牠是甲蟲、蝴蝶和蛾、蜂和螞蟻、蜻蜓和豆娘、蝗蟲蟋蟀，還是椿象和蟬。",
      j: "再加上蒼蠅蚊子、螳螂、竹節蟲、蟑螂白蟻、草蛉、蠼螋，選出牠屬於哪一目。",
      s: "選項專挑長得像的目（蜂和虻、蛾和石蛾…），要看翅膀、口器和觸角。",
    },
    async rounds(n, lv) {
      const pool = await Qgen.poolFor({ lv });
      const ords = Mu.ordersFor(lv).map((o) => o.id).filter((o) => pool.filter((x) => x.ord === o).length >= 2);
      const per = Math.ceil(n / ords.length) + 1;
      const picked = Mu.shuffle([].concat(...ords.map((o) => Mu.pick(pool.filter((x) => x.ord === o), per)))).slice(0, n);
      return Qgen.make(picked.concat(pool.filter((x) => x.kind === "other")), ["order"], n, lv).map(Qgen.toRound);
    },
  });
});
