import { NextResponse } from "next/server";

export function middleware(request) {
  const session = request.cookies.get("session")?.value;

  if (session && session === process.env.SESSION_SECRET) {
    return NextResponse.next();
  }

  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|login|api/auth).*)",
  ],
};
