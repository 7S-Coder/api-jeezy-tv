// types/next-auth.d.ts
// Augmenter le type Session et User de NextAuth.js

import "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    role: "USER" | "VIP" | "ADMIN";
    isActive: boolean;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: "USER" | "VIP" | "ADMIN";
      isActive: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: "USER" | "VIP" | "ADMIN";
  }
}
