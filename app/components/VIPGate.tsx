// app/components/VIPGate.tsx
// Composant exemple: Afficher du contenu SEULEMENT si l'utilisateur est VIP

"use client";

import { useEffect, useState } from "react";
import { isUserVIPAction } from "@/app/actions/payment.actions";

interface VIPGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function VIPGate({ children, fallback }: VIPGateProps) {
  const [isVIP, setIsVIP] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkVIPStatus() {
      const result = await isUserVIPAction();
      setIsVIP(result.success ? result.data : false);
    }

    checkVIPStatus();
  }, []);

  // Chargement...
  if (isVIP === null) {
    return <div className="text-center text-gray-500">Loading...</div>;
  }

  // VIP - afficher le contenu
  if (isVIP) {
    return <>{children}</>;
  }

  // Non-VIP - afficher le fallback ou message
  return (
    fallback || (
      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          🎬 This premium content requires a VIP subscription.
        </p>
        <a href="/upgrade" className="text-blue-600 underline">
          Upgrade to VIP
        </a>
      </div>
    )
  );
}
