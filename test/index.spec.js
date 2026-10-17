import { SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

const shorten = (target) =>
	SELF.fetch("http://example.com/shorten", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ target }),
	});

describe("my-shortener", () => {
	it("GET / は入力フォームのHTMLを返す", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		expect(await response.text()).toContain('id="form"');
	});

	it("http/https 以外のURLは 400", async () => {
		expect((await shorten("javascript:alert(1)")).status).toBe(400);
		expect((await shorten("not a url")).status).toBe(400);
	});

	it("自分自身のURLは 400", async () => {
		expect((await shorten("http://example.com/abc")).status).toBe(400);
	});

	it("GET /shorten は 405", async () => {
		const response = await SELF.fetch("http://example.com/shorten");
		expect(response.status).toBe(405);
	});

	it("短縮して、そのURLが元のURLへリダイレクトされる", async () => {
		const res = await shorten("https://developers.cloudflare.com/workers/");
		expect(res.status).toBe(200);
		const { short } = await res.json();
		const redirect = await SELF.fetch(short, { redirect: "manual" });
		expect(redirect.status).toBe(302);
		expect(redirect.headers.get("Location")).toBe("https://developers.cloudflare.com/workers/");
	});

	it("未登録のキーは 404", async () => {
		const response = await SELF.fetch("http://example.com/nope00");
		expect(response.status).toBe(404);
	});
});
