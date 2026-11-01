//! [`jpholiday`] クレートを npm パッケージ `jpholiday` から使うための WebAssembly バインディング。
//!
//! このクレートは TypeScript ラッパー（`ts/`）の内部実装であり、利用者に直接公開する API ではありません。
//! 入力値の検証（型・範囲・実在する日付か）と独自祝日の管理は TypeScript 側で行い、ここでは
//! 組込みの祝日（振替休日・国民の休日を含む）の計算だけを上流クレートに委譲します。
//!
//! 一覧系の関数は `[日付, 名称, 日付, 名称, ...]` のように「`YYYY-MM-DD` 形式の日付」と「祝日名」を
//! 交互に並べた平坦な文字列配列を返します。JS 側でオブジェクトに組み立てることで、wasm-bindgen の
//! 追加依存（serde 等）や WASM 側で寿命を管理するオブジェクトを持たずに済みます。

#![forbid(unsafe_code)]

use jpholiday::Date;
use wasm_bindgen::prelude::*;

/// `(日付, 名称)` の列を平坦な文字列配列へ変換します。
fn flatten(pairs: Vec<(Date, String)>) -> Vec<String> {
    let mut out = Vec::with_capacity(pairs.len() * 2);
    for (date, name) in pairs {
        out.push(date.to_string());
        out.push(name);
    }
    out
}

/// 指定日に該当するすべての組込み祝日名を返します（該当しなければ空）。
///
/// 実在しない日付は TypeScript 側で弾かれる前提ですが、念のため空を返します。
#[wasm_bindgen(js_name = holidayNames)]
pub fn holiday_names(year: i32, month: u32, day: u32) -> Vec<String> {
    match Date::new(year, month, day) {
        Ok(date) => jpholiday::holidays(date)
            .into_iter()
            .map(|h| h.name)
            .collect(),
        Err(_) => Vec::new(),
    }
}

/// その年のすべての組込み祝日を平坦な `[日付, 名称, ...]` 配列で返します。
#[wasm_bindgen(js_name = yearHolidays)]
pub fn year_holidays(year: i32) -> Vec<String> {
    flatten(jpholiday::year_holidays(year))
}

/// その月のすべての組込み祝日を平坦な `[日付, 名称, ...]` 配列で返します。
///
/// `month` が範囲外なら空を返します（上流と同じ）。
#[wasm_bindgen(js_name = monthHolidays)]
pub fn month_holidays(year: i32, month: u32) -> Vec<String> {
    flatten(jpholiday::month_holidays(year, month))
}

/// 指定範囲（両端を含む）のすべての組込み祝日を平坦な `[日付, 名称, ...]` 配列で返します。
///
/// `start > end` なら空を返します（上流と同じ）。実在しない日付が含まれる場合も空を返します。
#[wasm_bindgen]
pub fn between(
    start_year: i32,
    start_month: u32,
    start_day: u32,
    end_year: i32,
    end_month: u32,
    end_day: u32,
) -> Vec<String> {
    match (
        Date::new(start_year, start_month, start_day),
        Date::new(end_year, end_month, end_day),
    ) {
        (Ok(start), Ok(end)) => flatten(jpholiday::between(start, end)),
        _ => Vec::new(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn holiday_names_returns_all_names() {
        assert_eq!(holiday_names(2017, 1, 1), vec!["元日"]);
        assert_eq!(holiday_names(2017, 1, 2), vec!["元日 振替休日"]);
        assert!(holiday_names(2017, 1, 3).is_empty());
    }

    #[test]
    fn holiday_names_invalid_date_is_empty() {
        assert!(holiday_names(2017, 2, 30).is_empty());
        assert!(holiday_names(2017, 13, 1).is_empty());
    }

    #[test]
    fn year_holidays_is_flattened() {
        let flat = year_holidays(2017);
        assert_eq!(flat.len() % 2, 0);
        assert_eq!(
            &flat[..4],
            ["2017-01-01", "元日", "2017-01-02", "元日 振替休日"]
        );
        assert_eq!(flat.len() / 2, 17);
    }

    #[test]
    fn month_holidays_out_of_range_is_empty() {
        assert_eq!(
            month_holidays(2017, 5),
            vec![
                "2017-05-03",
                "憲法記念日",
                "2017-05-04",
                "みどりの日",
                "2017-05-05",
                "こどもの日"
            ]
        );
        assert!(month_holidays(2017, 0).is_empty());
        assert!(month_holidays(2017, 13).is_empty());
    }

    #[test]
    fn between_handles_reversed_and_invalid_ranges() {
        assert_eq!(between(2017, 1, 1, 2017, 1, 2).len(), 4);
        assert!(between(2017, 1, 2, 2017, 1, 1).is_empty());
        assert!(between(2017, 2, 30, 2017, 3, 1).is_empty());
    }
}
