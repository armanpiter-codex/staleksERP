"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, Play, RotateCcw } from "lucide-react";
import clsx from "clsx";

type RecorderState = "idle" | "recording" | "recorded";

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob) => void;
  onClear: () => void;
  hasRecording: boolean;
}

export function VoiceRecorder({
  onRecordingComplete,
  onClear,
  hasRecording,
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>(
    hasRecording ? "recorded" : "idle",
  );
  const [seconds, setSeconds] = useState(0);
  const [supported, setSupported] = useState(true);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setSupported(false);
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioUrlRef.current = URL.createObjectURL(blob);
        onRecordingComplete(blob);
        setState("recorded");
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setState("recording");
      setSeconds(0);

      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s >= 119) {
            mr.stop();
            if (timerRef.current) clearInterval(timerRef.current);
            return s + 1;
          }
          return s + 1;
        });
      }, 1000);
    } catch {
      setSupported(false);
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const resetRecording = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    setSeconds(0);
    setState("idle");
    onClear();
  }, [onClear]);

  const playRecording = useCallback(() => {
    if (!audioUrlRef.current) return;
    if (audioRef.current) audioRef.current.pause();
    const a = new Audio(audioUrlRef.current);
    audioRef.current = a;
    a.play();
  }, []);

  const fmtTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!supported) return null;

  return (
    <div className="flex items-center gap-2">
      {state === "idle" && (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
          title="Записать голос"
        >
          <Mic className="h-4 w-4" />
          <span>Голос</span>
        </button>
      )}

      {state === "recording" && (
        <>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-red-500" />
            </span>
            <span className="text-sm font-mono text-red-600">
              {fmtTime(seconds)}
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            className="flex items-center gap-1.5 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-100 transition-colors"
          >
            <Square className="h-3 w-3 fill-current" />
            <span>Стоп</span>
          </button>
        </>
      )}

      {state === "recorded" && (
        <>
          <button
            type="button"
            onClick={playRecording}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors",
              "border-staleks-lime/30 bg-staleks-lime/10 text-gray-700 hover:bg-staleks-lime/20",
            )}
          >
            <Play className="h-3.5 w-3.5" />
            <span>{fmtTime(seconds)}</span>
          </button>
          <button
            type="button"
            onClick={resetRecording}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600"
            title="Перезаписать"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  );
}
