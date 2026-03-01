"use client";

import { useCallback, useRef, useState } from "react";
import { Paperclip, Send, Loader2 } from "lucide-react";
import clsx from "clsx";
import { submitFeedback } from "@/lib/feedbackApi";
import type { FeedbackMessage } from "@/types/feedback";
import { VoiceRecorder } from "./VoiceRecorder";
import { AttachmentPreview } from "./AttachmentPreview";
import { FeedbackChat } from "./FeedbackChat";

type FormView = "form" | "chat";

interface FeedbackFormProps {
  onSuccess: () => void;
}

export function FeedbackForm({ onSuccess }: FeedbackFormProps) {
  // --- Form state ---
  const [content, setContent] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Chat state (after submit) ---
  const [view, setView] = useState<FormView>("form");
  const [feedbackId, setFeedbackId] = useState<string | null>(null);
  const [initialMessages, setInitialMessages] = useState<FeedbackMessage[]>([]);

  const hasContent = content.trim().length >= 10;
  const hasAudio = audioBlob !== null;
  const canSubmit = (hasContent || hasAudio) && !isSubmitting;

  const handleAttach = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      setAttachments((prev) => [...prev, ...files].slice(0, 5));
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

      setIsSubmitting(true);
      setErrorMsg("");

      try {
        const fd = new FormData();
        if (content.trim()) fd.append("content", content.trim());
        fd.append("page_url", window.location.pathname);

        if (audioBlob) fd.append("audio", audioBlob, "voice.webm");
        attachments.forEach((file) => fd.append("attachments", file));

        const result = await submitFeedback(fd);

        // Переходим в чат-режим с первым AI-вопросом
        setFeedbackId(result.id);
        setInitialMessages(result.messages ?? []);
        setView("chat");
      } catch (err: unknown) {
        const msg =
          err instanceof Error ? err.message : "Не удалось отправить";
        setErrorMsg(msg);
      } finally {
        setIsSubmitting(false);
      }
    },
    [canSubmit, content, audioBlob, attachments],
  );

  // --- Chat view ---
  if (view === "chat" && feedbackId) {
    return (
      <FeedbackChat
        feedbackId={feedbackId}
        initialMessages={initialMessages}
        onDone={onSuccess}
      />
    );
  }

  // --- Form view ---
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Описание */}
      <p className="text-sm text-gray-500">
        Напишите что угодно: баги, пожелания, идеи. Можно текстом, голосом
        или приложить фото.
      </p>

      {/* Textarea */}
      <div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Опишите проблему или предложение..."
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
          <span className="text-xs text-gray-400">{attachments.length}/5</span>
        )}
      </div>

      {/* Attachment previews */}
      <AttachmentPreview files={attachments} onRemove={handleRemoveAttachment} />

      {/* Error */}
      {errorMsg && <p className="text-sm text-red-500">{errorMsg}</p>}

      {/* Submit */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!canSubmit}
          className={clsx(
            "flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-medium transition-all",
            canSubmit
              ? "bg-staleks-lime text-gray-800 hover:bg-staleks-lime/80"
              : "bg-gray-100 text-gray-400 cursor-not-allowed",
          )}
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isSubmitting ? "Отправка…" : "Отправить"}
        </button>
      </div>
    </form>
  );
}
