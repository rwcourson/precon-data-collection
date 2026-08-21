import { describe, expect, it } from "vitest";
import {
  authBaseURLConfig,
  authPublicOrigin,
  isHostedAuthRuntime,
  LOCAL_AUTH_ALLOWED_HOSTS,
} from "@/lib/auth-base-url";

describe("authBaseURLConfig", () => {
  it("keeps hosted SSO on the Entra-registered origin", () => {
    const config = authBaseURLConfig({
      VERCEL: "1",
      APP_ENV: "production",
      APP_ORIGIN: "https://precon-data.magnus.brasfieldgorrie.app",
      BETTER_AUTH_URL: "https://precon-data.magnus.brasfieldgorrie.app",
    });
    expect(config).toBe("https://precon-data.magnus.brasfieldgorrie.app");
    expect(isHostedAuthRuntime({ VERCEL: "1" })).toBe(true);
  });

  it("follows the local request host instead of a leftover :3001 env", () => {
    const config = authBaseURLConfig({
      APP_ENV: "local",
      APP_ORIGIN: "https://precon-data.magnus.brasfieldgorrie.app",
      BETTER_AUTH_URL: "http://localhost:3001",
    });
    expect(config).toEqual({
      allowedHosts: [...LOCAL_AUTH_ALLOWED_HOSTS],
      fallback: "http://localhost:3001",
      protocol: "http",
    });
    expect(authPublicOrigin(config)).toBe("http://localhost:3001");
  });

  it("does not use a production APP_ORIGIN as the local OAuth fallback", () => {
    const config = authBaseURLConfig({
      APP_ENV: "local",
      APP_ORIGIN: "https://precon-data.magnus.brasfieldgorrie.app",
    });
    expect(config).toMatchObject({
      fallback: "http://localhost:3000",
      protocol: "http",
    });
  });
});
