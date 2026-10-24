# cloudgallery-updates

VRChat Cloud Gallery Manager（管理ツール）の**更新情報の配信用リポジトリ**です。
管理ツールは起動時に次の URL を読み、新しいバージョンがあれば画面下にお知らせを出します。

```
https://yudofu185.github.io/cloudgallery-updates/app-version.json
```

このリポジトリには更新情報（`app-version.json`）だけを置きます。**配布物（インストーラ）や秘密鍵は置きません。**

| ファイル | 内容 |
|---------|------|
| `app-version.json` | 更新情報（公開されるのはこのファイル） |
| `app-version.schema.json` | 形式の定義（エディタの入力補完・検査用） |
| `scripts/validate.mjs` | 公開前の検査（`node scripts/validate.mjs`） |
| `.github/workflows/validate.yml` | push のたびに自動で検査する |
| `.nojekyll` | GitHub Pages で Jekyll の変換をしない |

## 更新を知らせる手順（要約）

1. BOOTH の配布物を差し替える（**必ず先に**）
2. `app-version.json` の該当チャンネルの `version`・`publishedAt`・`releaseNotes` を書き換え、`updatedAt` を今の日時にする
3. `node scripts/validate.mjs` で検査する
4. commit して push する（数分で GitHub Pages に反映される）

詳しい手順・設計は CloudGallery リポジトリの次の文書を参照してください。

- 手順書: `project/vrchat-gallery/docs/UPDATE_DELIVERY.md`
- 設計: `project/vrchat-gallery/docs/UPDATE_FEED_DESIGN.md`
