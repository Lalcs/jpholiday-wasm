// 関数 API・入力形式・エラー処理の検証（ESM、ビルド済み dist を自己参照 import で読む）。

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  between,
  holidays,
  isHoliday,
  isHolidayName,
  JPHoliday,
  monthHolidays,
  register,
  unregister,
  yearHolidays,
} from "jpholiday";

/** 上流クレートをネイティブ実行した結果（examples/dump.rs で生成）。 */
const fixture = readFileSync(new URL("./fixtures/holidays.tsv", import.meta.url), "utf8")
  .trimEnd()
  .split("\n")
  .map((line) => {
    const [date, name] = line.split("\t");
    return { date, name };
  });

describe("上流クレート（ネイティブ）との一致", () => {
  test("between() が 1948〜2099 年の全祝日で一致する", () => {
    assert.deepEqual(between("1948-01-01", "2099-12-31"), fixture);
  });

  test("yearHolidays() / monthHolidays() / holidays() が全年で一致する", () => {
    for (let year = 1948; year <= 2099; year++) {
      const expected = fixture.filter((h) => h.date.startsWith(`${year}-`));
      assert.deepEqual(yearHolidays(year), expected, `year ${year}`);
      const months = [];
      for (let month = 1; month <= 12; month++) months.push(...monthHolidays(year, month));
      assert.deepEqual(months, expected, `months of ${year}`);
    }
    for (const { date, name } of fixture) {
      assert.ok(holidays(date).some((h) => h.name === name), date);
    }
  });
});

describe("関数 API", () => {
  test("isHoliday / isHolidayName / holidays", () => {
    assert.equal(isHoliday("2017-01-01"), true);
    assert.equal(isHoliday("2017-01-02"), true);
    assert.equal(isHoliday("2017-01-03"), false);

    assert.equal(isHolidayName("2017-01-01"), "元日");
    assert.equal(isHolidayName("2017-01-02"), "元日 振替休日");
    assert.equal(isHolidayName("2017-01-03"), null);

    assert.deepEqual(holidays("2017-01-01"), [{ date: "2017-01-01", name: "元日" }]);
    assert.deepEqual(holidays("2017-01-03"), []);
  });

  test("yearHolidays(2017)", () => {
    assert.deepEqual(yearHolidays(2017), [
      { date: "2017-01-01", name: "元日" },
      { date: "2017-01-02", name: "元日 振替休日" },
      { date: "2017-01-09", name: "成人の日" },
      { date: "2017-02-11", name: "建国記念の日" },
      { date: "2017-03-20", name: "春分の日" },
      { date: "2017-04-29", name: "昭和の日" },
      { date: "2017-05-03", name: "憲法記念日" },
      { date: "2017-05-04", name: "みどりの日" },
      { date: "2017-05-05", name: "こどもの日" },
      { date: "2017-07-17", name: "海の日" },
      { date: "2017-08-11", name: "山の日" },
      { date: "2017-09-18", name: "敬老の日" },
      { date: "2017-09-23", name: "秋分の日" },
      { date: "2017-10-09", name: "体育の日" },
      { date: "2017-11-03", name: "文化の日" },
      { date: "2017-11-23", name: "勤労感謝の日" },
      { date: "2017-12-23", name: "天皇誕生日" },
    ]);
  });

  test("monthHolidays: 範囲外の月は空配列（上流と同じ）", () => {
    assert.deepEqual(monthHolidays(2017, 5), [
      { date: "2017-05-03", name: "憲法記念日" },
      { date: "2017-05-04", name: "みどりの日" },
      { date: "2017-05-05", name: "こどもの日" },
    ]);
    assert.deepEqual(monthHolidays(2017, 0), []);
    assert.deepEqual(monthHolidays(2017, 13), []);
  });

  test("between: 両端を含み、逆順なら空配列", () => {
    const result = between("2017-01-01", "2017-05-03");
    assert.equal(result.length, 7);
    assert.deepEqual(result[0], { date: "2017-01-01", name: "元日" });
    assert.deepEqual(result.at(-1), { date: "2017-05-03", name: "憲法記念日" });
    assert.deepEqual(between("2017-05-03", "2017-01-01"), []);
    assert.deepEqual(between("2017-01-01", "2017-01-01"), [{ date: "2017-01-01", name: "元日" }]);
  });

  test("皇室慶弔行事・特例の祝日", () => {
    assert.equal(isHolidayName("1959-04-10"), "皇太子・明仁親王の結婚の儀");
    assert.equal(isHolidayName("1989-02-24"), "昭和天皇の大喪の礼");
    assert.equal(isHolidayName("1990-11-12"), "即位の礼正殿の儀");
    assert.equal(isHolidayName("1993-06-09"), "皇太子・皇太子徳仁親王の結婚の儀");
    assert.equal(isHolidayName("2019-05-01"), "天皇の即位の日");
    assert.equal(isHolidayName("2019-10-22"), "即位礼正殿の儀");
    // 東京オリンピック・パラリンピック特措法による移動。
    assert.equal(isHolidayName("2020-07-24"), "スポーツの日");
    assert.equal(isHolidayName("2021-08-09"), "山の日 振替休日");
  });

  test("国民の休日・振替休日", () => {
    assert.equal(isHolidayName("2015-09-22"), "国民の休日");
    assert.equal(isHolidayName("2026-09-22"), "国民の休日");
    assert.equal(isHolidayName("2020-05-06"), "憲法記念日 振替休日");
    assert.equal(isHolidayName("2027-03-22"), "春分の日 振替休日");
  });

  test("振替休日は 1973-04-12、国民の休日は 1985-12-27 の施行日以降のみ", () => {
    // 1973-02-11 は日曜の建国記念の日だが、施行前なので翌日は振替休日ではない。
    assert.equal(isHoliday("1973-02-12"), false);
    // 内閣府公表データ上の最初の振替休日。
    assert.equal(isHolidayName("1973-04-30"), "天皇誕生日 振替休日");
    // 憲法記念日とこどもの日に挟まれているが、施行前なので国民の休日ではない。
    assert.equal(isHoliday("1971-05-04"), false);
    assert.equal(isHoliday("1985-05-04"), false);
    // 内閣府公表データ上の最初の国民の休日。
    assert.equal(isHolidayName("1988-05-04"), "国民の休日");
  });

  test("祝日法の施行日（1948-07-20）より前は祝日なし", () => {
    assert.deepEqual(between("1948-01-01", "1948-07-19"), []);
    assert.equal(isHoliday("1948-01-01"), false);
    assert.equal(yearHolidays(1948)[0]?.date, "1948-09-23");
  });
});

describe("日付の入力形式", () => {
  test("文字列・オブジェクト・引数 3 つ・Date が同じ結果になる", () => {
    const expected = [{ date: "2017-01-02", name: "元日 振替休日" }];
    assert.deepEqual(holidays("2017-01-02"), expected);
    assert.deepEqual(holidays({ year: 2017, month: 1, day: 2 }), expected);
    assert.deepEqual(holidays(2017, 1, 2), expected);
    assert.deepEqual(holidays(new Date("2017-01-02")), expected);
  });

  test("ゲッターで year/month/day を持つオブジェクト（Temporal.PlainDate 相当）", () => {
    class PlainDate {
      #y;
      #m;
      #d;
      constructor(y, m, d) {
        this.#y = y;
        this.#m = m;
        this.#d = d;
      }
      get year() {
        return this.#y;
      }
      get month() {
        return this.#m;
      }
      get day() {
        return this.#d;
      }
    }
    assert.equal(isHolidayName(new PlainDate(2017, 1, 1)), "元日");
    assert.deepEqual(between(new PlainDate(2017, 5, 3), new PlainDate(2017, 5, 5)).length, 3);
  });

  test("Temporal.PlainDate（実行環境にあれば）", { skip: typeof Temporal === "undefined" }, () => {
    // eslint-disable-next-line no-undef
    assert.equal(isHolidayName(Temporal.PlainDate.from("2017-01-01")), "元日");
  });

  test("Date は日本時間 (UTC+9) の年月日として解釈する", () => {
    // 2016-12-31T15:00Z = 2017-01-01 00:00 JST
    assert.equal(isHolidayName(new Date("2016-12-31T15:00:00Z")), "元日");
    assert.equal(isHolidayName(new Date("2016-12-31T14:59:59.999Z")), null);
    // 2017-01-01T14:59:59Z = 2017-01-01 23:59:59 JST
    assert.equal(isHolidayName(new Date("2017-01-01T14:59:59.999Z")), "元日");
    assert.equal(isHolidayName(new Date("2017-01-01T15:00:00Z")), "元日 振替休日");
    // オフセット付き表記でも同じ瞬間なら同じ結果。
    assert.equal(isHolidayName(new Date("2017-01-01T00:00:00+09:00")), "元日");
    assert.equal(isHolidayName(new Date("2016-12-31T10:00:00-05:00")), "元日");
    // 日付のみの ISO 文字列は UTC 0 時 = JST 9 時なので、どのタイムゾーンでも同じ日になる。
    assert.equal(isHolidayName(new Date("2017-01-01")), "元日");
  });

  test("between で入力形式を混在できる", () => {
    assert.deepEqual(
      between(new Date("2017-05-03"), { year: 2017, month: 5, day: 5 }).map((h) => h.date),
      ["2017-05-03", "2017-05-04", "2017-05-05"],
    );
  });

  test("年の範囲は 1〜9999", () => {
    assert.deepEqual(holidays("0001-01-01"), []);
    assert.deepEqual(holidays("9999-12-31"), []);
    assert.equal(isHolidayName({ year: 9999, month: 1, day: 1 }), "元日");
  });
});

describe("エラー", () => {
  test("型の誤りは TypeError", () => {
    for (const value of [undefined, null, 20170101, true, {}, [], { year: "2017", month: 1, day: 1 }]) {
      assert.throws(() => isHoliday(value), TypeError, String(value));
    }
    assert.throws(() => isHoliday({ year: 2017, month: 1.5, day: 1 }), TypeError);
    assert.throws(() => isHoliday(2017, 1, 1.5), TypeError);
    assert.throws(() => isHoliday(2017, "1", 1), TypeError);
    assert.throws(() => isHoliday(), TypeError);
    assert.throws(() => isHoliday(2017, 1), TypeError);
    assert.throws(() => yearHolidays("2017"), TypeError);
    assert.throws(() => yearHolidays(2017.5), TypeError);
    assert.throws(() => monthHolidays(2017, "5"), TypeError);
    assert.throws(() => monthHolidays(2017, Number.NaN), TypeError);
  });

  test("形式不正・実在しない日付・範囲外は RangeError", () => {
    for (const value of [
      "2017-1-1",
      "2017/01/01",
      "20170101",
      "2017-01-01T00:00:00",
      " 2017-01-01",
      "",
      "2017-02-30",
      "2017-13-01",
      "2017-00-10",
      "2023-02-29",
      "0000-01-01",
    ]) {
      assert.throws(() => isHoliday(value), RangeError, value);
    }
    assert.equal(isHoliday("2024-02-29"), false);
    assert.throws(() => isHoliday(new Date(Number.NaN)), RangeError);
    assert.throws(() => isHoliday({ year: 2017, month: 2, day: 29 }), RangeError);
    assert.throws(() => isHoliday(10000, 1, 1), RangeError);
    assert.throws(() => isHoliday(0, 1, 1), RangeError);
    assert.throws(() => isHoliday(new Date("+010000-01-01")), RangeError);
    assert.throws(() => yearHolidays(0), RangeError);
    assert.throws(() => yearHolidays(10000), RangeError);
    assert.throws(() => monthHolidays(10000, 1), RangeError);
    assert.throws(() => between("2017-01-01", "2017-02-30"), RangeError);
  });

  test("エラーメッセージに jpholiday の接頭辞が付く", () => {
    assert.throws(() => isHoliday("2017-02-30"), /^RangeError: jpholiday: invalid date: 2017-02-30$/);
  });
});

describe("戻り値", () => {
  test("呼び出しごとに新しい配列・オブジェクトを返す", () => {
    const a = yearHolidays(2017);
    a[0].name = "改変";
    a.length = 0;
    assert.equal(yearHolidays(2017)[0]?.name, "元日");
  });

  test("関数 API とクラス API の結果が一致する", () => {
    const jp = new JPHoliday();
    assert.deepEqual(jp.yearHolidays(2019), yearHolidays(2019));
    assert.deepEqual(jp.between("2019-04-27", "2019-05-06"), between("2019-04-27", "2019-05-06"));
    assert.equal(jp.isHolidayName(2019, 5, 1), isHolidayName(2019, 5, 1));
  });

  test("register / unregister が関数として公開されている", () => {
    assert.equal(typeof register, "function");
    assert.equal(typeof unregister, "function");
  });
});
