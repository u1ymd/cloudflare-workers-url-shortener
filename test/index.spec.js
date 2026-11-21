import { SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const VALID_TOKEN = "valid-token";

const shorten = (target, token = VALID_TOKEN) =>
	SELF.fetch("http://example.com/shorten", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ target, token }),
	});

// Turnstile の siteverify API への問い合わせを差し替える
let verifyCalls;
beforeEach(() => {
	verifyCalls = [];
	const realFetch = globalThis.fetch;
	vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
		const url = typeof input === "string" ? input : input.url;
		if (url !== "https://challenges.cloudflare.com/turnstile/v0/siteverify") {
			return realFetch(input, init);
		}
		const form = init.body;
		verifyCalls.push({ secret: form.get("secret"), response: form.get("response") });
		return Response.json({ success: form.get("response") === VALID_TOKEN });
	});
});
afterEach(() => vi.restoreAllMocks());

describe("my-shortener", () => {
	it("GET / は入力フォームのHTMLを返す", async () => {
		const response = await SELF.fetch("http://example.com/");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/html");
		const html = await response.text();
		expect(html).toContain('id="form"');
		expect(html).toContain('data-sitekey="1x00000000000000000000AA"');
	});

	it("Turnstile のトークンが無い・不正なら 403", async () => {
		expect((await shorten("https://example.org/", "")).status).toBe(403);
		expect((await shorten("https://example.org/", "bad-token")).status).toBe(403);
		expect(verifyCalls.map((c) => c.response)).toEqual(["bad-token"]);
	});

	it("siteverify には Secret Key とトークンを送る", async () => {
		expect((await shorten("https://example.org/")).status).toBe(200);
		expect(verifyCalls).toEqual([
			{ secret: "1x0000000000000000000000000000000AA", response: VALID_TOKEN },
		]);
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
