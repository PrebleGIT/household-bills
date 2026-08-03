import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "recipes-list";

export async function GET() {
  try {
    const items = (await redis.get(KEY)) || [];
    return NextResponse.json(items);
  } catch (err) {
    return NextResponse.json({ error: "Could not reach the database." }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const items = await request.json();
    await redis.set(KEY, items);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: "Could not save." }, { status: 500 });
  }
}
