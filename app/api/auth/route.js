import { NextResponse } from "next/server";

export async function POST(request) {
  const { password } = await request.json();

  if (!process.env.APP_PASSWORD || !process.env.SESSION_SECRET) {
    return NextResponse.json(
      { error: "Server is missing APP_PASSWORD or SESSION_SECRET env vars." },
      { status: 500 }
    );
  }

  if (password === process.env.APP_PASSWORD) {
    const res = NextResponse.json({ ok: true });
    res.cookies.set("session", process.env.SESSION_SECRET, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ ok: false }, { status: 401 });
}
