# my-shortener

Cloudflare Workers + Workers KV で動く URL 短縮サービス。

- `GET /` 入力フォーム
- `POST /shorten` `{"target": "https://...", "token": "<Turnstile token>"}` → `{"short": "https://.../aB3dEf"}`
  - [Turnstile](https://developers.cloudflare.com/turnstile/) でボット対策をしており、トークンが検証できないと 403
- `GET /<id>` 元のURLへ 302 リダイレクト

## セットアップ

```bash
npm install
npx wrangler kv namespace create LINKS   # 出力された id を控える
cp wrangler.jsonc.example wrangler.jsonc # <YOUR_KV_NAMESPACE_ID> を控えた id に置き換える
cp .dev.vars.example .dev.vars           # ローカル開発用の Turnstile テストキー
```

### Turnstile

1. ダッシュボードの Turnstile でウィジェットを作成し、ホスト名に Worker のドメイン（例: `my-shortener.<subdomain>.workers.dev`）を追加する
2. Site Key を `wrangler.jsonc` の `vars.TURNSTILE_SITE_KEY` に書く
3. Secret Key を登録する: `npx wrangler secret put TURNSTILE_SECRET_KEY`

ローカル開発とテストでは Cloudflare 公式の[テスト用キー](https://developers.cloudflare.com/turnstile/troubleshooting/testing/)を使うため、本番のキーは不要です。

`wrangler.jsonc` は実際の KV namespace ID を含むため `.gitignore` で Git 管理から外しています。

## コマンド

| 用途 | コマンド |
| --- | --- |
| ローカル起動 | `npm run dev` |
| テスト | `npx vitest run` |
| デプロイ | `npm run deploy` |
