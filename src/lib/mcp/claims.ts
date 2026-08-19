/** Verified OAuth access-token claims passed from `requireMcpAuth`. */
export type McpAccessTokenClaims = {
  sub?: string;
  email?: unknown;
  preferred_username?: unknown;
  upn?: unknown;
  scope?: unknown;
  exp?: number;
  jti?: unknown;
  azp?: unknown;
  client_id?: unknown;
  aud?: unknown;
  [key: string]: unknown;
};
