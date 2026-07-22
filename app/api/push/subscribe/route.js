import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "push-subscriptions";

export async function POST(request) {
  try {
    const subscription = await request.json();
    if (!subscription || !subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }
    const existing = (await redis.get(KEY)) || [];
    const withoutDupe = existing.filter((s) => s.endpoint !== subscription.endpoint);
    const next = [...withoutDupe, subscription];
    await redis.set(KEY, next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Could not save subscription." }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { endpoint } = await request.json();
    const existing = (await redis.get(KEY)) || [];
    const next = existing.filter((s) => s.endpoint !== endpoint);
    await redis.set(KEY, next);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Could not remove subscription." }, { status: 500 });
  }
}
