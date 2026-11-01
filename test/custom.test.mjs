// 独自祝日（OriginalHolidayChecker）の登録・解除・判定の検証。

import assert from "node:assert/strict";
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

/** 上流 tests/custom_holiday.rs と同じ独自祝日（2020-02-03 / 02-05 / 02-09）。 */
const specialLeave = {
  isHoliday: (date) => ["2020-02-03", "2020-02-05", "2020-02-09"].includes(date.iso),
  holidayName: () => "特別休暇",
};

function assertRegistered(jp) {
  assert.equal(jp.isHolidayName("2020-02-03"), "特別休暇");
  assert.equal(jp.isHolidayName("2020-02-05"), "特別休暇");
  // 2/4 は独自祝日に挟まれるが「国民の休日」にはならない（独自祝日は対象外）。
  assert.equal(jp.isHoliday("2020-02-04"), false);
  // 2/9 (日曜) は独自祝日だが、翌 2/10 は「振替休日」にならない（独自祝日は対象外）。
  assert.equal(jp.isHolidayName("2020-02-09"), "特別休暇");
  assert.equal(jp.isHoliday("2020-02-10"), false);
}

/** JS の Date で求めた ISO 曜日（月=1〜日=7）。年 1〜99 も正しく扱うため setUTCFullYear を使う。 */
function isoWeekdayByJsDate(year, month, day) {
  const d = new Date(0);
  d.setUTCFullYear(year, month - 1, day);
  return d.getUTCDay() === 0 ? 7 : d.getUTCDay();
}

describe("クラス API の独自祝日", () => {
  test("登録・解除・再登録（上流 register_unregister_reregister と同じ）", () => {
    const jp = new JPHoliday();
    jp.register(specialLeave);
    assertRegistered(jp);

    jp.unregister(specialLeave);
    assert.equal(jp.isHoliday("2020-02-03"), false);
    assert.equal(jp.isHoliday("2020-02-05"), false);
    assert.equal(jp.isHoliday("2020-02-09"), false);

    jp.register(specialLeave);
    assertRegistered(jp);
  });

  test("同じオブジェクトの重複登録は無視される", () => {
    const jp = new JPHoliday();
    jp.register(specialLeave);
    jp.register(specialLeave);
    assert.equal(jp.holidays("2020-02-03").length, 1);
  });

  test("別オブジェクトのチェッカーはそれぞれ登録され、登録順に並ぶ", () => {
    const jp = new JPHoliday();
    const a = { isHoliday: (d) => d.iso === "2017-01-01", holidayName: () => "A" };
    const b = { isHoliday: (d) => d.iso === "2017-01-01", holidayName: () => "B" };
    jp.register(a);
    jp.register(b);
    // 組込み → 独自（登録順）。
    assert.deepEqual(jp.holidays("2017-01-01"), [
      { date: "2017-01-01", name: "元日" },
      { date: "2017-01-01", name: "A" },
      { date: "2017-01-01", name: "B" },
    ]);
    assert.equal(jp.isHolidayName("2017-01-01"), "元日");
    jp.unregister(a);
    assert.deepEqual(
      jp.holidays("2017-01-01").map((h) => h.name),
      ["元日", "B"],
    );
  });

  test("未登録のチェッカーを解除しても何も起きない", () => {
    const jp = new JPHoliday();
    jp.unregister(specialLeave);
    assert.equal(jp.isHoliday("2020-02-03"), false);
  });

  test("一覧系の関数にも独自祝日が日付順に合流する", () => {
    const jp = new JPHoliday();
    jp.register(specialLeave);
    assert.deepEqual(jp.monthHolidays(2020, 2), [
      { date: "2020-02-03", name: "特別休暇" },
      { date: "2020-02-05", name: "特別休暇" },
      { date: "2020-02-09", name: "特別休暇" },
      { date: "2020-02-11", name: "建国記念の日" },
      { date: "2020-02-23", name: "天皇誕生日" },
      { date: "2020-02-24", name: "天皇誕生日 振替休日" },
    ]);
    assert.equal(jp.yearHolidays(2020).length, yearHolidays(2020).length + 3);
    assert.deepEqual(
      jp.between("2020-02-05", "2020-02-11").map((h) => h.date),
      ["2020-02-05", "2020-02-09", "2020-02-11"],
    );
    assert.deepEqual(jp.between("2020-02-11", "2020-02-01"), []);
  });

  test("インスタンスごとに登録状態が分離され、関数 API にも影響しない", () => {
    const a = new JPHoliday();
    const b = new JPHoliday();
    a.register(specialLeave);
    assert.equal(a.isHoliday("2020-02-03"), true);
    assert.equal(b.isHoliday("2020-02-03"), false);
    assert.equal(isHoliday("2020-02-03"), false);
  });

  test("this を使うクラス型のチェッカー", () => {
    class Anniversary {
      constructor(month, day, name) {
        this.month = month;
        this.day = day;
        this.name = name;
      }
      isHoliday(date) {
        return date.month === this.month && date.day === this.day;
      }
      holidayName() {
        return this.name;
      }
    }
    const jp = new JPHoliday();
    jp.register(new Anniversary(2, 9, "創立記念日"));
    assert.equal(jp.isHolidayName("2031-02-09"), "創立記念日");
    assert.equal(jp.isHoliday("2031-02-10"), false);
  });

  test("holidayName は isHoliday が true の日にだけ呼ばれる", () => {
    const calls = [];
    const jp = new JPHoliday();
    jp.register({
      isHoliday: (d) => d.day === 15,
      holidayName: (d) => {
        calls.push(d.iso);
        return "15日";
      },
    });
    jp.monthHolidays(2017, 3);
    assert.deepEqual(calls, ["2017-03-15"]);
  });
});

describe("チェッカーに渡される日付", () => {
  test("year / month / day / weekday / iso を持つ凍結オブジェクト", () => {
    const seen = [];
    const jp = new JPHoliday();
    jp.register({
      isHoliday: (d) => {
        seen.push(d);
        return false;
      },
      holidayName: () => "",
    });
    jp.isHoliday("2017-01-02");
    assert.equal(seen.length, 1);
    assert.deepEqual({ ...seen[0] }, { year: 2017, month: 1, day: 2, weekday: 1, iso: "2017-01-02" });
    assert.ok(Object.isFrozen(seen[0]));
    // そのまま DateInput として渡し直せる。
    assert.equal(isHolidayName(seen[0]), "元日 振替休日");
  });

  test("範囲内の全日付・曜日が JS の Date と一致する（年 1 / 2000 前後 / 9999 を含む）", () => {
    const ranges = [
      ["0001-01-01", "0001-12-31"],
      ["1899-12-25", "1900-03-05"],
      ["1999-12-01", "2001-03-31"],
      ["2096-02-25", "2096-03-02"],
      ["9999-11-01", "9999-12-31"],
    ];
    for (const [start, end] of ranges) {
      const seen = [];
      const jp = new JPHoliday();
      jp.register({
        isHoliday: (d) => {
          seen.push(d);
          return false;
        },
        holidayName: () => "",
      });
      jp.between(start, end);
      assert.equal(seen[0].iso, start);
      assert.equal(seen.at(-1).iso, end);
      for (let i = 0; i < seen.length; i++) {
        const d = seen[i];
        assert.equal(d.weekday, isoWeekdayByJsDate(d.year, d.month, d.day), d.iso);
        if (i > 0) {
          const prev = new Date(0);
          prev.setUTCFullYear(d.year, d.month - 1, d.day - 1);
          assert.equal(seen[i - 1].iso, prev.toISOString().slice(0, 10), d.iso);
        }
      }
    }
  });

  test("一致しないチェッカーを登録しても組込みの結果は変わらない（合流処理の検証）", () => {
    const jp = new JPHoliday();
    jp.register({ isHoliday: () => false, holidayName: () => "" });
    assert.deepEqual(jp.between("1948-01-01", "2099-12-31"), between("1948-01-01", "2099-12-31"));
  });

  test("毎週日曜のチェッカーは組込みの祝日の後ろ・日付順に合流する", () => {
    const jp = new JPHoliday();
    jp.register({ isHoliday: (d) => d.weekday === 7, holidayName: () => "日曜" });
    const result = jp.yearHolidays(2017);
    const sorted = [...result].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    assert.deepEqual(result, sorted);
    // 2017-01-01 は日曜かつ元日 → 元日が先。
    assert.deepEqual(
      result.filter((h) => h.date === "2017-01-01").map((h) => h.name),
      ["元日", "日曜"],
    );
    assert.equal(result.filter((h) => h.name === "日曜").length, 53);
  });
});

describe("関数 API の独自祝日（グローバル登録）", () => {
  test("register / unregister", () => {
    register(specialLeave);
    try {
      assertRegistered({ isHoliday, isHolidayName });
      assert.deepEqual(holidays("2020-02-09"), [{ date: "2020-02-09", name: "特別休暇" }]);
      assert.equal(monthHolidays(2020, 2).length, 6);
      // グローバル登録はインスタンスに影響しない。
      assert.equal(new JPHoliday().isHoliday("2020-02-03"), false);
    } finally {
      unregister(specialLeave);
    }
    assert.equal(isHoliday("2020-02-03"), false);
    assert.equal(monthHolidays(2020, 2).length, 3);
  });

  test("チェッカーから関数 API を再入呼び出しできる（上流 reentrancy と同じ）", () => {
    const reentrant = {
      isHoliday: (d) => (d.iso === "2098-06-06" ? isHoliday("2017-01-01") : false),
      holidayName: () => "再入テスト",
    };
    register(reentrant);
    try {
      assert.equal(isHoliday("2098-06-06"), true);
      assert.equal(isHolidayName("2017-01-01"), "元日");
      assert.ok(between("2098-06-05", "2098-06-07").some((h) => h.name === "再入テスト"));
    } finally {
      unregister(reentrant);
    }
    assert.equal(isHoliday("2098-06-06"), false);
  });

  test("計算中の登録変更はその計算に影響しない（スナップショット）", () => {
    const late = { isHoliday: () => true, holidayName: () => "後から登録" };
    const registrar = {
      isHoliday: () => {
        register(late);
        return false;
      },
      holidayName: () => "",
    };
    register(registrar);
    try {
      assert.deepEqual(holidays("2017-01-03"), []);
      assert.deepEqual(holidays("2017-01-03"), [{ date: "2017-01-03", name: "後から登録" }]);
    } finally {
      unregister(registrar);
      unregister(late);
    }
    assert.deepEqual(holidays("2017-01-03"), []);
  });
});

describe("独自祝日のエラー", () => {
  test("チェッカーの形が不正なら TypeError", () => {
    const jp = new JPHoliday();
    for (const bad of [undefined, null, {}, { isHoliday: () => true }, { holidayName: () => "" }, "x"]) {
      assert.throws(() => jp.register(bad), TypeError);
      assert.throws(() => register(bad), TypeError);
    }
  });

  test("holidayName が文字列以外を返したら TypeError", () => {
    const jp = new JPHoliday();
    jp.register({ isHoliday: () => true, holidayName: () => undefined });
    assert.throws(() => jp.isHoliday("2017-01-03"), TypeError);
  });

  test("チェッカー内の例外はそのまま伝播する", () => {
    const jp = new JPHoliday();
    jp.register({
      isHoliday: () => {
        throw new Error("boom");
      },
      holidayName: () => "",
    });
    assert.throws(() => jp.isHoliday("2017-01-03"), /boom/);
  });
});
