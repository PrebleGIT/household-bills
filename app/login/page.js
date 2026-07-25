"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        setError("That code didn't match. Try again.");
      }
    } catch (err) {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <form onSubmit={submit} style={{ width: "100%", maxWidth: 320 }}>
        <div className="eyebrow">House Hub</div>
        <h1 style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", margin: "8px 0 26px" }}>
          Enter your code
        </h1>

        <input
          className="input"
          type="password"
          inputMode="numeric"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          style={{ textAlign: "center", letterSpacing: "0.3em", fontSize: 18, padding: "14px 12px" }}
        />

        {error && <div className="notice-err" style={{ marginTop: 12 }}>{error}</div>}

        <button type="submit" className="btn-primary" disabled={loading || !password} style={{ marginTop: 14 }}>
          {loading ? "Checking…" : "Unlock"}
        </button>
      </form>
    </div>
  );
}
