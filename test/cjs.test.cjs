// CommonJS（require）から利用できることの検証。

const assert = require("node:assert/strict");
const { test } = require("node:test");

const jpholiday = require("jpholiday");

test("require('jpholiday') で関数 API とクラス API が使える", () => {
  assert.equal(jpholiday.isHoliday("2017-01-01"), true);
  assert.equal(jpholiday.isHolidayName(2017, 1, 2), "元日 振替休日");
  assert.equal(jpholiday.yearHolidays(2017).length, 17);

  const jp = new jpholiday.JPHoliday();
  jp.register({ isHoliday: (d) => d.iso === "2020-02-09", holidayName: () => "特別休暇" });
  assert.deepEqual(jp.holidays("2020-02-09"), [{ date: "2020-02-09", name: "特別休暇" }]);
});

test("エクスポートの一覧", () => {
  assert.deepEqual(Object.keys(jpholiday).sort(), [
    "JPHoliday",
    "between",
    "holidays",
    "isHoliday",
    "isHolidayName",
    "monthHolidays",
    "register",
    "unregister",
    "yearHolidays",
  ]);
});
