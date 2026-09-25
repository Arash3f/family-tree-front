"use client";

import NextError from "next/error";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  return (
    <html>
      <body>
        {/* `statusCode` is unused with App Router; NextError still needs it. */}
        <NextError statusCode={0} />
        {process.env.NODE_ENV === "development" ? (
          <pre style={{ whiteSpace: "pre-wrap", padding: "1rem" }}>
            {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ""}
          </pre>
        ) : null}
      </body>
    </html>
  );
}
