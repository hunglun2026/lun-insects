/* 是不是昆蟲：蜘蛛、蜈蚣、馬陸、鼠婦常被當成昆蟲。一半昆蟲、一半不是，答完說明怎麼分辨（腳的數目、身體分段、觸角）。
   國小、國中、高中題目一樣多元，難度差在昆蟲選得多冷門（跟著各難度的物種範圍）。 */
Mu.boot(function () {
  Quiz.page({
    key: "isinsect", title: "是不是昆蟲", timed: false,
    intro: {
      e: "蜘蛛是昆蟲嗎？看照片判斷牠是不是昆蟲。記得數數看有幾隻腳！",
      j: "有些不是昆蟲的小動物長得很像昆蟲，看腳、觸角和身體分成幾段。",
      s: "包含很少見的昆蟲和蛛形綱、唇足綱、倍足綱、等足目，答完看分類依據。",
    },
    async rounds(n, lv) {
      const pool = await Qgen.poolFor({ lv });
      return Qgen.make(pool, ["insect"], n, lv).map(Qgen.toRound);
    },
  });
});
