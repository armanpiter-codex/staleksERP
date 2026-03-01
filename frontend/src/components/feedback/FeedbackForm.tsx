"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Send, Check, Loader2 } from "lucide-react";
import clsx from "clsx";
import { submitFeedback } from "@/lib/feedbackApi";
import type { FeedbackCategory } from "@/types/feedback";
import { VoiceRecorder } from "./VoiceRecorder";
import { AttachmentPreview } from "./AttachmentPreview";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "bug", label: "Ошибка" },
  { value: "suggestion", label: "Предложение" },
  { value: "question", label: "Вопрос" },
  { value: "other", label: "Другое" },
];

type FormState = "idle" | "submitting" | "success" | "error";

interface FeedbackFormProps {
  onSuccess: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("other");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasContent = content.trim().length >= 10;
  const hasAudio = audioBlob !== null;
  const canSubmit = (hasContent || hasAudio) && formState === "idle";

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setAttachments((prev) => {
        const combined = [...prev, ...files];
        return combined.slice(0, 5);
      });
      e.target.value = "";
    },
    [],
  );

  const handleRemoveAttachment = useCallback((index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!canSubmit) return;

      setFormState("submitting");
      setErrorMsg("");

      try {
        const fd = new FormData();
        if (content.trim()) fd.append("content", content.trim());
        fd.append("category", category);
        fd.append("page_url", window.location.pathname);

        if (audioBlob) {
          fd.append("audio", audioBlob, "voice.webm");
        }
        attachments.forEach((file) => fd.append("attachments", file));

        await submitFeedback(fd);
        setFormState("success");
        setTimeout(() => onSuccess(), 1200);
      } catch (err: unknown) {
        setFormState("error");
        const msg =
          err instanceof Error ? err.message : "Не удалось отправить";
        setErrorMsg(msg);
        setTimeout(() => setFormState("idle"), 3000);
      }
    },
    [canSubmit, content, category, audioBlob, attachments, onSuccess],
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Category pills */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Категория
        </label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                category === cat.value
                  ? "bg-staleks-lime text-gray-800"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200",
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Textarea */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Описание
        </label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Опишите проблему или предложение (мин. 10 символов)..."
          rows={4}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-staleks-lime focus:outline-none focus:ring-1 focus:ring-staleks-lime resize-none"
        />
        {content.trim().length > 0 && content.trim().length < 10 && (
          <p className="mt-1 text-xs text-amber-500">
            Минимум 10 символов ({content.trim().length}/10)
          </p>
        )}
      </div>

      {/* Voice + Attach row */}
      <div className="flex items-center gap-3">
        <VoiceRecorder
          onRecordingComplete={setAudioBlob}
          onClear={() => setAudioBlob(null)}
          hasRecording={hasAudio}
        />

        <button
          type="button"
          onClick={handleAttach}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          title="Прикрепить фото"
        >
          <Paperclip className="h-4 w-4" />
          <span>Фото</span>
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />

        {attachments.length > 0 && (
          <span className="text-xs text-gray-400">
            {attachments.length}/5
          </span>
        )}
      </div>

      {/* Attachment previews */}
      <AttachmentPreview files={attachments} onRemove={handleRemoveAttachment} />

      {/* Error message */}
      {formState === "error" && errorMsg && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Submit button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
            formState === "success"
              ? "bg-green-500 text-white"
              : canSubmit
                ? "bg-staleks-lime text-gray-800 hover:bg-staleks-lime/80"
                : "bg-gray-100 text-gray-400 cursor-not-allowed",
          )}
        >
          {formState === "submitting" && (
            <Loader2 className="h-4 w-4 animate-spin" />
          )}
          {formState === "success" && <Check className="h-4 w-4" />}
          {formState === "idle" && <Send className="h-4 w-4" />}
          {formState === "error" && <Send className="h-4 w-4" />}
          {formState === "success" ? "Отправлено!" : "Отправить"}
        </button>
      </div>
    </form>
  );
}
