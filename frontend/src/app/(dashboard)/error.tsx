"use client";

import { useEffect } from "react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-8 text-center">
        <p className="mb-2 text-4xl">⚠️</p>
        <h2 className="mb-2 text-lg font-bold text-red-700">
          Произошла ошибка
        </h2>
        <p className="mb-4 text-sm text-red-600">
          {error.message || "Неизвестная ошибка"}
        </p>
        <pre className="mb-4 max-h-40 overflow-auto rounded bg-red-100 p-3 text-left text-xs text-red-800">
          {error.stack}
        </pre>
        <button
          onClick={reset}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Попробовать снова
        </button>
      </div>
    </div>
  );
}
