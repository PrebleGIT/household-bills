import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import webpush from "web-push";

const redis = Redis.fromEnv();

const isBillActiveThisMonth = (bill, currentMonth) => {
  const freq = bill.frequencyMonths || 1;
  if (freq <= 1) return true;
  const anchor = bill.anchorMonth || currentMonth;
  const diff = ((currentMonth - anchor) % freq + freq) % freq;
  return diff === 0;
};

export async function GET(request) {
  // Vercel Cron sends this header automatically when CRON_SECRET is set.
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY env vars." }, { status: 500 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:example@example.com",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  const bills = (await redis.get("bills")) || [];
  const now = new Date();
  const today = now.getDate();
  const currentMonth = now.getMonth() + 1;

  const activeUnpaid = bills.filter((b) => !b.paid && isBillActiveThisMonth(b, currentMonth));
  const dueToday = activeUnpaid.filter((b) => b.dueDay === today);
  const waitingCount = activeUnpaid.filter((b) => b.dueDay <= today).length;

  if (dueToday.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No bills due today." });
  }

  const names = dueToday.map((b) => `${b.name} ($${b.amount.toFixed(2)})`);
  const body = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} + ${names.length - 3} more`;

  const payload = JSON.stringify({
    title: dueToday.length === 1 ? "1 bill due today" : `${dueToday.length} bills due today`,
    body,
    url: "/",
    badgeCount: waitingCount,
  });

  const subscriptions = (await redis.get("push-subscriptions")) || [];
  let sent = 0;
  const stillValid = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent += 1;
      stillValid.push(sub);
    } catch (err) {
      // 404/410 means the subscription is dead (uninstalled, permission revoked) — drop it.
      if (err.statusCode !== 404 && err.statusCode !== 410) {
        stillValid.push(sub);
      }
    }
  }

  if (stillValid.length !== subscriptions.length) {
    await redis.set("push-subscriptions", stillValid);
  }

  return NextResponse.json({ ok: true, sent, billsDueToday: dueToday.length });
}
