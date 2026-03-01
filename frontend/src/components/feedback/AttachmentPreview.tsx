"use client";

import { X } from "lucide-react";

interface AttachmentPreviewProps {
  files: File[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ files, onRemove }: AttachmentPreviewProps) {
  if (files.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {files.map((file, idx) => (
        <div key={idx} className="relative group">
          <img
            src={URL.createObjectURL(file)}
            alt={file.name}
            className="h-16 w-16 rounded-lg object-cover border border-gray-200"
          />
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X className="h-3 w-3" />
          </button>
          <span className="block text-[10px] text-gray-400 truncate w-16 mt-0.5">
            {file.name}
          </span>
        </div>
      ))}
    </div>
  );
}
