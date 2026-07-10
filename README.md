# Bills — Household Tracker

A password-protected, shared bill tracker for two people. Built with Next.js,
deployed on Vercel, with an Upstash Redis database for the shared bill list.

## 1. Push to GitHub

```bash
cd household-bills
git init
git add .
git commit -m "Initial commit"
```

Create a new empty repo on GitHub (no README/license, since you already have one),
then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/household-bills.git
git branch -M main
git push -u origin main
```

## 2. Import into Vercel

1. Go to vercel.com → **Add New... → Project**.
2. Select your `household-bills` GitHub repo → Import.
3. Framework preset will auto-detect as **Next.js**. Leave everything default and click **Deploy** once (it'll fail or half-work until env vars are set below — that's expected).

## 3. Add the Upstash Redis database (this gives you the sync between phones)

1. In your Vercel project, go to the **Storage** tab.
2. Click **Create Database** → choose **Upstash** → **Redis**.
3. Follow the prompts to create it (free tier is plenty for this).
4. Vercel will automatically add two environment variables to your project:
   `KV_REST_API_URL` / `KV_REST_API_TOKEN` or
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (name depends on the integration version).

   **Important:** the code in `app/api/bills/route.js` uses `Redis.fromEnv()`, which
   expects the variables to be named exactly `UPSTASH_REDIS_REST_URL` and
   `UPSTASH_REDIS_REST_TOKEN`. If Vercel names them `KV_REST_API_URL` / `KV_REST_API_TOKEN`
   instead, go to Project Settings → Environment Variables and add two more entries
   with the `UPSTASH_...` names, pasting in the same values.

## 4. Add your passcode and session secret

In Project Settings → Environment Variables, add:

| Name | Value |
|---|---|
| `APP_PASSWORD` | Whatever passcode you and your wife want to type in (e.g. `4217`) |
| `SESSION_SECRET` | Any long random string — this is never shown to users. You can generate one at [randomkeygen.com](https://randomkeygen.com) or run `openssl rand -hex 32` in a terminal. |

Set these for **all environments** (Production, Preview, Development).

## 5. Redeploy

Go to the **Deployments** tab → click the **...** menu on the latest deployment →
**Redeploy**. This picks up the new environment variables.

## 6. Use it

- Open your Vercel URL (e.g. `household-bills.vercel.app`) on your phone.
- You'll land on a passcode screen — enter the `APP_PASSWORD` you set.
- Once unlocked, add it to your home screen (Safari → Share → Add to Home Screen)
  so it opens like a normal app.
- Do the same on your wife's phone with the same URL and passcode.
- Both phones now read/write the same bill list through the Upstash database.

## Changing the passcode later

Just update the `APP_PASSWORD` environment variable in Vercel and redeploy —
no code changes needed. Anyone already logged in stays logged in (30-day
session) until they log out or the cookie expires.
