"use client";

/* Root-layout error boundary. Unlike error.tsx, this replaces the entire
   document (layout included), so it ships its own <html>/<body> and inline
   styles — globals.css / theme tokens may not have loaded when it renders. */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgb(8 8 11)",
          color: "rgb(237 237 242)",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <div style={{ maxWidth: 360, padding: 32, textAlign: "center" }}>
          <h1 style={{ fontSize: 15, fontWeight: 600, margin: "0 0 4px" }}>Signal lost</h1>
          <p style={{ fontSize: 14, color: "rgb(138 138 150)", margin: "0 0 20px" }}>
            Something broke loading the app. Your data is fine.
          </p>
          <button
            onClick={reset}
            style={{
              height: 36,
              padding: "0 16px",
              fontSize: 14,
              fontWeight: 500,
              color: "white",
              background: "rgb(139 124 255)",
              border: "none",
              borderRadius: 6,
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
