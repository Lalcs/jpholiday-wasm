#!/usr/bin/env node
// Rust クレートを WASM にビルドし、TypeScript から import できる形で ts/generated/ に出力する。
//
// 1. cargo build --target wasm32-unknown-unknown --release
// 2. wasm-bindgen --target web --omit-default-module-path（import.meta.url を含まないグルー）
// 3. wasm-opt -Oz（サイズ最適化）
// 4. 最適化済み WASM を base64 文字列として ts/generated/wasm-base64.ts に埋め込む
//
// 必要なもの: Rust (wasm32-unknown-unknown ターゲット), wasm-bindgen-cli（Cargo.lock と同じ版）,
// wasm-opt（devDependencies の binaryen が提供。npm scripts 経由で実行すると PATH に入る）。

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, statSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const crateName = "jpholiday_wasm";
const outDir = join(root, "ts", "generated");

function run(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.error) {
    throw new Error(`failed to run ${cmd}: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`${cmd} exited with status ${result.status}`);
  }
}

function capture(cmd, args) {
  const result = spawnSync(cmd, args, { cwd: root, encoding: "utf8", shell: process.platform === "win32" });
  if (result.error || result.status !== 0) {
    return null;
  }
  return result.stdout.trim();
}

/** Cargo.lock に記録された wasm-bindgen のバージョンを返す。 */
function lockedWasmBindgenVersion() {
  const lock = readFileSync(join(root, "Cargo.lock"), "utf8");
  const match = /\[\[package\]\]\nname = "wasm-bindgen"\nversion = "([^"]+)"/.exec(lock);
  if (!match) throw new Error("wasm-bindgen not found in Cargo.lock");
  return match[1];
}

function checkWasmBindgenCli() {
  const expected = lockedWasmBindgenVersion();
  const output = capture("wasm-bindgen", ["--version"]);
  if (output === null) {
    throw new Error(
      `wasm-bindgen CLI not found. Install it with:\n  cargo install wasm-bindgen-cli --version ${expected} --locked`,
    );
  }
  const actual = output.split(/\s+/)[1];
  if (actual !== expected) {
    throw new Error(
      `wasm-bindgen CLI version mismatch: CLI is ${actual}, Cargo.lock has ${expected}.\n` +
        `  cargo install wasm-bindgen-cli --version ${expected} --locked --force`,
    );
  }
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KiB`;

checkWasmBindgenCli();

run("cargo", ["build", "--release", "--locked", "--target", "wasm32-unknown-unknown"]);

const work = mkdtempSync(join(tmpdir(), "jpholiday-wasm-"));
try {
  run("wasm-bindgen", [
    join(root, "target", "wasm32-unknown-unknown", "release", `${crateName}.wasm`),
    "--out-dir",
    work,
    "--out-name",
    crateName,
    "--target",
    "web",
    "--omit-default-module-path",
  ]);

  const bindgenWasm = join(work, `${crateName}_bg.wasm`);
  const optimizedWasm = join(work, `${crateName}.opt.wasm`);
  // rustc の wasm32-unknown-unknown が既定で有効にする機能に合わせる。
  run("wasm-opt", [
    "-Oz",
    "--enable-bulk-memory",
    "--enable-multivalue",
    "--enable-mutable-globals",
    "--enable-nontrapping-float-to-int",
    "--enable-reference-types",
    "--enable-sign-ext",
    "--strip-debug",
    "--strip-producers",
    bindgenWasm,
    "-o",
    optimizedWasm,
  ]);

  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  const glue = readFileSync(join(work, `${crateName}.js`), "utf8");
  if (glue.includes("import.meta")) {
    throw new Error("generated glue unexpectedly references import.meta");
  }
  writeFileSync(join(outDir, `${crateName}.js`), glue);
  copyFileSync(join(work, `${crateName}.d.ts`), join(outDir, `${crateName}.d.ts`));

  const bytes = readFileSync(optimizedWasm);
  writeFileSync(
    join(outDir, "wasm-base64.ts"),
    "// このファイルは scripts/build-wasm.mjs が生成します。手で編集しないでください。\n" +
      `export const wasmBase64: string =\n  "${bytes.toString("base64")}";\n`,
  );

  console.log(
    `[build-wasm] wasm-bindgen: ${kb(statSync(bindgenWasm).size)} -> wasm-opt: ${kb(bytes.length)} ` +
      `(base64: ${kb(Math.ceil(bytes.length / 3) * 4)})`,
  );
} finally {
  rmSync(work, { recursive: true, force: true });
}
