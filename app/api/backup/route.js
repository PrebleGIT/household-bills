import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export async function GET() {
  try {
    const [bills, budget, reminders, vehicles] = await Promise.all([
      redis.get("bills"),
      redis.get("budget"),
      redis.get("reminders-list"),
      redis.get("vehicles-list"),
    ]);
    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      bills: bills || [],
      budget: budget || { incomes: [], items: [] },
      reminders: reminders || [],
      vehicles: vehicles || [],
    });
  } catch (err) {
    return NextResponse.json({ error: "Could not read data for backup." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "That doesn't look like a valid backup file." }, { status: 400 });
    }
    await Promise.all([
      redis.set("bills", data.bills || []),
      redis.set("budget", data.budget || { incomes: [], items: [] }),
      redis.set("reminders-list", data.reminders || []),
      redis.set("vehicles-list", data.vehicles || []),
    ]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Could not restore backup." }, { status: 500 });
  }
}
