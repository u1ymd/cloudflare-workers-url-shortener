import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [
		cloudflareTest({
			wrangler: { configPath: "./wrangler.jsonc" },
			// Cloudflare 公式のテスト用キー（必ず成功する）
			miniflare: {
				bindings: {
					TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
					TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
				},
			},
		}),
	],
});
