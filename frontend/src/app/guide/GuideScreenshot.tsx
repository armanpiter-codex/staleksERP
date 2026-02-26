"use client";

import { useState } from "react";
import Image from "next/image";

export function GuideScreenshot({
  src,
  alt,
  caption,
}: {
  src: string;
  alt: string;
  caption?: string;
}) {
  const [error, setError] = useState(false);

  return (
    <figure className="my-6 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
      {error ? (
        <div className="w-full h-52 bg-gray-50 flex flex-col items-center justify-center gap-2 border-b border-gray-200">
          <svg
            className="w-10 h-10 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="text-sm text-gray-400 italic text-center px-4">{alt}</p>
        </div>
      ) : (
        <div className="relative w-full bg-gray-50">
          <Image
            src={src}
            alt={alt}
            width={1200}
            height={600}
            className="w-full h-auto"
            unoptimized
            onError={() => setError(true)}
          />
        </div>
      )}
      {caption && (
        <figcaption className="px-4 py-2 bg-gray-50 text-sm text-staleks-muted border-t border-gray-200">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
