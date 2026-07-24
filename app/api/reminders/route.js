import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();
const KEY = "reminders-list";

// Seeded from the user's real Apple Reminders list, minus items that duplicate
// bills already tracked in the Bills tab (Mortgage, Electric, Car Insurance, etc.)
const SEED_REMINDERS = [
  { id: "r1", name: "Trash Pickup", dueDate: "2026-07-27", dueTime: "09:00", repeatValue: 1, repeatUnit: "weeks", done: false },
  { id: "r2", name: "Loretta $225", dueDate: "2026-07-24", dueTime: "09:00", repeatValue: 1, repeatUnit: "weeks", done: false },
  { id: "r3", name: "Clean / Refill Robovac", dueDate: "2026-08-02", dueTime: "09:00", repeatValue: 2, repeatUnit: "weeks", done: false },
  { id: "r4", name: "Murphy Nails", dueDate: "2026-07-23", dueTime: "09:00", repeatValue: 1, repeatUnit: "months", done: false },
  { id: "r5", name: "Clean Air Purifier Filter", dueDate: "2026-07-28", dueTime: "09:00", repeatValue: 1, repeatUnit: "months", done: false },
  { id: "r6", name: "Clean Bathtub Jets", dueDate: "2026-08-22", dueTime: "09:00", repeatValue: 1, repeatUnit: "months", done: false },
  { id: "r7", name: "Softener Cleaner", dueDate: "2026-08-04", dueTime: "09:00", repeatValue: 4, repeatUnit: "months", done: false },
  { id: "r8", name: "Replace Furnace Filter", dueDate: "2026-09-26", dueTime: "09:00", repeatValue: 4, repeatUnit: "months", done: false },
  { id: "r9", name: "Replace Air Purifier Filter", dueDate: "2026-08-01", dueTime: "09:00", repeatValue: 6, repeatUnit: "months", done: false },
  { id: "r10", name: "Drain Water Heater", dueDate: "2026-07-01", dueTime: "09:00", repeatValue: 1, repeatUnit: "years", done: false },
  { id: "r11", name: "Drain Pressure Tank", dueDate: "2026-07-01", dueTime: "09:00", repeatValue: 1, repeatUnit: "years", done: false },
  { id: "r12", name: "Dryer Vent", dueDate: "2026-07-01", dueTime: "09:00", repeatValue: 1, repeatUnit: "years", done: false },
  { id: "r13", name: "Clean AC Unit", dueDate: "2027-06-12", dueTime: "09:00", repeatValue: 1, repeatUnit: "years", done: false },
  { id: "r14", name: "Anode Rod", dueDate: "2027-08-01", dueTime: "09:00", repeatValue: 2, repeatUnit: "years", done: false },
  { id: "r15", name: "Reschedule Dentist", dueDate: "2026-07-24", dueTime: "09:00", repeatValue: null, repeatUnit: null, done: false },
  { id: "r16", name: "Natural Gas Rates", dueDate: "2026-12-19", dueTime: "09:00", repeatValue: null, repeatUnit: null, done: false },
  { id: "r17", name: "Electric Rates", dueDate: "2027-01-03", dueTime: "09:00", repeatValue: null, repeatUnit: null, done: false },
];

export async function GET() {
  try {
    let items = await redis.get(KEY);
    if (!items) {
      items = SEED_REMINDERS;
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
