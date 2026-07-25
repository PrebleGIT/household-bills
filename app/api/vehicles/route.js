import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "vehicles-list";

const SEED_VEHICLES = [
  { id: "veh-1", name: "Vehicle 1", mileage: 0, lastOilDate: null, oilInterval: 5000, engine: "", tireSize: "", oilType: "", oilAmount: "", oilFilter: "", drainPlugSocket: "", lugNutSocket: "", wheelTorque: "", notes: "", log: [] },
  { id: "veh-2", name: "Vehicle 2", mileage: 0, lastOilDate: null, oilInterval: 5000, engine: "", tireSize: "", oilType: "", oilAmount: "", oilFilter: "", drainPlugSocket: "", lugNutSocket: "", wheelTorque: "", notes: "", log: [] },
];

export async function GET() {
  try {
    let items = await redis.get(KEY);
    if (!items) {
      items = SEED_VEHICLES;
      await redis.set(KEY, items);
    }
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
