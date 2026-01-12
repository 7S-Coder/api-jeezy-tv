// app/components/JeezWallet.tsx
// Composant exemple: Afficher le solde Jeez

"use client";

import { useEffect, useState } from "react";
import { getJeezBalanceAction } from "@/app/actions/payment.actions";

export function JeezWallet() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchBalance() {
      try {
        const result = await getJeezBalanceAction();
        if (result.success) {
          setBalance(result.data ?? 0);
        }
      } catch (error) {
        console.error("Failed to fetch balance:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchBalance();
  }, []);

  if (loading) {
    return <div className="animate-pulse">Loading wallet...</div>;
  }

  if (balance === null) {
    return <div className="text-red-600">Failed to load wallet</div>;
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-purple-500 rounded-lg text-white font-bold">
      <span>Jeez</span>
      <span className="text-lg">{balance.toLocaleString()}</span>
    </div>
  );
}
