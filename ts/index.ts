/**
 * 日本の祝日を判定するライブラリ。
 *
 * 判定ロジックは Rust 製の [jpholiday](https://crates.io/crates/jpholiday) クレートを
 * WebAssembly 化したもので、振替休日・国民の休日・春分/秋分の日（天文計算）まで再現します。
 *
 * @example
 * ```ts
 * import { isHoliday, isHolidayName, yearHolidays } from "@lalcs/jpholiday";
 *
 * isHoliday("2017-01-01"); // => true
 * isHolidayName({ year: 2017, month: 1, day: 2 }); // => "元日 振替休日"
 * yearHolidays(2017)[0]; // => { date: "2017-01-01", name: "元日" }
 * ```
 *
 * @packageDocumentation
 */

import {
  assertIntegerMonth,
  assertYear,
  daysInMonth,
  type DateInput,
  fromEpochDay,
  isoWeekdayOfEpochDay,
  normalizeDate,
  normalizeDateArgs,
  type PlainDateLike,
  toEpochDay,
  toIso,
  type Ymd,
} from "./date.js";
import * as wasm from "./wasm.js";

export type { DateInput, PlainDateLike };

/** 1 件の祝日。 */
export interface Holiday {
  /** 祝日の日付（`YYYY-MM-DD` 形式。タイムゾーンの影響を受けない暦日）。 */
  readonly date: string;
  /** 祝日の名称（例: `"元日"`、`"元日 振替休日"`、`"国民の休日"`）。 */
  readonly name: string;
}

/** 独自祝日チェッカーに渡される日付。 */
export interface HolidayDate {
  /** 年。 */
  readonly year: number;
  /** 月（1〜12）。 */
  readonly month: number;
  /** 日（1〜31）。 */
  readonly day: number;
  /** ISO 曜日（月曜=1 〜 日曜=7）。 */
  readonly weekday: number;
  /** `YYYY-MM-DD` 形式の文字列。 */
  readonly iso: string;
}

/**
 * 独自の祝日を定義するためのチェッカー。
 *
 * {@link register} や {@link JPHoliday.register} で登録すると判定に加わります。
 * 独自祝日は組込みの祝日の後ろに並び、振替休日・国民の休日の判定対象にはなりません（上流と同じ）。
 *
 * @example
 * ```ts
 * const companyHoliday: OriginalHolidayChecker = {
 *   isHoliday: (date) => date.month === 2 && date.day === 9,
 *   holidayName: () => "特別休暇",
 * };
 * ```
 */
export interface OriginalHolidayChecker {
  /** 指定日が独自の休日かどうかを返します。 */
  isHoliday(date: HolidayDate): boolean;
  /** 指定日の休日名を返します（`isHoliday` が `true` を返した日にのみ呼ばれます）。 */
  holidayName(date: HolidayDate): string;
}

type Checkers = readonly OriginalHolidayChecker[];

/** 平坦な `[日付, 名称, ...]` 配列を祝日オブジェクトの配列へ変換します。 */
function fromFlat(flat: readonly string[]): Holiday[] {
  const out: Holiday[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    out.push({ date: flat[i] as string, name: flat[i + 1] as string });
  }
  return out;
}

/** 独自チェッカーで判定し、該当した祝日を `out` に追加します。 */
function appendOriginal(out: Holiday[], ymd: Ymd, iso: string, epochDay: number, checkers: Checkers): void {
  if (checkers.length === 0) return;
  const date: HolidayDate = Object.freeze({
    year: ymd.year,
    month: ymd.month,
    day: ymd.day,
    weekday: isoWeekdayOfEpochDay(epochDay),
    iso,
  });
  for (const checker of checkers) {
    if (checker.isHoliday(date)) {
      const name: unknown = checker.holidayName(date);
      if (typeof name !== "string") {
        throw new TypeError(`jpholiday: holidayName() must return a string, got ${typeof name}`);
      }
      out.push({ date: iso, name });
    }
  }
}

/** 1 日分の祝日（組込み → 独自の順）を計算します。 */
function holidaysAt(ymd: Ymd, checkers: Checkers): Holiday[] {
  const iso = toIso(ymd);
  const out: Holiday[] = wasm.holidayNames(ymd.year, ymd.month, ymd.day).map((name) => ({ date: iso, name }));
  appendOriginal(out, ymd, iso, toEpochDay(ymd), checkers);
  return out;
}

/**
 * 範囲（両端を含む）の祝日を、組込みの結果（日付昇順）と独自チェッカーの結果を日付ごとに合流させて返します。
 */
function holidaysInRange(start: Ymd, end: Ymd, builtin: readonly string[], checkers: Checkers): Holiday[] {
  if (checkers.length === 0) return fromFlat(builtin);
  const out: Holiday[] = [];
  const last = toEpochDay(end);
  let i = 0;
  for (let day = toEpochDay(start); day <= last; day++) {
    const ymd = fromEpochDay(day);
    const iso = toIso(ymd);
    while (i < builtin.length && builtin[i] === iso) {
      out.push({ date: iso, name: builtin[i + 1] as string });
      i += 2;
    }
    appendOriginal(out, ymd, iso, day, checkers);
  }
  return out;
}

function yearImpl(year: unknown, checkers: Checkers): Holiday[] {
  assertYear(year);
  const builtin = wasm.yearHolidays(year);
  return holidaysInRange({ year, month: 1, day: 1 }, { year, month: 12, day: 31 }, builtin, checkers);
}

function monthImpl(year: unknown, month: unknown, checkers: Checkers): Holiday[] {
  assertYear(year);
  assertIntegerMonth(month);
  // 上流と同じく、範囲外の月は例外ではなく空配列を返す。
  if (month < 1 || month > 12) return [];
  const builtin = wasm.monthHolidays(year, month);
  return holidaysInRange({ year, month, day: 1 }, { year, month, day: daysInMonth(year, month) }, builtin, checkers);
}

function betweenImpl(startInput: unknown, endInput: unknown, checkers: Checkers): Holiday[] {
  const start = normalizeDate(startInput);
  const end = normalizeDate(endInput);
  const builtin = wasm.between(start.year, start.month, start.day, end.year, end.month, end.day);
  return holidaysInRange(start, end, builtin, checkers);
}

function assertChecker(checker: unknown): asserts checker is OriginalHolidayChecker {
  if (
    typeof checker !== "object" ||
    checker === null ||
    typeof (checker as Partial<OriginalHolidayChecker>).isHoliday !== "function" ||
    typeof (checker as Partial<OriginalHolidayChecker>).holidayName !== "function"
  ) {
    throw new TypeError("jpholiday: checker must be an object with isHoliday() and holidayName() methods");
  }
}

/** 登録（同じ参照は重複登録しない）。配列は複製して差し替え、計算中の列挙に影響させない。 */
function withChecker(checkers: Checkers, checker: unknown): Checkers {
  assertChecker(checker);
  return checkers.includes(checker) ? checkers : [...checkers, checker];
}

function withoutChecker(checkers: Checkers, checker: unknown): Checkers {
  return checkers.filter((c) => c !== checker);
}

/**
 * 日本の祝日を判定するクラス。
 *
 * 独自祝日の登録状態をインスタンスごとに分離したい場合に使います（関数 API はモジュール全体で
 * 登録状態を共有します）。判定結果のキャッシュは持ちません。
 *
 * @example
 * ```ts
 * const jp = new JPHoliday();
 * jp.holidays("2020-01-01"); // => [{ date: "2020-01-01", name: "元日" }]
 * ```
 */
export class JPHoliday {
  #checkers: Checkers = [];

  /** その日に該当するすべての祝日を返します（該当しなければ空配列）。 */
  holidays(date: DateInput): Holiday[];
  /** その日に該当するすべての祝日を返します（該当しなければ空配列）。 */
  holidays(year: number, month: number, day: number): Holiday[];
  holidays(...args: unknown[]): Holiday[] {
    return holidaysAt(normalizeDateArgs(args), this.#checkers);
  }

  /** その日が祝日かどうかを返します。 */
  isHoliday(date: DateInput): boolean;
  /** その日が祝日かどうかを返します。 */
  isHoliday(year: number, month: number, day: number): boolean;
  isHoliday(...args: unknown[]): boolean {
    return holidaysAt(normalizeDateArgs(args), this.#checkers).length > 0;
  }

  /** その日の祝日名を返します（複数該当する場合は先頭、該当しなければ `null`）。 */
  isHolidayName(date: DateInput): string | null;
  /** その日の祝日名を返します（複数該当する場合は先頭、該当しなければ `null`）。 */
  isHolidayName(year: number, month: number, day: number): string | null;
  isHolidayName(...args: unknown[]): string | null {
    return holidaysAt(normalizeDateArgs(args), this.#checkers)[0]?.name ?? null;
  }

  /** その年のすべての祝日を返します。 */
  yearHolidays(year: number): Holiday[] {
    return yearImpl(year, this.#checkers);
  }

  /** その月のすべての祝日を返します。`month` が 1〜12 の範囲外なら空配列を返します。 */
  monthHolidays(year: number, month: number): Holiday[] {
    return monthImpl(year, month, this.#checkers);
  }

  /** 指定範囲（両端を含む）のすべての祝日を返します。`start` が `end` より後なら空配列を返します。 */
  between(start: DateInput, end: DateInput): Holiday[] {
    return betweenImpl(start, end, this.#checkers);
  }

  /** 独自の祝日チェッカーを登録します。同じオブジェクトが既に登録済みなら何もしません。 */
  register(checker: OriginalHolidayChecker): void {
    this.#checkers = withChecker(this.#checkers, checker);
  }

  /** 独自の祝日チェッカーを登録解除します（登録時と同じオブジェクトを渡します）。 */
  unregister(checker: OriginalHolidayChecker): void {
    this.#checkers = withoutChecker(this.#checkers, checker);
  }
}

/** 関数 API が共有する独自チェッカーの一覧。 */
let globalCheckers: Checkers = [];

/** その日に該当するすべての祝日を返します（該当しなければ空配列）。 */
export function holidays(date: DateInput): Holiday[];
/** その日に該当するすべての祝日を返します（該当しなければ空配列）。 */
export function holidays(year: number, month: number, day: number): Holiday[];
export function holidays(...args: unknown[]): Holiday[] {
  return holidaysAt(normalizeDateArgs(args), globalCheckers);
}

/** その日が祝日かどうかを返します。 */
export function isHoliday(date: DateInput): boolean;
/** その日が祝日かどうかを返します。 */
export function isHoliday(year: number, month: number, day: number): boolean;
export function isHoliday(...args: unknown[]): boolean {
  return holidaysAt(normalizeDateArgs(args), globalCheckers).length > 0;
}

/** その日の祝日名を返します（複数該当する場合は先頭、該当しなければ `null`）。 */
export function isHolidayName(date: DateInput): string | null;
/** その日の祝日名を返します（複数該当する場合は先頭、該当しなければ `null`）。 */
export function isHolidayName(year: number, month: number, day: number): string | null;
export function isHolidayName(...args: unknown[]): string | null {
  return holidaysAt(normalizeDateArgs(args), globalCheckers)[0]?.name ?? null;
}

/** その年のすべての祝日を返します。 */
export function yearHolidays(year: number): Holiday[] {
  return yearImpl(year, globalCheckers);
}

/** その月のすべての祝日を返します。`month` が 1〜12 の範囲外なら空配列を返します。 */
export function monthHolidays(year: number, month: number): Holiday[] {
  return monthImpl(year, month, globalCheckers);
}

/** 指定範囲（両端を含む）のすべての祝日を返します。`start` が `end` より後なら空配列を返します。 */
export function between(start: DateInput, end: DateInput): Holiday[] {
  return betweenImpl(start, end, globalCheckers);
}

/** 独自の祝日チェッカーを関数 API に登録します。同じオブジェクトが既に登録済みなら何もしません。 */
export function register(checker: OriginalHolidayChecker): void {
  globalCheckers = withChecker(globalCheckers, checker);
}

/** 独自の祝日チェッカーを関数 API から登録解除します（登録時と同じオブジェクトを渡します）。 */
export function unregister(checker: OriginalHolidayChecker): void {
  globalCheckers = withoutChecker(globalCheckers, checker);
}
