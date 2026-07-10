import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

const SEED_BILLS = [
  { id: "seed-1", name: "Mortgage", dueDay: 1, amount: 1439.79, paymentType: "Bank Acc.", paid: true },
  { id: "seed-2", name: "Phone", dueDay: 1, amount: 80.0, paymentType: "Bank Acc.", paid: true },
  { id: "seed-3", name: "Car Insurance", dueDay: 9, amount: 78.98, paymentType: "Bank Acc.", paid: false },
  { id: "seed-4", name: "Natural Gas", dueDay: 13, amount: 150.0, paymentType: "Bank Acc.", paid: false },
  { id: "seed-5", name: "Internet", dueDay: 15, amount: 60.96, paymentType: "Bank Acc.", paid: false },
  { id: "seed-6", name: "Electric", dueDay: 17, amount: 200.0, paymentType: "Bank Acc.", paid: false },
  { id: "seed-7", name: "Trash", dueDay: 20, amount: 72.0, paymentType: "Bank Acc.", paid: false },
  { id: "seed-8", name: "Sewer", dueDay: 24, amount: 164.62, paymentType: "Bank Acc.", paid: false },
  { id: "seed-9", name: "Student Loans", dueDay: 25, amount: 200.0, paymentType: "Bank Acc.", paid: false },
  { id: "seed-10", name: "Credit Card", dueDay: 31, amount: 150.0, paymentType: "Bank Acc.", paid: false },
];

export async function GET() {
  try {
    let bills = await redis.get("bills");
    if (!bills) {
      bills = SEED_BILLS;
      await redis.set("bills", bills);
    }
    return NextResponse.json(bills);
  } catch (err) {
    return NextResponse.json(
      { error: "Could not reach the database. Check your Upstash env vars." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const bills = await request.json();
    await redis.set("bills", bills);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not save. Check your Upstash env vars." },
      { status: 500 }
    );
  }
}
