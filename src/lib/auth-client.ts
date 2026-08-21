"use client";

import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Defaults to same-origin /api/auth; BETTER_AUTH_URL is for the server.
  // oauthProviderClient preserves the signed authorize query while Entra
  // creates a session. Device-code plugins live in auth-client-device so
  // /sign-in does not compile the RFC 8628 client.
  plugins: [oauthProviderClient()],
});
