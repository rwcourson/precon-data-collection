"use client";

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Defaults to same-origin /api/auth; BETTER_AUTH_URL is for the server.
});
