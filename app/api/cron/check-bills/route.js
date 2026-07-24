import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import webpush from "web-push";

const redis = Redis.fromEnv();

// Vercel runs in UTC. Everything below is evaluated in your local zone.
const TZ = process.env.APP_TIMEZONE || "America/New_York";
// Bills don't carry their own time, so they all fire at this hour, local.
const BILL_HOUR = process.env.BILL_NOTIFY_TIME || "09:00";

const isBillActiveThisMonth = (bill, currentMonth) => {
  const freq = bill.frequencyMonths || 1;
  if (freq <= 1) return true;
  const anchor = bill.anchorMonth || currentMonth;
  const diff = ((currentMonth - anchor) % freq + freq) % freq;
  return diff === 0;
};

const localParts = () => {
  const now = new Date();
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now); // YYYY-MM-DD
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(now); // HH:MM
  return { date, time, day: Number(date.slice(8, 10)), month: Number(date.slice(5, 7)) };
};

export async function GET(request) {
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

  const { date: todayISO, time: nowTime, day: today, month: currentMonth } = localParts();

  const bills = (await redis.get("bills")) || [];
  const reminders = (await redis.get("reminders-list")) || [];

  // So the same item never notifies twice in one day, even if this runs
  // every 15 minutes. The log resets when the date rolls over.
  const rawLog = (await redis.get("notify-log")) || {};
  const log = rawLog.date === todayISO ? rawLog : { date: todayISO, ids: [] };
  const alreadySent = new Set(log.ids);

  const activeUnpaidBills = bills.filter((b) => !b.paid && isBillActiveThisMonth(b, currentMonth));

  const billsDue = activeUnpaidBills.filter(
    (b) => b.dueDay === today && nowTime >= BILL_HOUR && !alreadySent.has(`bill:${b.id}`)
  );

  const remindersDue = reminders.filter(
    (r) =>
      r.dueDate === todayISO &&
      (r.repeatUnit || !r.done) &&
      nowTime >= (r.dueTime || "09:00") &&
      !alreadySent.has(`rem:${r.id}`)
  );

  // Badge reflects everything still waiting, whether or not it notified yet.
  const waitingCount =
    activeUnpaidBills.filter((b) => b.dueDay <= today).length +
    reminders.filter((r) => (r.repeatUnit || !r.done) && r.dueDate <= todayISO).length;

  if (billsDue.length === 0 && remindersDue.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "Nothing to send right now.", nowTime });
  }

  const lines = [
    ...billsDue.map((b) => `${b.name} ($${b.amount.toFixed(2)})`),
    ...remindersDue.map((r) => r.name),
  ];

  const totalDue = billsDue.length + remindersDue.length;
  let title;
  if (billsDue.length > 0 && remindersDue.length > 0) {
    title = `${totalDue} things due today`;
  } else if (billsDue.length > 0) {
    title = billsDue.length === 1 ? "1 bill due today" : `${billsDue.length} bills due today`;
  } else {
    title = remindersDue.length === 1 ? remindersDue[0].name : `${remindersDue.length} reminders`;
  }

  const body = lines.length <= 3 ? lines.join(", ") : `${lines.slice(0, 3).join(", ")} + ${lines.length - 3} more`;
  const payload = JSON.stringify({ title, body, url: "/", badgeCount: waitingCount });

  const subscriptions = (await redis.get("push-subscriptions")) || [];
  let sent = 0;
  const stillValid = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payload);
      sent += 1;
      stillValid.push(sub);
    } catch (err) {
      if (err.statusCode !== 404 && err.statusCode !== 410) stillValid.push(sub);
    }
  }

  if (stillValid.length !== subscriptions.length) {
    await redis.set("push-subscriptions", stillValid);
  }

  if (sent > 0) {
    const ids = [
      ...log.ids,
      ...billsDue.map((b) => `bill:${b.id}`),
      ...remindersDue.map((r) => `rem:${r.id}`),
    ];
    await redis.set("notify-log", { date: todayISO, ids });
  }

  return NextResponse.json({ ok: true, sent, billsDue: billsDue.length, remindersDue: remindersDue.length, nowTime });
}
