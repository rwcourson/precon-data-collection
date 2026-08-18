/**
 * Structured domain errors — inspired by bg-new-scaffold ServiceError.
 * Services throw these; actions and route handlers map them to UI/HTTP responses.
 */

export type DomainErrorCode =
  | "NOT_FOUND"
  | "FORBIDDEN"
  | "BAD_REQUEST"
  | "CONFLICT"
  | "UNAUTHORIZED"
  | "UNAVAILABLE"
  | "RATE_LIMITED"
  | "INTERNAL";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly what: string;
  readonly why: string;
  readonly solution: string;

  constructor(opts: {
    code: DomainErrorCode;
    what: string;
    why: string;
    solution: string;
  }) {
    super(opts.what);
    this.name = "DomainError";
    this.code = opts.code;
    this.what = opts.what;
    this.why = opts.why;
    this.solution = opts.solution;
  }

  static notFound(what: string, why?: string): DomainError {
    return new DomainError({
      code: "NOT_FOUND",
      what,
      why: why ?? "The requested resource does not exist.",
      solution: "Check the id and try again.",
    });
  }

  static forbidden(what?: string, why?: string): DomainError {
    return new DomainError({
      code: "FORBIDDEN",
      what: what ?? "You do not have permission to do that.",
      why: why ?? "Ownership or role check failed.",
      solution: "Ask an RPD/SPD or Corporate Admin for access.",
    });
  }

  static badRequest(
    what: string,
    why?: string,
    solution?: string
  ): DomainError {
    return new DomainError({
      code: "BAD_REQUEST",
      what,
      why: why ?? "The request input was invalid.",
      solution: solution ?? "Fix the input and retry.",
    });
  }

  static conflict(what: string, why?: string): DomainError {
    return new DomainError({
      code: "CONFLICT",
      what,
      why: why ?? "The change conflicts with existing data.",
      solution: "Refresh and resolve the conflict before retrying.",
    });
  }

  static unauthorized(what?: string): DomainError {
    return new DomainError({
      code: "UNAUTHORIZED",
      what: what ?? "Authentication is required.",
      why: "No valid session or API token was provided.",
      solution: "Sign in or supply a valid API token.",
    });
  }

  static unavailable(what: string, why?: string): DomainError {
    return new DomainError({
      code: "UNAVAILABLE",
      what,
      why: why ?? "A required dependency is not configured or available.",
      solution: "Check Admin → Integrations for missing credentials.",
    });
  }

  /** Safe wire shape — never includes stack traces or secrets. */
  toJSON() {
    return {
      code: this.code,
      what: this.what,
      why: this.why,
      solution: this.solution,
    };
  }
}

const HTTP_STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  BAD_REQUEST: 400,
  CONFLICT: 409,
  UNAUTHORIZED: 401,
  UNAVAILABLE: 503,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

export function getDomainErrorHttpStatus(error: DomainError): number {
  return HTTP_STATUS_BY_CODE[error.code];
}

export function findDomainError(
  error: unknown
): ReturnType<DomainError["toJSON"]> | null {
  if (error instanceof DomainError) return error.toJSON();
  if (error instanceof Error && "cause" in error && error.cause) {
    return findDomainError(error.cause);
  }
  return null;
}
