'use client';

import React, { useEffect } from 'react';
import { useVoiceRecognition } from '@/lib/voice';

type Props = {
  /** Called once the user finishes speaking — text is the final transcript. */
  onTranscript: (text: string) => void;
  /** Auto-send when speech ends? If false, just fills the input. Default true. */
  autoSend?: boolean;
  /** Optional className override for sizing/placement. */
  className?: string;
};

/**
 * Jarvis-style mic button.
 * - Click once to start listening.
 * - Click again (or pause speaking) to stop and deliver the transcript.
 * - Renders nothing if the browser doesn't support SpeechRecognition
 *   (Firefox, older browsers), so downstream UIs can keep typed input as-is.
 */
export function VoiceButton({ onTranscript, className = '' }: Props) {
  const { supported, listening, transcript, error, start, stop } = useVoiceRecognition({
    onFinalResult: (text) => {
      if (text) onTranscript(text);
    },
  });

  // Stop the mic if the component unmounts mid-listen.
  useEffect(() => () => { if (listening) stop(); }, [listening, stop]);

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={() => (listening ? stop() : start())}
      title={listening ? 'Stop listening' : 'Start voice command'}
      className={`relative rounded-xl w-11 h-11 flex items-center justify-center transition ${
        listening
          ? 'bg-rose-500/90 text-white shadow-[0_0_20px_rgba(244,63,94,0.6)]'
          : 'bg-white/10 text-white/80 hover:bg-white/20 border border-white/15'
      } ${className}`}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 22 }}>
        {listening ? 'mic' : 'mic_none'}
      </span>
      {listening && (
        <>
          <span className="absolute inset-0 rounded-xl animate-ping bg-rose-500/30" />
          {transcript && (
            <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-white/80 bg-black/60 px-2 py-1 rounded-md max-w-[300px] truncate">
              {transcript}
            </span>
          )}
        </>
      )}
      {error && !listening && (
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] text-rose-300 bg-black/60 px-2 py-1 rounded-md">
          {error}
        </span>
      )}
    </button>
  );
}
