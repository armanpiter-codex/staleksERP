"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ru">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fef2f2",
          fontFamily: "system-ui, sans-serif",
        }}>
          <div style={{
            maxWidth: "28rem",
            padding: "2rem",
            borderRadius: "0.75rem",
            border: "1px solid #fecaca",
            backgroundColor: "white",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>⚠️</p>
            <h2 style={{ fontSize: "1.25rem", fontWeight: "bold", color: "#b91c1c", marginBottom: "0.5rem" }}>
              Критическая ошибка
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#dc2626", marginBottom: "1rem" }}>
              {error.message || "Неизвестная ошибка приложения"}
            </p>
            <pre style={{
              maxHeight: "10rem",
              overflow: "auto",
              backgroundColor: "#fee2e2",
              padding: "0.75rem",
              borderRadius: "0.5rem",
              fontSize: "0.75rem",
              textAlign: "left",
              color: "#991b1b",
              marginBottom: "1rem",
            }}>
              {error.stack}
            </pre>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#dc2626",
                color: "white",
                padding: "0.5rem 1.5rem",
                borderRadius: "0.5rem",
                border: "none",
                cursor: "pointer",
                fontWeight: "500",
              }}
            >
              Перезагрузить
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
