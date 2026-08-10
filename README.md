# WA Energy — Solar and Inverter Solution

A real, deployable website for WA Energy with:

- A **Node.js + Express** backend
- A **real SQLite database** using Node's own built-in SQLite support (no separate database server, and no C++ compiler needed to install it) storing users, products, plans, cart items and orders
- **Real user accounts** — passwords are hashed with bcrypt, sessions use signed JWT cookies
- A **real shopping cart** and **order records**, stored per user, that survive page reloads and logins from any device
- The full 69-product catalog (110 photos) served from the database
- A **Watt chat assistant** that works out of the box with zero cost, using a built-in scripted knowledge base — with an optional upgrade to live AI answers if you ever add an Anthropic API key

---

## 1. Requirements

- [Node.js](https://nodejs.org/) version **22.5 or newer** (this is important — the database now uses Node's own built-in SQLite support, added in that version, specifically so you never have to install a C++ compiler or Visual Studio Build Tools just to run this site). Node.js includes `npm` automatically.
- That's it. No separate database server, no native modules to compile.

Check your Node version:

```
node --version
```

If it's below v22.5.0, download the latest version from nodejs.org and reinstall.

## 2. First-time setup

Open a terminal in this folder and run:

```
npm install
```

This downloads Express, the database driver, and the other small libraries the server needs (see `package.json`). It only needs to be done once (and again any time you `git pull` new dependency changes).

A working `.env` file is already included so the site runs immediately with a real random session secret. Before you go live on your real domain, open `.env` and:

1. **Generate a fresh `JWT_SECRET`** (don't reuse the one that shipped with this code):
   ```
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   Paste the output as `JWT_SECRET=...` in `.env`.

2. **(Optional) Add your Anthropic API key** if you ever want Watt to give live AI-generated answers instead of its built-in scripted ones:
   - Go to https://console.anthropic.com/ → Account Settings → API Keys → Create Key.
   - Paste it as `ANTHROPIC_API_KEY=sk-ant-...` in `.env`.
   - This key stays on your server only — it is never sent to the browser.
   - Leave this blank and Watt still works great — see section 4 below for how the built-in version answers questions.

3. Set `NODE_ENV=production` once you're running on your real domain over HTTPS (this makes login cookies `secure`, i.e. HTTPS-only).

See `.env.example` for a documented template of every variable.

## 3. Run it

```
npm start
```

You'll see:

```
WA Energy server running at http://localhost:3000
```

Open that URL in your browser. The whole site — home page, products, signup, login, dashboard, cart, plans — is live and backed by the real database.

For development, `npm run dev` uses `nodemon` to auto-restart the server whenever you edit a file.

## 4. What's actually real here

| Feature | How it works |
|---|---|
| Product catalog (69 products, 110 photos) | Seeded into the SQLite database from `server/db/products_seed.json` at every server boot, served via `/api/products` |
| Signup / Login | Real accounts in the `users` table. Passwords are hashed with bcrypt (never stored in plain text). Sessions use an httpOnly JWT cookie, so a customer stays logged in across visits |
| WZN token balance | A real `wzn_balance` column per user, starts at 2,500 on signup |
| Cart | Real `cart_items` table, tied to the logged-in user's account — persists across devices and reloads |
| Orders / "Request a Quote" / "Buy Now" | Real `orders` table. Every quote request or WZN checkout attempt is recorded, then the customer is handed to WhatsApp to complete the conversation with your sales team |
| Order tracking | Reads the customer's real order history and status from the database |
| Weather-based solar recommendation | Calls the free [Open-Meteo](https://open-meteo.com/) API directly from the browser using the visitor's location — no key needed, genuinely live weather data |
| Watt chat assistant | Works entirely on its own, for free — a built-in, rule-based knowledge base (in `server/routes/chat.js`) answers questions about your company, products, plans, WZN and contact info, and gracefully falls back to your phone number for anything it doesn't know. If you ever add `ANTHROPIC_API_KEY`, it automatically upgrades to live Claude-powered answers instead, with the scripted version as a safety net if that API call ever fails |
| Referral program | Every user gets a unique referral code and shareable link from their dashboard ("Get Link"). When someone signs up through that link, the referrer is credited 500 WZN automatically, in the same database transaction as the new signup — logged permanently in the `referral_rewards` table |
| Admin panel | A real, password-protected panel at `/admin` — see section 6 below |

### About WZN token pricing

The site doesn't have real product prices or a payment gateway (like Paystack or Flutterwave) yet, so there's no real amount to charge a customer's WZN balance against. `server/routes/orders.js` currently uses a placeholder threshold (`REQUIRED_WZN`) that's intentionally set above the signup bonus, so "Use my WZN Token" correctly and honestly reports "not enough tokens" and falls back to WhatsApp — exactly like the original design called for. When you're ready to add real prices and a payment gateway, that's the one file to revisit; the rest of the checkout flow already works around it correctly.

## 5. Admin panel

Visit **`/admin`** on your site (e.g. `http://localhost:3000/admin` locally, or `https://yourdomain.com/admin` once deployed) to sign in with:

- **Username:** `waenergyadmin`
- **Password:** `energywithoutlimit`

**Change this password before you go live** — edit `ADMIN_PASSWORD` in your `.env` file (see `.env.example`). The password is hashed with bcrypt in memory every time the server starts, so you never need to generate a hash by hand — just change the plain-text value in `.env` and restart the server.

From the admin panel you can:

- See every registered user: name, email, phone, property type, WZN balance, referral code, who referred them, how many people they've referred, and what's currently in their cart
- Click any user's row to expand full detail: their appliance profile, cart contents, order history, every referral reward they've earned, and a complete history of WZN tokens you've manually sent them
- **Send (or deduct) WZN tokens** to any individual user, with an optional note — every grant is permanently logged in the `admin_wzn_grants` table, so you always have a paper trail of who received tokens, how much, and why

The admin login uses its own separate, short-lived (12 hour) session cookie — completely independent from customer logins, so being logged in as admin never logs a real customer out, and vice versa.

## 6. Teaching Watt new answers

Watt's scripted answers live in one file: `server/routes/chat.js`, inside the `scriptedReply()` function. It's a simple list of "if the message contains any of these words, reply with this" rules, checked in order from top to bottom (the first match wins). To add a new topic:

```js
if (matchAny(text, ['keyword one', 'keyword two', 'another phrase'])) {
  return "Whatever you want Watt to say here.";
}
```

Add your new block anywhere before the final fallback reply at the bottom of the function, then restart the server (or redeploy) — no other changes needed. A few tips:
- Put more specific rules (like a particular product) above broader ones (like a general "about us" rule), so specific questions don't get swallowed by a catchy-all phrase.
- Keep trigger words lowercase — the code already lowercases the visitor's message before checking.
- If you ever add `ANTHROPIC_API_KEY`, this scripted version automatically becomes the safety net used only if the live AI call fails, so it's never wasted effort.

## 7. Editing your content later

Everything customers see — products, solar plans, services, testimonials, FAQs, your phone/address — lives in the JSON files inside `server/db/`:

- `products_seed.json`
- `plans_seed.json`
- `categories_seed.json`
- `services_seed.json`
- `testimonials_seed.json`
- `faqs_seed.json`
- `config_seed.json` (phone number, address, WhatsApp number, footer content)

Edit any of these files, then either restart the server (it re-seeds automatically on every boot) or run:

```
npm run seed
```

This **never** deletes real customer accounts, carts, or orders — only the catalog/content tables are refreshed.

To add or remove product photos, drop images into `public/assets/products/` and update the matching entry's `images` array in `products_seed.json`.

## 8. Deploying to your real domain

This is a normal Node.js app, so it runs on almost any hosting provider. A few solid options:

- **Render / Railway / Fly.io** — connect your GitHub repo, set the environment variables from `.env` in their dashboard, and they build + run `npm start` for you. Easiest option if you don't want to manage a server yourself.
- **A VPS (DigitalOcean, Linode, Hetzner, etc.)** — install Node.js, copy this project over, run `npm install && npm start` (use a process manager like [PM2](https://pm2.keymetrics.io/) — `npm install -g pm2 && pm2 start server/server.js --name waenergy` — so it stays running and restarts on crashes/reboots).
- **Shared cPanel hosting with Node.js support** — many Nigerian hosts offer a "Setup Node.js App" tool; point it at `server/server.js`.

Whichever you choose:

1. Point your domain's DNS at the host.
2. Set up HTTPS (most of the platforms above do this for you automatically via Let's Encrypt).
3. Set `NODE_ENV=production` and a real `JWT_SECRET` in that platform's environment variable settings (don't upload your `.env` file directly to a public git repo). `ANTHROPIC_API_KEY` is optional — only add it if you want Watt's live-AI upgrade.
4. The SQLite database file (`server/db/waenergy.sqlite`) lives on disk — make sure your host's disk storage persists between deploys (most VPS and container platforms do by default; some serverless platforms wipe the filesystem on every deploy, which would lose your database — Render, Railway and a plain VPS are all safe here).

## 9. Project structure

```
waenergy-app/
├── package.json
├── .env                    # your local config (don't commit the real one)
├── .env.example            # documented template
├── public/                 # everything the customer's browser loads
│   ├── index.html
│   ├── styles.css
│   ├── app.js               # talks to the API below
│   ├── admin.html            # admin panel page (served at /admin)
│   ├── admin.css
│   ├── admin.js              # talks to /api/admin/*
│   └── assets/               # logos, icons, product photos, illustrations
└── server/
    ├── server.js            # app entrypoint
    ├── db/
    │   ├── init.js           # creates the SQLite schema (uses sqlite-adapter.js)
    │   ├── sqlite-adapter.js # wraps Node's built-in SQLite — no native compiling needed
    │   ├── seed.js           # loads the JSON files below into the database
    │   └── *_seed.json       # your editable content
    ├── middleware/
    │   ├── auth.js           # customer session cookie + JWT helpers
    │   └── adminAuth.js      # separate admin session cookie + JWT helpers
    └── routes/
        ├── auth.js           # signup (+ referral crediting), login, logout, me
        ├── catalog.js        # products, plans, categories, services, testimonials, faqs, config
        ├── cart.js           # per-user cart
        ├── orders.js         # quote requests + WZN checkout attempts
        ├── chat.js           # Watt's scripted knowledge base (+ optional live-AI upgrade)
        └── admin.js          # admin login + user management + WZN grants
```

## 10. A note on testing

This project was written in a sandboxed environment without internet access, so I couldn't run `npm install` and click through the live site myself before handing it to you — you found the one real bug that surfaced from that (a native module, `better-sqlite3`, that needed a C++ compiler on Windows). It's since been replaced with Node's own built-in SQLite support, which needs no compiling on any platform, and I validated every actual database query the app uses (products, signup, duplicate-email rejection, cart, orders, and transaction rollback) directly against a real SQLite database before repackaging this. Everything else follows standard, well-established patterns — but please do run through signup, login, adding to cart, requesting a quote, and the dashboard yourself after `npm install && npm start`, and let me know if anything else misbehaves.
