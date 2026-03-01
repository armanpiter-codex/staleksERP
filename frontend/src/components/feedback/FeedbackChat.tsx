"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Loader2, Send } from "lucide-react";
import clsx from "clsx";
import { confirmFeedback, sendMessage } from "@/lib/feedbackApi";
import type { FeedbackMessage } from "@/types/feedback";

interface FeedbackChatProps {
  feedbackId: string;
  initialMessages: FeedbackMessage[];
  onDone: () => void;
}

type ChatState = "idle" | "sending" | "confirming" | "done" | "error";

export function FeedbackChat({
  feedbackId,
  initialMessages,
  onDone,
}: FeedbackChatProps) {
  const [messages, setMessages] = useState<FeedbackMessage[]>(initialMessages);
  const [reply, setReply] = useState("");
  const [chatState, setChatState] = useState<ChatState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [isFinalized, setIsFinalized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Авто-скролл к последнему сообщению
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Фокус на поле ввода при появлении
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSend = useCallback(async () => {
    const text = reply.trim();
    if (!text || chatState !== "idle" || isFinalized) return;

    setChatState("sending");
    setErrorMsg("");

    try {
      const res = await sendMessage(feedbackId, text);
      setReply("");
      setMessages(res.messages);

      if (res.is_finalized) {
        setIsFinalized(true);
        setChatState("done");
        setTimeout(() => onDone(), 2000);
      } else {
        setChatState("idle");
      }
    } catch {
      setChatState("error");
      setErrorMsg("Ошибка отправки. Попробуйте ещё раз.");
      setTimeout(() => setChatState("idle"), 3000);
    }
  }, [reply, chatState, isFinalized, feedbackId, onDone]);

  const handleConfirm = useCallback(async () => {
    if (chatState !== "idle" || isFinalized) return;

    setChatState("confirming");
    setErrorMsg("");

    try {
      await confirmFeedback(feedbackId);
      setIsFinalized(true);
      setChatState("done");
      setTimeout(() => onDone(), 2000);
    } catch {
      setChatState("error");
      setErrorMsg("Ошибка подтверждения. Попробуйте ещё раз.");
      setTimeout(() => setChatState("idle"), 3000);
    }
  }, [chatState, isFinalized, feedbackId, onDone]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const isBusy = chatState === "sending" || chatState === "confirming";

  return (
    <div className="flex flex-col gap-3">
      {/* Подзаголовок */}
      <p className="text-xs text-gray-400">
        AI уточняет детали, чтобы разработчику было понятно что нужно сделать
      </p>

      {/* Чат */}
      <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
        {messages.map((msg) => (
          <ChatBubble key={msg.id} message={msg} />
        ))}

        {/* Индикатор загрузки — AI думает */}
        {chatState === "sending" && (
          <div className="flex items-center gap-2 self-start">
            <div className="w-7 h-7 rounded-full bg-staleks-lime/20 flex items-center justify-center flex-shrink-0">
              <span className="text-xs">🤖</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Финальное состояние */}
      {chatState === "done" && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
          <Check className="h-4 w-4 flex-shrink-0" />
          <span>Спасибо! Ваш фидбэк отправлен разработчику.</span>
        </div>
      )}

      {/* Ошибка */}
      {chatState === "error" && errorMsg && (
        <p className="text-sm text-red-500">{errorMsg}</p>
      )}

      {/* Поле ввода + кнопки */}
      {!isFinalized && chatState !== "done" && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isBusy}
              placeholder="Ответьте на вопрос... (Enter — отправить)"
              rows={2}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-staleks-lime focus:outline-none focus:ring-1 focus:ring-staleks-lime resize-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!reply.trim() || isBusy}
              className={clsx(
                "flex items-center justify-center rounded-lg px-3 transition-colors",
                reply.trim() && !isBusy
                  ? "bg-staleks-lime text-gray-800 hover:bg-staleks-lime/80"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed",
              )}
            >
              <Send className="h-4 w-4" />
            </button>
          </div>

          {/* Кнопка подтверждения */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isBusy}
            className={clsx(
              "w-full flex items-center justify-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              isBusy
                ? "border-gray-200 text-gray-400 cursor-not-allowed"
                : "border-staleks-lime/50 text-gray-700 hover:bg-staleks-lime/10",
            )}
          >
            {chatState === "confirming" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Отправляем…
              </>
            ) : (
              <>
                <Check className="h-4 w-4 text-staleks-lime" />
                Подтвердить и отправить
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatBubble
// ---------------------------------------------------------------------------

function ChatBubble({ message }: { message: FeedbackMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={clsx(
        "flex items-end gap-2",
        isUser ? "flex-row-reverse" : "flex-row",
      )}
    >
      {/* Аватар */}
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-staleks-lime/20 flex items-center justify-center flex-shrink-0 mb-0.5">
          <span className="text-xs">🤖</span>
        </div>
      )}

      {/* Пузырь */}
      <div
        className={clsx(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
          isUser
            ? "bg-staleks-lime text-gray-800 rounded-br-sm"
            : "bg-gray-100 text-gray-700 rounded-bl-sm",
        )}
      >
        {message.content}
      </div>
    </div>
  );
}
