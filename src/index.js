const ID_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 6;

const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const renderPage = (siteKey) => `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>URL短縮</title>
<style>
  :root { color-scheme: light dark; --accent: #f6821f; }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 16px;
    font-family: system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", sans-serif; }
  main { width: 100%; max-width: 560px; }
  h1 { font-size: 1.6rem; margin: 0 0 4px; }
  p.lead { margin: 0 0 20px; opacity: .7; }
  form { display: flex; gap: 8px; }
  input { flex: 1; min-width: 0; padding: 12px; font-size: 1rem; border-radius: 8px;
    border: 1px solid #8886; background: transparent; color: inherit; }
  button { padding: 12px 18px; font-size: 1rem; border: 0; border-radius: 8px; cursor: pointer;
    background: var(--accent); color: #fff; font-weight: 600; }
  button:disabled { opacity: .6; cursor: wait; }
  #result { margin-top: 20px; display: none; padding: 14px; border-radius: 8px; border: 1px solid #8886; }
  #result a { word-break: break-all; font-weight: 600; color: var(--accent); }
  #result .row { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
  #result button { padding: 8px 12px; font-size: .9rem; }
  #turnstile { margin-top: 12px; }
  #error { margin-top: 12px; color: #d33; min-height: 1.2em; }
</style>
</head>
<body>
<main>
  <h1>URL短縮</h1>
  <p class="lead">長いURLを貼り付けると、短いURLを発行します。</p>
  <form id="form">
    <input id="target" type="url" placeholder="https://example.com/very/long/url" required autofocus>
    <button id="submit">短縮</button>
  </form>
  <div id="turnstile" data-sitekey="${escapeHtml(siteKey)}"></div>
  <div id="error" role="alert"></div>
  <div id="result">
    <div class="row">
      <a id="short" target="_blank" rel="noopener"></a>
      <button id="copy" type="button">コピー</button>
    </div>
  </div>
</main>
<script>
  const $ = (id) => document.getElementById(id);

  // Turnstile は最初は常に表示し、1回短縮に成功したら「必要なときだけ表示」に切り替える
  const siteKey = $("turnstile").dataset.sitekey;
  let widgetId;
  let compact = false;
  function renderTurnstile() {
    if (!$("turnstile")) {
      const el = document.createElement("div");
      el.id = "turnstile";
      $("error").before(el);
    }
    widgetId = turnstile.render("#turnstile", {
      sitekey: siteKey,
      appearance: compact ? "interaction-only" : "always",
    });
  }
  window.onTurnstileLoad = renderTurnstile;
  function refreshTurnstile(succeeded) {
    if (!window.turnstile || widgetId === undefined) return;
    if (succeeded && !compact) {
      compact = true;
      turnstile.remove(widgetId);
      renderTurnstile();
    } else {
      turnstile.reset(widgetId); // トークンは1回しか使えないので毎回取り直す
    }
  }
  // 短縮に成功したら、URLを書き換えるまでボタンを押せないようにする
  let lastShortened = null;
  function updateSubmit() {
    const done = lastShortened !== null && $("target").value.trim() === lastShortened;
    $("submit").disabled = done;
    $("submit").textContent = done ? "短縮済み" : "短縮";
    $("submit").style.cursor = done ? "default" : "";
  }
  $("target").addEventListener("input", updateSubmit);
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const target = $("target").value.trim();
    if (target === lastShortened) return;
    $("error").textContent = "";
    $("result").style.display = "none";
    const token = widgetId !== undefined ? turnstile.getResponse(widgetId) : "";
    if (!token) {
      $("error").textContent = "ロボットでないことの確認が終わるまでお待ちください";
      return;
    }
    $("submit").disabled = true;
    let succeeded = false;
    try {
      const res = await fetch("/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, token }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      $("short").textContent = $("short").href = data.short;
      $("result").style.display = "block";
      $("copy").textContent = "コピー";
      succeeded = true;
      lastShortened = target;
    } catch (err) {
      $("error").textContent = err.message;
    } finally {
      updateSubmit();
      refreshTurnstile(succeeded);
    }
  });
  $("copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("short").textContent);
    $("copy").textContent = "コピーしました";
  });
</script>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=onTurnstileLoad" async defer></script>
</body>
</html>`;

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

// Turnstile のトークンを Cloudflare に問い合わせて検証する
// https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
async function verifyTurnstile(token, secret, remoteip) {
  if (typeof token !== "string" || !token || token.length > 2048) return false;
  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  if (remoteip) form.append("remoteip", remoteip);
  try {
    const res = await fetch(TURNSTILE_VERIFY_URL, { method: "POST", body: form });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  return Array.from(bytes, (b) => ID_CHARS[b % ID_CHARS.length]).join("");
}

function parseTarget(value, origin) {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.origin === origin) return null; // 自分自身への短縮はループになるので拒否
    return u.href;
  } catch {
    return null;
  }
}

const jsonError = (error, status) => Response.json({ error }, { status });

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/") {
      return new Response(renderPage(env.TURNSTILE_SITE_KEY), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // POST /shorten で短縮URLを発行
    if (url.pathname === "/shorten") {
      if (req.method !== "POST") return jsonError("POST only", 405);

      const body = await req.json().catch(() => null);
      const target = parseTarget(body?.target, url.origin);
      if (!target) return jsonError("http:// か https:// で始まる有効なURLを入力してください", 400);

      if (!env.TURNSTILE_SECRET_KEY) return jsonError("サーバーの設定が不足しています", 500);
      const ok = await verifyTurnstile(
        body.token,
        env.TURNSTILE_SECRET_KEY,
        req.headers.get("CF-Connecting-IP"),
      );
      if (!ok) return jsonError("ロボットでないことの確認に失敗しました。もう一度お試しください", 403);

      let id;
      for (let i = 0; i < 5; i++) {
        const candidate = randomId();
        if (!(await env.LINKS.get(candidate))) {
          id = candidate;
          break;
        }
      }
      if (!id) return jsonError("IDの発行に失敗しました。もう一度お試しください", 503);

      await env.LINKS.put(id, target);
      return Response.json({ short: `${url.origin}/${id}` });
    }

    // それ以外は /abc123 → 元のURLへリダイレクト
    if (req.method !== "GET" && req.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    const key = url.pathname.slice(1);
    const target = key ? await env.LINKS.get(key) : null;
    return target
      ? Response.redirect(target, 302)
      : new Response("Not found", { status: 404 });
  },
};
