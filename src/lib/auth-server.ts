import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as authSchema from "@/db/auth-schema";
import { getRuntimeConfig } from "@/lib/runtime-config";

function trustedOrigins(): string[] {
  try {
    return getRuntimeConfig().allowedOrigins;
  } catch {
    return (process.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean);
  }
}

/**
 * Better Auth server — Microsoft Entra OAuth.
 * App roles still live on `users` via email → resolveSsoUser().
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: authSchema,
  }),
  socialProviders: {
    microsoft: {
      clientId: process.env.MICROSOFT_CLIENT_ID as string,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET as string,
      tenantId: process.env.MICROSOFT_TENANT_ID as string,
      authority: "https://login.microsoftonline.com",
      prompt: "select_account",
      mapProfileToUser: (profile) => {
        const p = profile as Record<string, unknown>;
        const email =
          (typeof p.email === "string" && p.email) ||
          (typeof p.preferred_username === "string" && p.preferred_username) ||
          (typeof p.upn === "string" && p.upn) ||
          "";
        const name =
          (typeof p.name === "string" && p.name) ||
          (typeof p.preferred_username === "string" && p.preferred_username) ||
          "Microsoft user";
        return {
          // Entra can return huge base64 profile photos that blow cookie/header limits.
          image: undefined,
          email: email.toLowerCase(),
          name,
        };
      },
    },
  },
  trustedOrigins: trustedOrigins(),
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["microsoft"],
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
