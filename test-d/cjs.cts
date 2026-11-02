// CommonJS 利用者から見た型の検査（dist/index.d.cts が解決されること）。

import jpholiday = require("@lalcs/jpholiday");

const result: boolean = jpholiday.isHoliday("2017-01-01");
const name: string | null = jpholiday.isHolidayName(2017, 1, 1);
const jp: jpholiday.JPHoliday = new jpholiday.JPHoliday();
const list: jpholiday.Holiday[] = jp.yearHolidays(2017);
void [result, name, list];

// @ts-expect-error 存在しない関数
jpholiday.isHolidays("2017-01-01");
