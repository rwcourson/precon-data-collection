"use client";

import {
  oauthDeviceAuthorizationClient,
  oauthProviderClient,
} from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // Defaults to same-origin /api/auth; BETTER_AUTH_URL is for the server.
  // oauthProviderClient preserves the signed authorize query while Entra
  // creates a session; the device client powers the repo-local CLI fallback.
  plugins: [oauthProviderClient(), oauthDeviceAuthorizationClient()],
});
