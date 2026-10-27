"use client";

/** Last-resort error page when the root layout itself fails. Bilingual, no dependencies. */
export default function GlobalError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#f9f5ee", color: "#0b1b2b", fontFamily: "system-ui, sans-serif", padding: 24 }}>
        <main style={{ maxWidth: 440, textAlign: "center" }}>
          <h1 style={{ fontSize: 26 }}>Something went wrong</h1>
          <p style={{ color: "#4a5a6a" }}>Please try again in a moment.</p>
          <p dir="rtl" lang="ar" style={{ color: "#4a5a6a" }}>
            حدث خطأ ما، يرجى المحاولة بعد قليل.
          </p>
          <button
            type="button"
            onClick={() => retry()}
            style={{ marginTop: 16, height: 44, padding: "0 24px", border: 0, borderRadius: 999, background: "#127c83", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Try again · حاول مجددًا
          </button>
        </main>
      </body>
    </html>
  );
}
