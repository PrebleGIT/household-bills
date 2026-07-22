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

## Setting up push notifications (optional)

This lets the app send a lock-screen notification when a bill becomes due,
and shows a red badge count on the home screen icon for bills that are due
and still unpaid. This only works for the app once it's been added to the
Home Screen (not in a regular Safari tab), on iOS 16.4 or later.

**1. Add three more environment variables** in Vercel (Settings → Environment Variables):

| Name | Value |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | `BJDJ3yCd-D-_gmI2AAWwSAsrUbb5pUlMH2HvvCX-XyhhbzrSdLfP-lBSyOy1Stg-U_aMjCKMliarC4r_1mpR5pw` |
| `VAPID_PRIVATE_KEY` | `jJFzrmeA-5fYC1sDu2Yc2161jbs3T-HuIK3KGJjY9gQ` |
| `VAPID_SUBJECT` | `mailto:youremail@example.com` (any email works, it's just required by the push spec) |

These two keys were generated specifically for this project and aren't used
anywhere else — you can use them as-is. (If you'd rather generate your own,
any web-push VAPID key pair works fine.)

**2. Add a cron secret** (recommended, stops randoms from hitting your cron endpoint):

| Name | Value |
|---|---|
| `CRON_SECRET` | Another long random string, different from `SESSION_SECRET` |

**3. Redeploy** so the new env vars take effect.

**4. On each phone**, open the app (from the home screen icon), and you'll see
a banner: "Get notified when a bill is due" → tap **Enable** → allow when iOS
prompts you. Do this once per phone.

**5. That's it.** Vercel's cron job checks once a day (around 9am Eastern) for
any bill due that day and sends a notification if there's a match — the app
only notifies about bills not yet marked paid. The home screen icon badge
updates separately, any time you open the app, to show how many unpaid bills
are already at or past their due date.

Note: on Vercel's free Hobby plan, the daily cron job can fire any time within
its scheduled hour, not at the exact minute — so don't expect it down to the
second.
