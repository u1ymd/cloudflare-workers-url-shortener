# my-shortener

Cloudflare Workers + Workers KV で動く URL 短縮サービス。

- `GET /` 入力フォーム
- `POST /shorten` `{"target": "https://..."}` → `{"short": "https://.../aB3dEf"}`
- `GET /<id>` 元のURLへ 302 リダイレクト

## セットアップ

```bash
npm install
npx wrangler kv namespace create LINKS   # 出力された id を控える
cp wrangler.jsonc.example wrangler.jsonc # <YOUR_KV_NAMESPACE_ID> を控えた id に置き換える
```

`wrangler.jsonc` は実際の KV namespace ID を含むため `.gitignore` で Git 管理から外しています。

## コマンド

| 用途 | コマンド |
| --- | --- |
| ローカル起動 | `npm run dev` |
| テスト | `npx vitest run` |
| デプロイ | `npm run deploy` |
