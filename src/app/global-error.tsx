"use client";

// Replaces the root layout when it fails, so it must render its own
// <html>/<body> and cannot rely on globals.css or the app font (per Next docs).
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          background: "#F4F7FB",
          color: "#1c2433",
        }}
      >
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 8px" }}>
            Something went wrong
          </h2>
          <p
            style={{
              fontSize: 14,
              lineHeight: 1.5,
              margin: "0 0 16px",
              color: "#5b6472",
            }}
          >
            An unexpected error kept the app from loading.
            {error.digest ? ` Reference: ${error.digest}` : ""}
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{
              height: 32,
              padding: "0 14px",
              borderRadius: 6,
              border: "1px solid transparent",
              background: "#1c2433",
              color: "#ffffff",
              fontSize: 14,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
