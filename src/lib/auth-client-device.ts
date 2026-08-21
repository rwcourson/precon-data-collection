"use client";

import {
  oauthDeviceAuthorizationClient,
  oauthProviderClient,
} from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

/** Device-code client for `/device` — keep off the sign-in module graph. */
export const deviceAuthClient = createAuthClient({
  plugins: [oauthProviderClient(), oauthDeviceAuthorizationClient()],
});
