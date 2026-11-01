//! 上流クレート（ネイティブ実行）の全祝日を `YYYY-MM-DD\t名称` 形式で出力する。
//!
//! WASM 版の出力と突き合わせるフィクスチャ（`test/fixtures/holidays.tsv`）の生成に使う。
//!
//! ```sh
//! cargo run --example dump > test/fixtures/holidays.tsv
//! ```

/// フィクスチャに含める年の範囲（両端を含む）。
const START_YEAR: i32 = 1948;
const END_YEAR: i32 = 2099;

fn main() {
    let mut out = String::new();
    for year in START_YEAR..=END_YEAR {
        for (date, name) in jpholiday::year_holidays(year) {
            out.push_str(&format!("{date}\t{name}\n"));
        }
    }
    print!("{out}");
}
