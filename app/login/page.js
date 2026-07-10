"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Incorrect passcode. Try again.");
      }
    } catch (err) {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div
            className="icon-gradient rounded-2xl flex items-center justify-center mb-4"
            style={{ width: 56, height: 56 }}
          >
            <Wallet size={26} color="#ffffff" strokeWidth={2.2} />
          </div>
          <h1 className="font-display" style={{ fontSize: 26, fontWeight: 700, color: "#2D2A26" }}>
            Bills
          </h1>
          <p className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
            Enter the passcode to continue
          </p>
        </div>

        <form onSubmit={submit} className="card card-shadow" style={{ borderRadius: 20, padding: 20 }}>
          <label className="text-muted" style={{ fontSize: 12, fontWeight: 500 }}>
            Passcode
          </label>
          <div className="flex items-center gap-2 input-field rounded-xl px-3 py-3 mt-1">
            <Lock size={15} color="#8C8577" />
            <input
              type="password"
              inputMode="text"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 bg-transparent outline-none"
              style={{ color: "#2D2A26" }}
            />
          </div>

          {error && (
            <p style={{ color: "#A8492C", fontSize: 13, marginTop: 8 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="btn-gradient w-full mt-4 rounded-xl"
            style={{
              padding: "12px 0",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 600,
              opacity: loading || !password ? 0.5 : 1,
            }}
          >
            {loading ? "Checking…" : "Unlock"}
          </button>
        </form>
      </div>
    </div>
  );
}
