/**
 * Web Speech API helpers — wrapped in typed hooks so every component that
 * wants Jarvis-style voice input/output can share the same plumbing.
 *
 * Recognition: browser's SpeechRecognition (webkit prefix on Chrome/Safari).
 * Synthesis:   browser's SpeechSynthesis (speechSynthesis global).
 *
 * Both are available on all modern Chromium browsers and iOS Safari.
 * Firefox has SpeechSynthesis but NOT SpeechRecognition — we gracefully
 * degrade when unavailable (the mic button simply doesn't render).
 */

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Browser types aren't in the default TS lib — narrow manually.
type SRConstructor = new () => any;

function getSpeechRecognition(): SRConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function useVoiceRecognition(opts?: {
  onFinalResult?: (text: string) => void;
  continuous?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SR = getSpeechRecognition();
    setSupported(!!SR);
    if (!SR) return;
    const rec = new SR();
    rec.continuous = opts?.continuous ?? false;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) final += res[0].transcript;
        else interim += res[0].transcript;
      }
      setTranscript((final || interim).trim());
      if (final && opts?.onFinalResult) opts.onFinalResult(final.trim());
    };

    rec.onerror = (e: any) => {
      setError(e.error || 'recognition error');
      setListening(false);
    };
    rec.onend = () => setListening(false);

    recognitionRef.current = rec;
    return () => {
      try { rec.stop(); } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setError(null);
    setTranscript('');
    try {
      rec.start();
      setListening(true);
    } catch (e: any) {
      // Already running — just flag it as listening.
      setListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
  }, []);

  return { supported, listening, transcript, error, start, stop };
}

/**
 * Pick the best available female English voice with a JARVIS-cool, neural feel.
 * Prefers Apple/Microsoft/Google neural voices over old Festival/eSpeak ones.
 * Priority: premium neural women → enhanced → regular known-female → any en-US/en-GB.
 */
function pickMotherNatureVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices.length) return undefined;

  // Top tier — neural / premium / online voices (smoothest, most natural).
  const NEURAL = [
    // Microsoft Edge / Chromium on Windows — these are the best-sounding web voices, period.
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Emma Online (Natural) - English (United States)',
    'Microsoft Libby Online (Natural) - English (United Kingdom)',
    'Microsoft Sonia Online (Natural) - English (United Kingdom)',
    'Microsoft Ava Online (Natural) - English (United States)',
    'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
    'Microsoft Emma Online (Natural)', 'Microsoft Libby Online (Natural)',
    'Microsoft Sonia Online (Natural)', 'Microsoft Ava Online (Natural)',
    // macOS premium / enhanced (downloadable via System Settings → Accessibility → Spoken Content)
    'Ava (Premium)', 'Ava (Enhanced)',
    'Samantha (Premium)', 'Samantha (Enhanced)',
    'Allison (Premium)', 'Allison (Enhanced)',
    'Zoe (Premium)', 'Zoe (Enhanced)',
    // Google Chrome — these are WaveNet-ish on most builds
    'Google UK English Female',
  ];
  for (const name of NEURAL) {
    const found = voices.find((v) => v.name === name);
    if (found) return found;
  }

  // Second tier — regular high-quality female voices baked into the OS.
  const STANDARD = [
    'Samantha',                                  // macOS / iOS default female — warm, confident
    'Ava', 'Allison', 'Zoe',
    'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Emma', 'Microsoft Libby',
    'Microsoft Sonia', 'Microsoft Zira',
    'Karen', 'Serena', 'Tessa', 'Moira', 'Fiona', 'Victoria', 'Kathy',
  ];
  for (const name of STANDARD) {
    const found = voices.find((v) => v.name === name);
    if (found) return found;
  }

  // Fallback: anything whose name contains a known female marker.
  const femaleByName = voices.find(
    (v) => /female|woman|samantha|ava|allison|aria|jenny|emma|libby|sonia|zira|karen|serena|tessa|moira|fiona|victoria|kathy|zoe/i.test(v.name),
  );
  if (femaleByName) return femaleByName;

  return (
    voices.find((v) => /en-GB/.test(v.lang)) ||
    voices.find((v) => /en-US/.test(v.lang)) ||
    voices[0]
  );
}

/**
 * Speak a string out loud. Cancels any queued utterance first.
 * Defaults tuned for a JARVIS-style "cool" feminine read:
 *   rate 0.95 — calm, measured
 *   pitch 0.95 — lower, more confident than the stock bubbly default
 */
export function speak(text: string, opts?: { rate?: number; pitch?: number; voiceName?: string }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 0.95;
  u.pitch = opts?.pitch ?? 0.95;
  u.volume = 1;
  const voices = synth.getVoices();
  const override = opts?.voiceName ? voices.find((v) => v.name === opts.voiceName) : undefined;
  const voice = override || pickMotherNatureVoice(voices);
  if (voice) u.voice = voice;
  // Some browsers load voices asynchronously — retry once if the list was empty.
  if (!voices.length) {
    synth.onvoiceschanged = () => {
      const later = pickMotherNatureVoice(synth.getVoices());
      if (later) u.voice = later;
      synth.speak(u);
      synth.onvoiceschanged = null;
    };
    return;
  }
  synth.speak(u);
}

export function cancelSpeak() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
}
