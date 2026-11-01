/**
 * 埋め込み WASM の遅延初期化（内部モジュール）。
 *
 * WASM バイナリは base64 文字列として JS に埋め込まれており、最初の呼び出し時に同期的に
 * インスタンス化します。これにより Node.js / ブラウザ / 各種バンドラーで追加設定なしに、
 * `await` 不要の同期 API として利用できます。
 */

import * as bindings from "./generated/jpholiday_wasm.js";
import { wasmBase64 } from "./generated/wasm-base64.js";

let initialized = false;

function decodeBase64(base64: string): Uint8Array {
  // ES2026 の Uint8Array.fromBase64 があれば使い、なければ atob で復号する。
  const native = (Uint8Array as unknown as { fromBase64?: (input: string) => Uint8Array }).fromBase64;
  if (typeof native === "function") {
    return native.call(Uint8Array, base64);
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function wasm(): typeof bindings {
  if (!initialized) {
    bindings.initSync({ module: decodeBase64(wasmBase64) });
    initialized = true;
  }
  return bindings;
}

/** 指定日の組込み祝日名（振替休日・国民の休日を含む）。 */
export function holidayNames(year: number, month: number, day: number): string[] {
  return wasm().holidayNames(year, month, day);
}

/** 年の組込み祝日（平坦な `[日付, 名称, ...]`）。 */
export function yearHolidays(year: number): string[] {
  return wasm().yearHolidays(year);
}

/** 月の組込み祝日（平坦な `[日付, 名称, ...]`）。 */
export function monthHolidays(year: number, month: number): string[] {
  return wasm().monthHolidays(year, month);
}

/** 範囲（両端を含む）の組込み祝日（平坦な `[日付, 名称, ...]`）。 */
export function between(
  startYear: number,
  startMonth: number,
  startDay: number,
  endYear: number,
  endMonth: number,
  endDay: number,
): string[] {
  return wasm().between(startYear, startMonth, startDay, endYear, endMonth, endDay);
}
