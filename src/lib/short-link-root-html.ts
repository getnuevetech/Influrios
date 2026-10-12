const PORTRAIT = "/brand/short-link-landing-portrait.jpg";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Approved inflr.me root. The destination card is the landing illustration, not a directory row. */
export function shortLinkRootHtml(options: { origin: string; ctaLabel: string }) {
  const origin = options.origin;
  const host = directoryHost(origin);
  const cta = options.ctaLabel.trim() || "Browse influencers on Influrios";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Influrios short links</title>
  <style>
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-400-normal.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-600-normal.woff2") format("woff2"); font-weight: 600; font-style: normal; font-display: swap; }
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    @font-face { font-family: Sora; src: url("/fonts/sora-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      color: #fff;
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(980px 560px at 8% 0%, rgba(92, 78, 230, 0.42), transparent 62%),
        radial-gradient(720px 520px at 96% 12%, rgba(64, 92, 255, 0.28), transparent 58%),
        radial-gradient(860px 640px at 82% 100%, rgba(62, 36, 190, 0.5), transparent 62%),
        linear-gradient(180deg, #16124f 0%, #0c1138 48%, #080b24 100%);
    }
    .sky { position: relative; min-height: 100vh; overflow: hidden; padding: 42px 24px 36px; }
    .ring { position: absolute; border-radius: 50%; border: 1px solid rgba(168, 184, 255, 0.16); pointer-events: none; }
    .ring-a { width: 520px; height: 520px; left: -180px; top: -160px; }
    .ring-b { width: 340px; height: 340px; left: -40px; top: 40px; }
    .ring-c { width: 460px; height: 460px; right: -120px; bottom: -180px; }
    .ring-d { width: 280px; height: 280px; right: 40px; bottom: -40px; }
    .brand { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 28px; }
    .brand p { margin: 0; letter-spacing: 0.42em; font-size: 13px; font-weight: 600; color: #eceaff; }
    .stage { position: relative; z-index: 1; max-width: 980px; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
    .panel {
      position: relative;
      width: min(640px, 100%);
      padding: 46px 56px 34px;
      text-align: center;
      border-radius: 28px;
      background: linear-gradient(180deg, rgba(32, 28, 92, 0.72), rgba(14, 16, 58, 0.84));
      border: 1px solid rgba(186, 196, 255, 0.24);
      box-shadow: 0 30px 80px rgba(3, 6, 28, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.16);
      backdrop-filter: blur(18px);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 14px; border-radius: 999px;
      border: 1px solid rgba(190, 198, 255, 0.28);
      background: rgba(10, 12, 40, 0.35);
      color: #d5dcf8; font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
    }
    h1 { margin: 22px 0 12px; font-family: Sora, "Plus Jakarta Sans", sans-serif; font-size: clamp(2.1rem, 4vw, 3.15rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.05; color: #fff; }
    h1 .soft { color: #a9b8f2; }
    .lead { margin: 0 auto 26px; max-width: 34rem; color: #d7e0fb; font-size: 1.05rem; line-height: 1.45; }
    .cta {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-width: min(100%, 360px); padding: 16px 28px; border-radius: 999px;
      background: linear-gradient(90deg, #7a3dff 0%, #3d7bff 100%);
      color: #fff; text-decoration: none; font-weight: 700; font-size: 1rem;
      box-shadow: 0 12px 28px rgba(70, 84, 255, 0.35);
    }
    .cta:hover { filter: brightness(1.06); }
    .go { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; color: #c5d0f2; font-size: 0.92rem; text-decoration: none; }
    .go:hover { color: #fff; }
    .pointer { position: absolute; width: 92px; height: 54px; right: 22px; top: 34px; z-index: 2; }
    .card {
      position: relative; z-index: 3; width: 248px; margin-left: -16px; margin-top: 48px; flex: none;
      padding: 22px 16px 14px; text-align: center; border-radius: 26px;
      background: linear-gradient(180deg, rgba(40, 34, 104, 0.92), rgba(16, 18, 62, 0.94));
      border: 1px solid rgba(190, 198, 255, 0.3);
      box-shadow: 0 24px 50px rgba(2, 4, 24, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.14);
    }
    .card-menu { position: absolute; top: 14px; right: 14px; display: flex; gap: 3px; }
    .card-menu i { width: 3px; height: 3px; border-radius: 50%; background: #c9d2f5; display: block; }
    .avatar-wrap { position: relative; width: 104px; height: 104px; margin: 8px auto 12px; }
    .avatar {
      width: 104px; height: 104px; border-radius: 50%; padding: 3px;
      background: conic-gradient(from 210deg, #ff4fd8, #8a5cff, #3d7bff, #ff4fd8);
      box-shadow: 0 0 24px rgba(255, 79, 216, 0.35);
    }
    .avatar img { width: 100%; height: 100%; border-radius: 50%; object-fit: cover; display: block; background: #1a1748; }
    .check { position: absolute; right: 2px; bottom: 6px; width: 22px; height: 22px; }
    .card h2 { margin: 0; font-size: 1.15rem; font-weight: 700; }
    .niches { margin: 4px 0 14px; color: #c5d0f4; font-size: 0.78rem; }
    .socials { display: flex; justify-content: center; gap: 8px; }
    .socials span { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; }
    .ig { background: linear-gradient(135deg, #f7ce68, #e1306c 55%, #6a3de8); }
    .tt { background: #111; }
    .yt { background: #ff0033; }
    .x { background: #111; }
    .dest {
      margin-top: 14px; padding: 8px 10px; border-radius: 12px;
      display: flex; align-items: center; gap: 8px;
      background: rgba(255, 255, 255, 0.04); border: 1px solid rgba(255, 255, 255, 0.08);
      color: #d5def8; font-size: 11px;
    }
    .dest b { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .qr { margin-left: auto; flex: none; }
    .spark { position: absolute; width: 16px; height: 16px; }
    .spark-a { right: -18px; top: 28px; }
    .spark-b { left: -14px; bottom: 36px; width: 10px; height: 10px; }
    .foot { position: relative; z-index: 1; margin-top: 28px; text-align: center; }
    .root-mark { display: flex; align-items: center; justify-content: center; gap: 12px; color: #9aaddd; }
    .root-mark span { width: 92px; height: 1px; background: rgba(170, 186, 230, 0.35); }
    .root-mark em {
      font-style: normal; letter-spacing: 0.16em; font-size: 12px; text-transform: lowercase;
      padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(170, 186, 230, 0.35);
    }
    .foot p { margin: 14px 0 0; color: #9aadd8; font-size: 0.82rem; }
    @media (max-width: 860px) {
      .stage { flex-direction: column; }
      .panel { padding: 36px 22px 28px; }
      .pointer { display: none; }
      .card { margin: 18px 0 0; }
    }
  </style>
</head>
<body>
  <div class="sky">
    <div class="ring ring-a"></div>
    <div class="ring ring-b"></div>
    <div class="ring ring-c"></div>
    <div class="ring ring-d"></div>
    <header class="brand">
      ${sparkle(22)}
      <p>INFLURIOS</p>
    </header>
    <div class="stage">
      <section class="panel">
        <div class="badge">${linkIcon()} INFLURIOS SHORT LINK</div>
        <h1>Influrios <span class="soft">short links</span></h1>
        <p class="lead">Short links redirect to public Influrios destinations. Browse influencer profiles and collaborations on Influrios.</p>
        <a class="cta" href="${escapeHtml(origin)}">${escapeHtml(cta)} <span aria-hidden="true">→</span></a>
        <div><a class="go" href="${escapeHtml(origin)}">Go to ${escapeHtml(host)} ${externalIcon()}</a></div>
        <svg class="pointer" viewBox="0 0 84 48" aria-hidden="true">
          <path d="M6 34c18-2 34-20 58-24" fill="none" stroke="#aebfff" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M54 6l16 2-8 12" fill="none" stroke="#aebfff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </section>
      <aside class="card">
        <div class="card-menu" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="avatar-wrap">
          <div class="avatar"><img src="${PORTRAIT}" alt="Sofia Carter" width="104" height="104" /></div>
          <span class="check">${checkIcon()}</span>
        </div>
        <h2>Sofia Carter</h2>
        <p class="niches">Lifestyle · Travel · Wellness</p>
        <div class="socials" aria-hidden="true">
          <span class="ig">${instagramIcon()}</span>
          <span class="tt">${tiktokIcon()}</span>
          <span class="yt">${youtubeIcon()}</span>
          <span class="x">${xIcon()}</span>
        </div>
        <div class="dest">
          ${linkIcon()}
          <b>${escapeHtml(host)}/sofia</b>
          ${qrIcon()}
        </div>
        <svg class="spark spark-a" viewBox="0 0 24 24" aria-hidden="true">${starPath()}</svg>
        <svg class="spark spark-b" viewBox="0 0 24 24" aria-hidden="true">${starPath()}</svg>
      </aside>
    </div>
    <footer class="foot">
      <div class="root-mark" data-resolve-outcome="root"><span></span><em>root</em><span></span></div>
      <p>Influencer profiles and collaborations live on Influrios — short links only redirect.</p>
    </footer>
  </div>
</body>
</html>`;
}

/** Missing, suspended, and unavailable short links. Same chrome as the root, without the destination card. */
export function shortLinkStatusHtml(options: {
  title: string;
  message: string;
  origin: string;
  ctaLabel: string;
  outcome?: string;
}) {
  const origin = options.origin;
  const host = directoryHost(origin);
  const cta = options.ctaLabel.trim() || "Open Influrios";
  const outcome = (options.outcome ?? "").trim();
  const pill = outcome
    ? `<div class="root-mark"><span></span><em data-resolve-outcome="${escapeHtml(outcome)}">${escapeHtml(outcome.replaceAll("_", " "))}</em><span></span></div>`
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(options.title)} · Influrios</title>
  <style>
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-400-normal.woff2") format("woff2"); font-weight: 400; font-style: normal; font-display: swap; }
    @font-face { font-family: "Plus Jakarta Sans"; src: url("/fonts/plus-jakarta-sans-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    @font-face { font-family: Sora; src: url("/fonts/sora-latin-700-normal.woff2") format("woff2"); font-weight: 700; font-style: normal; font-display: swap; }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; }
    body {
      color: #fff;
      font-family: "Plus Jakarta Sans", "Segoe UI", sans-serif;
      background:
        radial-gradient(980px 560px at 8% 0%, rgba(92, 78, 230, 0.42), transparent 62%),
        radial-gradient(720px 520px at 96% 12%, rgba(64, 92, 255, 0.28), transparent 58%),
        radial-gradient(860px 640px at 82% 100%, rgba(62, 36, 190, 0.5), transparent 62%),
        linear-gradient(180deg, #16124f 0%, #0c1138 48%, #080b24 100%);
    }
    .sky { position: relative; min-height: 100vh; overflow: hidden; padding: 42px 24px 36px; display: flex; flex-direction: column; }
    .ring { position: absolute; border-radius: 50%; border: 1px solid rgba(168, 184, 255, 0.16); pointer-events: none; }
    .ring-a { width: 520px; height: 520px; left: -180px; top: -160px; }
    .ring-b { width: 340px; height: 340px; left: -40px; top: 40px; }
    .ring-c { width: 460px; height: 460px; right: -120px; bottom: -180px; }
    .brand { position: relative; z-index: 1; display: flex; flex-direction: column; align-items: center; gap: 10px; margin-bottom: 28px; }
    .brand p { margin: 0; letter-spacing: 0.42em; font-size: 13px; font-weight: 600; color: #eceaff; }
    .stage { position: relative; z-index: 1; width: min(560px, 100%); margin: 0 auto; }
    .panel {
      padding: 42px 36px 32px; text-align: center; border-radius: 28px;
      background: linear-gradient(180deg, rgba(32, 28, 92, 0.72), rgba(14, 16, 58, 0.84));
      border: 1px solid rgba(186, 196, 255, 0.24);
      box-shadow: 0 30px 80px rgba(3, 6, 28, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.16);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 14px; border-radius: 999px;
      border: 1px solid rgba(190, 198, 255, 0.28);
      background: rgba(10, 12, 40, 0.35);
      color: #d5dcf8; font-size: 11px; font-weight: 600; letter-spacing: 0.14em;
    }
    h1 { margin: 22px 0 12px; font-family: Sora, "Plus Jakarta Sans", sans-serif; font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 700; letter-spacing: -0.03em; line-height: 1.1; color: #fff; }
    .lead { margin: 0 auto 26px; max-width: 28rem; color: #d7e0fb; font-size: 1.05rem; line-height: 1.45; }
    .cta {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      min-width: min(100%, 280px); padding: 16px 28px; border-radius: 999px;
      background: linear-gradient(90deg, #7a3dff 0%, #3d7bff 100%);
      color: #fff; text-decoration: none; font-weight: 700; font-size: 1rem;
      box-shadow: 0 12px 28px rgba(70, 84, 255, 0.35);
    }
    .go { display: inline-flex; align-items: center; gap: 6px; margin-top: 18px; color: #c5d0f2; font-size: 0.92rem; text-decoration: none; }
    .foot { position: relative; z-index: 1; margin-top: auto; padding-top: 28px; text-align: center; }
    .root-mark { display: flex; align-items: center; justify-content: center; gap: 12px; color: #9aaddd; }
    .root-mark span { width: 92px; height: 1px; background: rgba(170, 186, 230, 0.35); }
    .root-mark em {
      font-style: normal; letter-spacing: 0.16em; font-size: 12px; text-transform: lowercase;
      padding: 4px 12px; border-radius: 999px; border: 1px solid rgba(170, 186, 230, 0.35);
    }
    .foot p { margin: 14px 0 0; color: #9aadd8; font-size: 0.82rem; }
  </style>
</head>
<body>
  <div class="sky">
    <div class="ring ring-a"></div>
    <div class="ring ring-b"></div>
    <div class="ring ring-c"></div>
    <header class="brand">
      ${sparkle(22)}
      <p>INFLURIOS</p>
    </header>
    <div class="stage">
      <section class="panel">
        <div class="badge">${linkIcon()} INFLURIOS SHORT LINK</div>
        <h1>${escapeHtml(options.title)}</h1>
        <p class="lead">${escapeHtml(options.message)}</p>
        <a class="cta" href="${escapeHtml(origin)}">${escapeHtml(cta)} <span aria-hidden="true">→</span></a>
        <div><a class="go" href="${escapeHtml(origin)}">Go to ${escapeHtml(host)} ${externalIcon()}</a></div>
      </section>
    </div>
    <footer class="foot">
      ${pill}
      <p>Influencer profiles and collaborations live on Influrios — short links only redirect.</p>
    </footer>
  </div>
</body>
</html>`;
}

function directoryHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return "influrios.com";
  }
}

function sparkle(size: number) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><path fill="#e7e9ff" d="M12 1.2l1.5 7.3L21 12l-7.5 3.5L12 22.8l-1.5-7.3L3 12l7.5-3.5z"/></svg>`;
}

function starPath() {
  return `<path fill="#dfe6ff" d="M12 0l1.8 8.2L22 12l-8.2 1.8L12 22l-1.8-8.2L2 12l8.2-1.8z"/>`;
}

function linkIcon() {
  return `<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M10 13a5 5 0 0 0 7.1.1l2.1-2.1a5 5 0 0 0-7.1-7.1l-1.2 1.2"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 11a5 5 0 0 0-7.1-.1L4.8 13a5 5 0 0 0 7.1 7.1l1.2-1.2"/></svg>`;
}

function externalIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M14 5h5v5"/><path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" d="M19 5l-9 9"/><path fill="none" stroke="currentColor" stroke-width="1.8" d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/></svg>`;
}

function checkIcon() {
  return `<svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><circle cx="11" cy="11" r="11" fill="#3d7bff"/><path d="M6.2 11.2l3 3 6.4-6.6" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

function instagramIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="5" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="0.9" fill="#fff"/></svg>`;
}

function tiktokIcon() {
  return `<svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M14 4c.6 2.6 2.2 4.2 4.6 4.6v2.4c-1.6 0-3-.5-4.2-1.4v6.2c0 3.2-2.4 5.6-5.6 5.6S3.2 19 3.2 15.8 5.6 10.2 8.8 10.2c.3 0 .7 0 1 .1v2.6c-.3-.1-.6-.2-1-.2-1.8 0-3.2 1.4-3.2 3.1s1.4 3.1 3.2 3.1 3.1-1.4 3.1-3.2V4h2.1z"/></svg>`;
}

function youtubeIcon() {
  return `<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M21.6 8.2a2.5 2.5 0 0 0-1.8-1.8C18.2 6 12 6 12 6s-6.2 0-7.8.4a2.5 2.5 0 0 0-1.8 1.8C2 9.8 2 12 2 12s0 2.2.4 3.8a2.5 2.5 0 0 0 1.8 1.8C5.8 18 12 18 12 18s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-3.8.4-3.8s0-2.2-.4-3.8zM10 15.1V8.9l5.2 3.1L10 15.1z"/></svg>`;
}

function xIcon() {
  return `<svg width="13" height="13" viewBox="0 0 24 24" aria-hidden="true"><path fill="#fff" d="M17.6 3H20.4l-6.7 7.7L21.5 21h-5.9l-4.6-6L6 21H3.2l7.2-8.2L2.7 3h6l4.2 5.5L17.6 3zm-1 16.2h1.6L7.5 4.7H5.8l10.8 14.5z"/></svg>`;
}

function qrIcon() {
  return `<svg class="qr" width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
    <rect width="28" height="28" rx="4" fill="#fff"/>
    <path fill="#12142a" d="M3 3h8v8H3zm2 2v4h4V5zM17 3h8v8h-8zm2 2v4h4V5zM3 17h8v8H3zm2 2v4h4v-4zM16 16h2v2h-2zm4 0h5v2h-3v2h-2zm-4 4h2v2h2v2h-4zm4 2h2v4h-2zm2-2h3v2h-3z"/>
  </svg>`;
}
