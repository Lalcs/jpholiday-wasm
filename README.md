# jpholiday

[![npm](https://img.shields.io/npm/v/jpholiday.svg)](https://www.npmjs.com/package/jpholiday)
[![CI](https://github.com/Lalcs/jpholiday-wasm/actions/workflows/ci.yml/badge.svg)](https://github.com/Lalcs/jpholiday-wasm/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/npm/l/jpholiday.svg)](./LICENSE)
[![Python](https://img.shields.io/badge/Python-jpholiday-3776AB?logo=python&logoColor=white)](https://github.com/Lalcs/jpholiday)
[![Rust](https://img.shields.io/badge/Rust-jpholiday-000000?logo=rust&logoColor=white)](https://github.com/Lalcs/jpholiday-rust)

![JPHoliday](./docs/images/logo.png)

このライブラリは、[内閣府](https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html)
が公表しているデータを基に、日本の国民の祝日を JavaScript / TypeScript から簡単に取得できるようにしたものです。
判定ロジックは Rust 製の [jpholiday](https://github.com/Lalcs/jpholiday-rust) を WebAssembly 化したもので、
振替休日・国民の休日・春分/秋分の日（天文計算）まで再現します。

**2027年**までの祝日は公式発表された内容に基づいて動作確認済みです。
それ以降についても取得は可能ですが、内閣府からの正式な公表がないため、正確性は保証されません。

- **TypeScript の型定義を同梱**（ESM / CommonJS の両方に対応）
- **同期 API・初期化不要**: WASM は JS に埋め込まれているため、`import` するだけで使えます（`await init()` もバンドラーの設定も不要）
- **依存ゼロ**: 実行時の依存パッケージはありません

## Installation

```sh
npm install jpholiday
```

## 日付の指定方法

日付を受け取る関数は、次のどの形式でも受け付けます。

```ts
import { isHoliday } from "jpholiday";

isHoliday("2017-01-01"); // "YYYY-MM-DD" 形式の文字列
isHoliday({ year: 2017, month: 1, day: 1 }); // { year, month, day } オブジェクト（month は 1 始まり）
isHoliday(Temporal.PlainDate.from("2017-01-01")); // Temporal.PlainDate もそのまま渡せる
isHoliday(2017, 1, 1); // 引数で (year, month, day)
isHoliday(new Date()); // JS の Date（日本時間 UTC+9 の年月日として解釈）
```

> [!NOTE]
> **`Date` は実行環境のタイムゾーンに関係なく、常に日本時間 (UTC+9) の年月日として解釈します。**
> そのため、UTC で動くサーバーでも `isHoliday(new Date())` は「今、日本で祝日か」を正しく返します。
> `new Date("2017-01-01")`（UTC 0 時 = 日本時間 9 時）も、どのタイムゾーンでも 1 月 1 日になります。
> 一方、UTC+10 以東（オーストラリア東部・ニュージーランドなど）で `new Date(2017, 0, 1)` のように
> 現地時刻の 0 時を作ると日本時間では前日になるため、そのような場合は文字列か `{ year, month, day }` を使ってください。

- 戻り値の日付は、タイムゾーンの影響を受けない `"YYYY-MM-DD"` 形式の文字列です。
- 年は 1〜9999 の範囲で指定できます。
- 型が誤っている場合は `TypeError`、実在しない日付（`"2017-02-30"` など）や形式が不正な文字列の場合は `RangeError` を投げます。

## Functions

### 指定日の祝日名を取得

```ts
import { isHolidayName } from "jpholiday";

isHolidayName("2017-01-01");
// => "元日"
isHolidayName("2017-01-02");
// => "元日 振替休日"
isHolidayName("2017-01-03");
// => null
```

### 指定日が祝日か判定

```ts
import { isHoliday } from "jpholiday";

isHoliday("2017-01-01");
// => true
isHoliday("2017-01-02");
// => true
isHoliday("2017-01-03");
// => false
```

### 指定日の祝日を取得

```ts
import { holidays } from "jpholiday";

holidays("2017-01-01");
// => [{ date: "2017-01-01", name: "元日" }]
holidays("2017-01-03");
// => []
```

### 指定年の祝日を取得

```ts
import { yearHolidays } from "jpholiday";

yearHolidays(2017);
// => [
//   { date: "2017-01-01", name: "元日" },
//   { date: "2017-01-02", name: "元日 振替休日" },
//   { date: "2017-01-09", name: "成人の日" },
//   { date: "2017-02-11", name: "建国記念の日" },
//   { date: "2017-03-20", name: "春分の日" },
//   { date: "2017-04-29", name: "昭和の日" },
//   { date: "2017-05-03", name: "憲法記念日" },
//   { date: "2017-05-04", name: "みどりの日" },
//   { date: "2017-05-05", name: "こどもの日" },
//   { date: "2017-07-17", name: "海の日" },
//   { date: "2017-08-11", name: "山の日" },
//   { date: "2017-09-18", name: "敬老の日" },
//   { date: "2017-09-23", name: "秋分の日" },
//   { date: "2017-10-09", name: "体育の日" },
//   { date: "2017-11-03", name: "文化の日" },
//   { date: "2017-11-23", name: "勤労感謝の日" },
//   { date: "2017-12-23", name: "天皇誕生日" },
// ]
```

### 指定月の祝日を取得

```ts
import { monthHolidays } from "jpholiday";

monthHolidays(2017, 5);
// => [
//   { date: "2017-05-03", name: "憲法記念日" },
//   { date: "2017-05-04", name: "みどりの日" },
//   { date: "2017-05-05", name: "こどもの日" },
// ]
```

`month` が 1〜12 の範囲外の場合は空配列を返します。

### 指定範囲の祝日を取得

```ts
import { between } from "jpholiday";

between("2017-01-01", "2017-05-03"); // 両端を含む
// => [
//   { date: "2017-01-01", name: "元日" },
//   { date: "2017-01-02", name: "元日 振替休日" },
//   { date: "2017-01-09", name: "成人の日" },
//   { date: "2017-02-11", name: "建国記念の日" },
//   { date: "2017-03-20", name: "春分の日" },
//   { date: "2017-04-29", name: "昭和の日" },
//   { date: "2017-05-03", name: "憲法記念日" },
// ]
```

開始日が終了日より後の場合は空配列を返します。

### 独自の休日を追加

```ts
import { isHoliday, isHolidayName, type OriginalHolidayChecker, register } from "jpholiday";

const testHoliday: OriginalHolidayChecker = {
  isHoliday: (date) => date.iso === "2020-02-09",
  holidayName: (date) => "特別休暇",
};

register(testHoliday);

isHolidayName("2020-02-09");
// => "特別休暇"
isHoliday("2020-02-09");
// => true
```

チェッカーの `isHoliday` / `holidayName` には、次の形の日付（`HolidayDate`）が渡されます。

```ts
{
  year: 2020,
  month: 2,      // 1〜12
  day: 9,
  weekday: 7,    // ISO 曜日（月曜=1 〜 日曜=7）
  iso: "2020-02-09",
}
```

```ts
// 例: 毎年 2 月 9 日の創立記念日、毎週金曜日のノー残業デー
register({ isHoliday: (d) => d.month === 2 && d.day === 9, holidayName: () => "創立記念日" });
register({ isHoliday: (d) => d.weekday === 5, holidayName: () => "ノー残業デー" });
```

- 独自の休日は、組込みの祝日の後ろに登録順で並びます。
- 独自の休日は振替休日・国民の休日の判定対象になりません（日曜の独自休日の翌日は振替休日にならない、など）。
- 同じオブジェクトを重複して登録しても 1 回分として扱います。

### 独自の休日を削除

```ts
import { isHoliday, isHolidayName, register, unregister } from "jpholiday";

const testHoliday = {
  isHoliday: (date) => date.iso === "2020-02-09",
  holidayName: () => "特別休暇",
};

register(testHoliday);

// 登録時と同じオブジェクトを渡して登録解除
unregister(testHoliday);

isHolidayName("2020-02-09");
// => null
isHoliday("2020-02-09");
// => false
```

## Class

`JPHoliday` クラスは関数 API と同じメソッドを持ち、**独自の休日の登録状態をインスタンスごとに分離**できます
（関数 API の `register` はモジュール全体で共有されます）。

```ts
import { JPHoliday } from "jpholiday";

const jpholiday = new JPHoliday();

jpholiday.holidays("2017-01-01");
// => [{ date: "2017-01-01", name: "元日" }]
jpholiday.isHoliday("2017-01-01");
// => true
jpholiday.isHolidayName("2017-01-02");
// => "元日 振替休日"
jpholiday.yearHolidays(2017);
jpholiday.monthHolidays(2017, 5);
jpholiday.between("2017-01-01", "2017-05-03");

const testHoliday = {
  isHoliday: (date) => date.iso === "2020-02-09",
  holidayName: () => "特別休暇",
};

jpholiday.register(testHoliday);
jpholiday.holidays("2020-02-09");
// => [{ date: "2020-02-09", name: "特別休暇" }]

jpholiday.unregister(testHoliday);
jpholiday.holidays("2020-02-09");
// => []
```

## Types

```ts
import type { DateInput, Holiday, HolidayDate, OriginalHolidayChecker, PlainDateLike } from "jpholiday";

type DateInput = string | Date | PlainDateLike;

interface PlainDateLike {
  readonly year: number;
  readonly month: number; // 1〜12
  readonly day: number;
}

interface Holiday {
  readonly date: string; // "YYYY-MM-DD"
  readonly name: string;
}

interface HolidayDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly weekday: number; // 月曜=1 〜 日曜=7
  readonly iso: string; // "YYYY-MM-DD"
}

interface OriginalHolidayChecker {
  isHoliday(date: HolidayDate): boolean;
  holidayName(date: HolidayDate): string;
}
```

## 対応環境

| 環境 | 対応 |
| --- | --- |
| Node.js 20 以降（ESM / CommonJS） | ✅ CI で検証 |
| ブラウザ（メインスレッド / Web Worker） | ✅ |
| Vite / webpack / Rollup / esbuild などのバンドラー | ✅ 設定不要（通常の JS として扱える） |
| Deno / Bun | 未検証（WebAssembly と `TextDecoder` があれば動作する想定） |
| Cloudflare Workers・Vercel Edge Functions など、実行時の WASM コンパイルを禁止する環境 | ❌ |

- バンドルに含まれるサイズは約 80KB（gzip 後 約 34KB）で、その大半は埋め込み WASM です。
- WASM の初期化は、最初に関数を呼んだときに一度だけ同期的に行います（`import` しただけでは初期化しません）。
- Content Security Policy を設定しているページでは、`script-src` に `'wasm-unsafe-eval'` が必要です。

## License

MIT License. 詳細は [LICENSE](./LICENSE) を参照してください。
