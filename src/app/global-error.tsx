"use client";

import { errorDigest } from "@/components/ui/ErrorPanel";

/**
 * Last-resort boundary: replaces the root layout, so it renders its own
 * document and globals.css / fonts are not loaded (Next docs, "Global
 * Error"). Styling is inline and mirrors the dark console palette.
 */
export default function GlobalError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  const digest = errorDigest(error);
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#0b0b0e",
          color: "#f4f4f5",
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <main
          style={{
            width: "100%",
            maxWidth: "36rem",
            padding: "1.75rem",
            borderRadius: "0.75rem",
            borderLeft: "4px solid #f97316",
            background: "#1c1c21",
          }}
        >
          <h1 style={{ margin: 0, fontSize: "1.75rem" }}>
            Something went wrong
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "0.9rem" }}>
            BallSim hit an unexpected problem. Your save is safe; try again, or
            head back.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: "2.75rem",
                padding: "0 1rem",
                border: 0,
                borderRadius: "0.375rem",
                background: "#f97316",
                color: "#0b0b0e",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            {/* A plain anchor: the router may be what failed. */}
            <a href="/home" style={{ color: "#d4d4d8", fontSize: "0.9rem" }}>
              Back to BallSim home
            </a>
          </div>
          {digest ? (
            <p style={{ color: "#71717a", fontSize: "0.75rem" }}>
              Error reference: {digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
