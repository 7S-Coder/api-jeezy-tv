// app/api/auth/[...nextauth]/route.ts
// Route NextAuth.js - Gère /api/auth/signin, /api/auth/signout, /api/auth/session

import { handlers } from "@/auth";

export const { GET, POST } = handlers;
