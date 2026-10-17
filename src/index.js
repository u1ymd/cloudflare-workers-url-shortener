const ID_CHARS = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ID_LENGTH = 6;

const PAGE = `<!doctype html>
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
  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("error").textContent = "";
    $("result").style.display = "none";
    $("submit").disabled = true;
    try {
      const res = await fetch("/shorten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target: $("target").value.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      $("short").textContent = $("short").href = data.short;
      $("result").style.display = "block";
      $("copy").textContent = "コピー";
    } catch (err) {
      $("error").textContent = err.message;
    } finally {
      $("submit").disabled = false;
    }
  });
  $("copy").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("short").textContent);
    $("copy").textContent = "コピーしました";
  });
</script>
</body>
</html>`;

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
      return new Response(PAGE, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // POST /shorten で短縮URLを発行
    if (url.pathname === "/shorten") {
      if (req.method !== "POST") return jsonError("POST only", 405);

      const body = await req.json().catch(() => null);
      const target = parseTarget(body?.target, url.origin);
      if (!target) return jsonError("http:// か https:// で始まる有効なURLを入力してください", 400);

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
