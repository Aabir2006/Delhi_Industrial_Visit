/**
 * TrainFresh – QR-Gated Local Server
 * ====================================
 * - Generates a one-time secret token on startup
 * - Prints QR code in terminal + serves /qr admin page
 * - Only clients that land via the QR link (/access/<token>) get a
 *   session cookie and are forwarded to the main app
 * - Everyone else sees an "Access via QR" page
 */

const express = require('express');
const path = require('path');
const QRCode = require('qrcode');
const os = require('os');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = 3000;

// ── Generate a random session token on each server start ───────────────────
const SECRET_TOKEN = 'trainfresh2026'; // fixed token for prototype

// ── Get local network IP ────────────────────────────────────────────────────
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

const LOCAL_IP = getLocalIP();
const BASE_URL = `http://${LOCAL_IP}:${PORT}`;
const ACCESS_URL = `${BASE_URL}/access/${SECRET_TOKEN}`;

// ── Cookie parser (lightweight, no npm dep needed) ──────────────────────────
function parseCookies(req) {
    const list = {};
    const header = req.headers.cookie;
    if (!header) return list;
    header.split(';').forEach(cookie => {
        let [name, ...rest] = cookie.trim().split('=');
        list[name.trim()] = rest.join('=').trim();
    });
    return list;
}

// ── Auth middleware: checks for valid session cookie ────────────────────────
function requireAuth(req, res, next) {
    const cookies = parseCookies(req);
    if (cookies['tf_session'] === SECRET_TOKEN) {
        return next();  // ✅ authorised
    }
    // Not authorised → show the scan-QR page
    res.status(403).send(accessDeniedHTML());
}

// ── Access-denied HTML ───────────────────────────────────────────────────────
function accessDeniedHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>TrainFresh – Scan QR</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#07091a;color:#e8edf7;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    body::before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 55% at 15% 5%,rgba(59,130,246,0.14),transparent 60%),radial-gradient(ellipse 50% 45% at 85% 90%,rgba(6,182,212,0.10),transparent 60%)}
    .card{position:relative;z-index:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:40px 32px;max-width:400px;width:100%;text-align:center;backdrop-filter:blur(18px);box-shadow:0 8px 40px rgba(0,0,0,0.5)}
    .logo{font-size:3rem;margin-bottom:10px}
    h1{font-family:'Space Grotesk',sans-serif;font-size:1.8rem;font-weight:700;background:linear-gradient(135deg,#fff 20%,#60a5fa 70%,#06b6d4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:8px}
    p{color:#7a86a0;font-size:0.9rem;line-height:1.6;margin-bottom:28px}
    .badge{display:inline-flex;align-items:center;gap:8px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);color:#fca5a5;border-radius:50px;padding:8px 18px;font-size:0.82rem;font-weight:600;margin-bottom:24px}
    .scan-icon{font-size:2rem;margin-bottom:12px}
    .hint{font-size:0.78rem;color:#475569;margin-top:20px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🚆</div>
    <h1>TrainFresh</h1>
    <div class="badge">🔒 Access Restricted</div>
    <div class="scan-icon">📷</div>
    <p>This platform is only accessible to passengers on board.<br/>Please <strong>scan the QR code</strong> displayed in your coach to get access.</p>
    <p class="hint">QR codes are placed near each toilet compartment and at coach entrances.</p>
  </div>
</body>
</html>`;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// 1. QR validation route – sets auth cookie and redirects to app
app.get('/access/:token', (req, res) => {
    if (req.params.token === SECRET_TOKEN) {
        // Set session cookie (1 hour)
        res.setHeader('Set-Cookie', `tf_session=${SECRET_TOKEN}; HttpOnly; Max-Age=3600; Path=/`);
        res.redirect('/');
    } else {
        res.status(403).send('<h3>Invalid or expired QR code.</h3>');
    }
});

// 2. Admin/station QR display page (no auth required – for staff screens)
app.get('/qr', async (req, res) => {
    try {
        const qrDataURL = await QRCode.toDataURL(ACCESS_URL, {
            width: 300,
            margin: 2,
            color: { dark: '#ffffff', light: '#07091a' }
        });
        res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>TrainFresh – Staff QR Display</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#07091a;color:#e8edf7;font-family:'Inter',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}
    body::before{content:'';position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse 70% 55% at 15% 5%,rgba(59,130,246,0.14),transparent 60%)}
    .card{position:relative;z-index:1;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:40px 36px;max-width:440px;width:100%;text-align:center;backdrop-filter:blur(18px);box-shadow:0 8px 40px rgba(0,0,0,0.5)}
    .logo{font-size:2.8rem;margin-bottom:8px}
    h1{font-family:'Space Grotesk',sans-serif;font-size:2rem;font-weight:700;background:linear-gradient(135deg,#fff 20%,#60a5fa 70%,#06b6d4 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:6px}
    .tagline{color:#7a86a0;font-size:0.88rem;margin-bottom:28px}
    .qr-wrap{background:#07091a;border-radius:16px;padding:12px;display:inline-block;border:2px solid rgba(59,130,246,0.3);margin-bottom:24px}
    .qr-wrap img{display:block;border-radius:8px}
    .instruction{font-size:0.9rem;color:#e8edf7;font-weight:600;margin-bottom:8px}
    .sub{font-size:0.78rem;color:#7a86a0;line-height:1.6;margin-bottom:20px}
    .url-box{background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 16px;font-size:0.72rem;color:#60a5fa;word-break:break-all;font-family:monospace;margin-bottom:8px}
    .badge-live{display:inline-flex;align-items:center;gap:6px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);color:#4ade80;border-radius:50px;padding:5px 14px;font-size:0.76rem;font-weight:600}
    .dot{width:7px;height:7px;border-radius:50%;background:#22c55e;animation:p 2s infinite}
    @keyframes p{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.6)}50%{box-shadow:0 0 0 5px rgba(34,197,94,0)}}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">🚆</div>
    <h1>TrainFresh</h1>
    <p class="tagline">Scan to check toilet availability</p>
    <div class="qr-wrap"><img src="${qrDataURL}" width="280" height="280" alt="QR Code"/></div>
    <p class="instruction">📱 Scan with your phone camera</p>
    <p class="sub">Open your camera app and point it at the QR code above.<br/>No app download needed.</p>
    <div class="url-box">${ACCESS_URL}</div>
    <br/>
    <span class="badge-live"><span class="dot"></span> Server Live on ${LOCAL_IP}:${PORT}</span>
  </div>
</body>
</html>`);
    } catch (err) {
        res.status(500).send('Error generating QR: ' + err.message);
    }
});

// 3. Protected static files (index.html, style.css, app.js)
app.use(requireAuth, express.static(path.join(__dirname)));

// ── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
    console.log('\n\x1b[36m╔══════════════════════════════════════════╗');
    console.log('║       🚆  TrainFresh Server Ready        ║');
    console.log('╚══════════════════════════════════════════╝\x1b[0m\n');
    console.log(`\x1b[32m✔ Server running at:\x1b[0m  ${BASE_URL}`);
    console.log(`\x1b[32m✔ QR Admin page at:\x1b[0m   ${BASE_URL}/qr`);
    console.log(`\x1b[32m✔ Passenger access:\x1b[0m   ${ACCESS_URL}\n`);

    // Print QR in terminal too
    try {
        const qrText = await QRCode.toString(ACCESS_URL, { type: 'terminal', small: true });
        console.log('\x1b[33mScan this QR with your phone:\x1b[0m');
        console.log(qrText);
    } catch (e) {
        // terminal QR optional
    }

    // Save permanent QR as PNG for printing
    try {
        const qrPNGPath = path.join(__dirname, 'qr.png');
        await QRCode.toFile(qrPNGPath, ACCESS_URL, {
            width: 600, margin: 3,
            color: { dark: '#000000', light: '#ffffff' }
        });
        console.log(`\x1b[32m✔ QR saved as:\x1b[0m        ${qrPNGPath}`);
        console.log('\x1b[2m  Print qr.png and paste it near the toilet for passengers to scan.\x1b[0m\n');
    } catch (e) {
        console.log('Could not save qr.png:', e.message);
    }

    console.log('\x1b[2m(Open /qr on a tablet/screen inside the coach for live display)\x1b[0m\n');
});
