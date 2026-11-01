// 日付の正規化と暦計算（内部モジュール）。
//
// 利用者から受け取った 4 種類の日付表現を `{ year, month, day }` へ正規化し、範囲検証を行います。
// 暦は上流（jpholiday クレート）と同じく先発グレゴリオ暦です。

/**
 * `year` / `month` / `day` を持つ日付オブジェクト。
 *
 * `month` は 1〜12、`day` は 1〜31 です（JS の `Date#getMonth()` と違い 1 始まり）。
 * `Temporal.PlainDate` もこの形を満たすため、そのまま渡せます。
 */
export interface PlainDateLike {
  /** 年（1〜9999）。 */
  readonly year: number;
  /** 月（1〜12）。 */
  readonly month: number;
  /** 日（1〜31）。 */
  readonly day: number;
}

/**
 * 日付として受け付ける値。
 *
 * - `"YYYY-MM-DD"` 形式の文字列（例: `"2017-01-01"`）
 * - `{ year, month, day }` オブジェクト（`Temporal.PlainDate` を含む）
 * - JS の `Date`（**日本時間 (UTC+9)** の年月日として解釈）
 */
export type DateInput = string | Date | PlainDateLike;

/** 内部で扱う正規化済みの年月日。 */
export interface Ymd {
  year: number;
  month: number;
  day: number;
}

/** 受け付ける年の下限。 */
export const MIN_YEAR = 1;
/** 受け付ける年の上限（`YYYY-MM-DD` で表せる範囲）。 */
export const MAX_YEAR = 9999;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 指定年が閏年かどうか（先発グレゴリオ暦）。 */
export function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

/** 指定年月の日数（`month` は 1〜12）。 */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/** `YYYY-MM-DD` 形式の文字列へ変換します。 */
export function toIso(ymd: Ymd): string {
  return `${String(ymd.year).padStart(4, "0")}-${String(ymd.month).padStart(2, "0")}-${String(ymd.day).padStart(2, "0")}`;
}

/** 年が整数でなければ `TypeError`、範囲外なら `RangeError` を投げます。 */
export function assertYear(year: unknown): asserts year is number {
  if (typeof year !== "number" || !Number.isInteger(year)) {
    throw new TypeError(`jpholiday: year must be an integer, got ${describe(year)}`);
  }
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`jpholiday: year must be between ${MIN_YEAR} and ${MAX_YEAR}, got ${year}`);
  }
}

/** 月が整数でなければ `TypeError` を投げます（範囲は検査しない）。 */
export function assertIntegerMonth(month: unknown): asserts month is number {
  if (typeof month !== "number" || !Number.isInteger(month)) {
    throw new TypeError(`jpholiday: month must be an integer, got ${describe(month)}`);
  }
}

/**
 * 受け取った日付表現を正規化します。
 *
 * @throws {TypeError} 日付として解釈できない型・整数でない年月日
 * @throws {RangeError} 形式不正な文字列・実在しない日付・範囲外の年・Invalid Date
 */
export function normalizeDate(input: unknown): Ymd {
  if (typeof input === "string") return parseIsoDate(input);
  if (isDateObject(input)) return fromJsDate(input);
  if (typeof input === "object" && input !== null) {
    const { year, month, day } = input as Partial<Record<"year" | "month" | "day", unknown>>;
    return fromFields(year, month, day);
  }
  throw new TypeError(
    `jpholiday: expected a "YYYY-MM-DD" string, a Date or a { year, month, day } object, got ${describe(input)}`,
  );
}

/**
 * `(date)` または `(year, month, day)` の引数列を正規化します。
 */
export function normalizeDateArgs(args: readonly unknown[]): Ymd {
  if (args.length === 1) return normalizeDate(args[0]);
  if (args.length === 3) return fromFields(args[0], args[1], args[2]);
  throw new TypeError(`jpholiday: expected (date) or (year, month, day), got ${args.length} argument(s)`);
}

function parseIsoDate(input: string): Ymd {
  const match = ISO_DATE.exec(input);
  if (match === null) {
    throw new RangeError(`jpholiday: invalid date string ${JSON.stringify(input)} (expected "YYYY-MM-DD")`);
  }
  return validate({ year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) });
}

function fromJsDate(date: Date): Ymd {
  const time = date.getTime();
  if (Number.isNaN(time)) {
    throw new RangeError("jpholiday: Invalid Date");
  }
  // 日本時間 (UTC+9) の壁時計で年月日を求める。日本は 1952 年以降サマータイムがないため固定オフセット。
  const jst = new Date(time + JST_OFFSET_MS);
  return validate({ year: jst.getUTCFullYear(), month: jst.getUTCMonth() + 1, day: jst.getUTCDate() });
}

function fromFields(year: unknown, month: unknown, day: unknown): Ymd {
  for (const [label, value] of [
    ["year", year],
    ["month", month],
    ["day", day],
  ] as const) {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      throw new TypeError(`jpholiday: ${label} must be an integer, got ${describe(value)}`);
    }
  }
  return validate({ year: year as number, month: month as number, day: day as number });
}

function validate(ymd: Ymd): Ymd {
  const { year, month, day } = ymd;
  if (year < MIN_YEAR || year > MAX_YEAR) {
    throw new RangeError(`jpholiday: year must be between ${MIN_YEAR} and ${MAX_YEAR}, got ${year}`);
  }
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) {
    throw new RangeError(`jpholiday: invalid date: ${toIso(ymd)}`);
  }
  return ymd;
}

function isDateObject(value: unknown): value is Date {
  // 別レルム（iframe 等）で作られた Date も受け付けるため instanceof ではなく内部タグで判定する。
  return Object.prototype.toString.call(value) === "[object Date]";
}

function describe(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "object") return Object.prototype.toString.call(value);
  return String(value);
}

/**
 * 1970-01-01 を 0 とする通算日（epoch day）を返します。
 *
 * Howard Hinnant の days_from_civil アルゴリズム（先発グレゴリオ暦）。
 */
export function toEpochDay(ymd: Ymd): number {
  const y = ymd.month <= 2 ? ymd.year - 1 : ymd.year;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const mp = (ymd.month + 9) % 12;
  const doy = Math.floor((153 * mp + 2) / 5) + ymd.day - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** {@link toEpochDay} の逆変換。 */
export function fromEpochDay(epochDay: number): Ymd {
  const z = epochDay + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  return { year, month, day };
}

/** ISO 曜日（月曜=1 〜 日曜=7）を返します。1970-01-01 は木曜日。 */
export function isoWeekdayOfEpochDay(epochDay: number): number {
  return ((((epochDay + 3) % 7) + 7) % 7) + 1;
}
