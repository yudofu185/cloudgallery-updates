// scripts/validate.mjs
// app-version.json を公開前に検査する（依存パッケージなし。Node.js 18 以上）。
//
//   node scripts/validate.mjs [app-version.json のパス]
//
// 管理ツール（update.rs）が受け付けない内容や、うっかり通知してしまう内容を止める:
//   - 形式（schemaVersion 2・必須項目・余計な項目）
//   - 日時はタイムゾーン付きの ISO 8601（タイムゾーンが無いと端末ごとに解釈が変わる）
//   - バージョンは x.y.z、minimumSupported は version 以下
//   - downloadUrl は https かつ許可ホスト（アプリ側でも同じ制限）
//   - releaseNotes は 600 文字まで、ファイル全体は 64 KB まで
// 予約公開（publishedAt が未来）の場合は、エラーではなく案内を表示する。

import { readFileSync } from "node:fs";

const MAX_BYTES = 64 * 1024;
const MAX_NOTES = 600;
const ALLOWED_HOSTS = ["booth.pm", "github.com", "yudofu185.github.io"];
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)([-+][0-9A-Za-z.-]+)?$/;
const CHANNEL_KEYS = ["version", "publishedAt", "downloadUrl", "releaseNotes", "security", "minimumSupported"];

const path = process.argv[2] ?? "app-version.json";
const errors = [];
const notes = [];

function parseDate(value, where) {
  if (typeof value !== "string" || !DATE_TIME.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${where}: タイムゾーン付きの ISO 8601 で書いてください（例: 2026-10-24T18:00:00+09:00）`);
    return null;
  }
  return new Date(value);
}

function parseVersion(value, where) {
  const m = typeof value === "string" ? VERSION.exec(value) : null;
  if (!m) {
    errors.push(`${where}: x.y.z 形式で書いてください（例: 1.2.0）`);
    return null;
  }
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function compare(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

function checkUrl(value, where) {
  let u;
  try { u = new URL(value); } catch { errors.push(`${where}: URL として読めません`); return; }
  const host = u.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTS.some(h => host === h || host.endsWith(`.${h}`));
  if (u.protocol !== "https:" || u.username || u.password || !allowed) {
    errors.push(`${where}: https で、${ALLOWED_HOSTS.join(" / ")}（とそのサブドメイン）の URL だけが使えます`);
  }
}

function checkChannel(name, ch, updatedAt) {
  const where = `channels.${name}`;
  if (typeof ch !== "object" || ch === null || Array.isArray(ch)) {
    errors.push(`${where}: オブジェクトで書いてください`);
    return;
  }
  for (const key of Object.keys(ch)) {
    if (!CHANNEL_KEYS.includes(key)) errors.push(`${where}.${key}: 使えない項目です（綴りを確認してください）`);
  }
  for (const key of ["version", "publishedAt", "downloadUrl"]) {
    if (!(key in ch)) errors.push(`${where}.${key}: 必須です`);
  }
  const version = "version" in ch ? parseVersion(ch.version, `${where}.version`) : null;
  const published = "publishedAt" in ch ? parseDate(ch.publishedAt, `${where}.publishedAt`) : null;
  if ("downloadUrl" in ch) checkUrl(ch.downloadUrl, `${where}.downloadUrl`);
  if ("releaseNotes" in ch) {
    if (typeof ch.releaseNotes !== "string") errors.push(`${where}.releaseNotes: 文字列で書いてください`);
    else if ([...ch.releaseNotes].length > MAX_NOTES) errors.push(`${where}.releaseNotes: ${MAX_NOTES} 文字までにしてください`);
  }
  if ("security" in ch && typeof ch.security !== "boolean") errors.push(`${where}.security: true / false で書いてください`);
  if ("minimumSupported" in ch) {
    const min = parseVersion(ch.minimumSupported, `${where}.minimumSupported`);
    if (min && version && compare(min, version) > 0) {
      errors.push(`${where}.minimumSupported: version（${ch.version}）より新しくはできません`);
    }
  }
  if (published) {
    if (published > new Date()) {
      notes.push(`${where}: ${ch.publishedAt} まで通知されません（予約公開）`);
    }
    if (updatedAt && published.getTime() - updatedAt.getTime() > 30 * 24 * 3600 * 1000) {
      notes.push(`${where}: 公開日時が updatedAt より 30 日以上先です。日付の打ち間違いがないか確認してください`);
    }
  }
}

let text;
try {
  text = readFileSync(path);
} catch (e) {
  console.error(`✕ ${path} を読めません: ${e.message}`);
  process.exit(1);
}
if (text.length > MAX_BYTES) errors.push(`ファイルが大きすぎます（${text.length} バイト。${MAX_BYTES} バイトまで）`);

let doc;
try {
  doc = JSON.parse(text.toString("utf8"));
} catch (e) {
  console.error(`✕ JSON として読めません: ${e.message}`);
  process.exit(1);
}

for (const key of Object.keys(doc)) {
  if (!["$schema", "schemaVersion", "updatedAt", "channels"].includes(key)) errors.push(`${key}: 使えない項目です`);
}
if (doc.schemaVersion !== 2) errors.push("schemaVersion: 2 にしてください");
const updatedAt = parseDate(doc.updatedAt, "updatedAt");
if (typeof doc.channels !== "object" || doc.channels === null) {
  errors.push("channels: 必須です");
} else {
  if (!("stable" in doc.channels)) errors.push("channels.stable: 必須です");
  for (const [name, ch] of Object.entries(doc.channels)) {
    if (!["stable", "beta"].includes(name)) {
      errors.push(`channels.${name}: チャンネルは stable / beta のみです`);
      continue;
    }
    checkChannel(name, ch, updatedAt);
  }
}

for (const n of notes) console.log(`ℹ ${n}`);
if (errors.length > 0) {
  for (const e of errors) console.error(`✕ ${e}`);
  console.error(`\n${errors.length} 件の問題があります。公開しないでください。`);
  process.exit(1);
}
console.log(`✓ ${path} は公開できる形式です`);
for (const [name, ch] of Object.entries(doc.channels)) {
  console.log(`  ${name}: v${ch.version}（${ch.publishedAt} 公開${ch.security ? "・セキュリティ更新" : ""}）`);
}
