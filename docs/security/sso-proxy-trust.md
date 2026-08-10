# SSO proxy trust boundary

Production accepts identity only from the B&G authenticating proxy. The proxy
must remove any client-supplied forwarded identity headers, authenticate the
user, then set the allowlisted email/name/groups headers and
`x-precon-sso-trust`. The application compares that shared secret in constant
time before reading identity fields.

The application rejects direct-origin forwarded headers, unapproved email
domains, identities without a mapped application role, and Region-bound roles
without a Region mapping. The origin must not be exposed around the proxy;
network policy remains a required defense in depth control.
