import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// Note: bills that already live in the Bills tab (Mortgage, Electric, Internet,
// Phone, Car Insurance, Trash, Student Loans, Credit Card, Natural Gas, Sewer)
// are intentionally NOT duplicated here. The Budget tab pulls those directly
// from the shared bills list so editing a bill anywhere updates both tabs.
// This list is only for expenses that aren't recurring due-date bills.
const SEED_BUDGET = {
  incomes: [
    { id: "inc-1", name: "Michael Monthly Income", amount: 4000.0 },
    { id: "inc-2", name: "Shelby Monthly Income", amount: 1830.0 },
  ],
  items: [
    { id: "item-1", name: "Spotify / Apple Music", amount: 25.0 },
    { id: "item-2", name: "Groceries", amount: 500.0 },
    { id: "item-3", name: "Apple", amount: 4.0 },
    { id: "item-4", name: "Gas", amount: 200.0 },
    { id: "item-5", name: "Eating Out", amount: 250.0 },
    { id: "item-6", name: "Savings", amount: 500.0 },
    { id: "item-7", name: "Child Care", amount: 600.0 },
    { id: "item-8", name: "Ring Doorbell", amount: 10.71 },
    { id: "item-9", name: "Oura Ring", amount: 5.99 },
  ],
};

export async function GET() {
  try {
    let budget = await redis.get("budget");
    if (!budget) {
      budget = SEED_BUDGET;
      await redis.set("budget", budget);
    }
    return NextResponse.json(budget);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach the database. Check your Upstash env vars." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const budget = await request.json();
    await redis.set("budget", budget);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not save. Check your Upstash env vars." },
      { status: 500 }
    );
  }
}
