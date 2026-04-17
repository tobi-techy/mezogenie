"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";

function ConnectInner() {
  const { address, isConnected } = useAccount();
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isConnected && address && phone && !linked) {
      fetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"}/api/connect-wallet`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, wallet: address }),
      })
        .then((r) => r.json())
        .then(() => setLinked(true))
        .catch(() => setError("Failed to link wallet. Try again."));
    }
  }, [isConnected, address, phone, linked]);

  return (
    <div style={{ textAlign: "center", padding: 40, maxWidth: 420, margin: "0 auto" }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>🧞 MezoGenie</h1>
      <p style={{ color: "#888", marginBottom: 32 }}>Connect your wallet to activate your Bitcoin bank in iMessage</p>

      {linked ? (
        <div style={{ background: "#1a3a1a", padding: 24, borderRadius: 16, border: "1px solid #2a5a2a" }}>
          <p style={{ fontSize: 24, marginBottom: 8 }}>✅ Connected!</p>
          <p style={{ color: "#888", fontSize: 14 }}>Wallet: {address?.slice(0, 6)}...{address?.slice(-4)}</p>
          <p style={{ color: "#aaa", marginTop: 16 }}>Go back to iMessage — your bank is ready! 🎉</p>
        </div>
      ) : (
        <>
          <ConnectButton />
          {phone && <p style={{ color: "#666", marginTop: 16, fontSize: 12 }}>Linking to: {phone}</p>}
          {error && <p style={{ color: "#f44", marginTop: 8 }}>{error}</p>}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div style={{ textAlign: "center", padding: 40 }}>Loading...</div>}>
      <ConnectInner />
    </Suspense>
  );
}
