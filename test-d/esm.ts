// ESM 利用者から見た型の検査（tsc --noEmit で検査し、実行はしない）。
// lib に DOM を含めない（Node.js のみの利用者でも型エラーにならないこと）。

import {
  between,
  type DateInput,
  type Holiday,
  type HolidayDate,
  holidays,
  isHoliday,
  isHolidayName,
  JPHoliday,
  monthHolidays,
  type OriginalHolidayChecker,
  type PlainDateLike,
  register,
  unregister,
  yearHolidays,
} from "jpholiday";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
function expectType<T extends true>(): void {}

// --- 入力形式 ---
isHoliday("2017-01-01");
isHoliday(new Date());
isHoliday({ year: 2017, month: 1, day: 1 });
isHoliday(2017, 1, 1);
between("2017-01-01", new Date());
between({ year: 2017, month: 1, day: 1 }, "2017-12-31");

const plain: PlainDateLike = { year: 2017, month: 1, day: 1 };
const input: DateInput = plain;
isHolidayName(input);

// @ts-expect-error 数値 1 つは受け付けない
isHoliday(20170101);
// @ts-expect-error 引数 2 つは受け付けない
isHoliday(2017, 1);
// @ts-expect-error month は数値
isHoliday({ year: 2017, month: "1", day: 1 });
// @ts-expect-error between は (y, m, d) 形式を受け付けない
between(2017, 1, 1, 2017, 12, 31);
// @ts-expect-error yearHolidays は数値
yearHolidays("2017");

// --- 戻り値 ---
expectType<Equal<ReturnType<typeof isHoliday>, boolean>>();
expectType<Equal<ReturnType<typeof isHolidayName>, string | null>>();
expectType<Equal<ReturnType<typeof yearHolidays>, Holiday[]>>();
expectType<Equal<ReturnType<typeof monthHolidays>, Holiday[]>>();
expectType<Equal<ReturnType<typeof between>, Holiday[]>>();
expectType<Equal<ReturnType<typeof unregister>, void>>();

const [first] = holidays("2017-01-01");
if (first) {
  expectType<Equal<typeof first.date, string>>();
  expectType<Equal<typeof first.name, string>>();
  // @ts-expect-error Holiday は readonly
  first.name = "x";
}

// --- 独自祝日 ---
const checker: OriginalHolidayChecker = {
  isHoliday: (date) => {
    expectType<Equal<typeof date, HolidayDate>>();
    expectType<Equal<typeof date.weekday, number>>();
    expectType<Equal<typeof date.iso, string>>();
    return date.month === 2 && date.day === 9;
  },
  holidayName: () => "特別休暇",
};
register(checker);
unregister(checker);

// @ts-expect-error holidayName が必要
register({ isHoliday: () => true });
// @ts-expect-error holidayName は文字列を返す
register({ isHoliday: () => true, holidayName: () => 1 });

// --- クラス API ---
const jp = new JPHoliday();
jp.register(checker);
expectType<Equal<ReturnType<typeof jp.isHolidayName>, string | null>>();
const fromClass: Holiday[] = jp.between("2017-01-01", { year: 2017, month: 12, day: 31 });
void fromClass;
jp.isHoliday(2017, 1, 1);
// HolidayDate はそのまま DateInput として渡せる
const reuse: OriginalHolidayChecker = {
  isHoliday: (date) => !jp.isHoliday(date),
  holidayName: (date) => date.iso,
};
void reuse;
