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

  // Top tier — cloud-streamed neural voices with the clearest pronunciation.
  // Flo (macOS Accessibility novelty voice, downloadable) goes first because
  // the user explicitly prefers it. Falls through if not installed.
  const NEURAL = [
    'Flo (Premium)', 'Flo (Enhanced)', 'Flo',
    'Google US English',                         // Chrome default, very clean female delivery
    'Google UK English Female',
    // Microsoft Edge cloud voices (Windows)
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Emma Online (Natural) - English (United States)',
    'Microsoft Libby Online (Natural) - English (United Kingdom)',
    'Microsoft Sonia Online (Natural) - English (United Kingdom)',
    'Microsoft Ava Online (Natural) - English (United States)',
    'Microsoft Aria Online (Natural)', 'Microsoft Jenny Online (Natural)',
    'Microsoft Emma Online (Natural)', 'Microsoft Libby Online (Natural)',
    'Microsoft Sonia Online (Natural)', 'Microsoft Ava Online (Natural)',
    // macOS premium / enhanced (downloadable)
    'Ava (Premium)', 'Ava (Enhanced)',
    'Allison (Premium)', 'Allison (Enhanced)',
    'Samantha (Premium)', 'Samantha (Enhanced)',
    'Zoe (Premium)', 'Zoe (Enhanced)',
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
 * Display sanitizer — strip markdown noise + emojis but KEEP parenthetical
 * content. Pronunciation hints like "Xin chào (sin chow)" stay visible on
 * screen so the learner can read them.
 */
export function sanitizeForDisplay(input: string): string {
  if (!input) return '';
  let s = String(input);
  s = s.replace(/```[\s\S]*?```/g, ' ');
  s = s.replace(/[*_`~#>]/g, '');
  s = s.replace(
    /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2300-\u23FF\u2600-\u26FF\u2700-\u27BF\u2B00-\u2BFF\uFE0F\u200D]/g,
    '',
  );
  s = s.replace(/[\uD800-\uDFFF]/g, '');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Speech sanitizer — everything `sanitizeForDisplay` removes, PLUS:
 *  - Anything inside parentheses, brackets, or curly braces.
 *    These are usually pronunciation hints, asides, or stage directions
 *    — speaking them out loud sounds awful and makes a tutor say a foreign
 *    word twice (once in the source language, again in butchered English).
 *
 * So "Xin chào (sin chow) — hello" is read as "Xin chào — hello", not
 * "Xin chào sin chow hello".
 */
export function sanitizeForSpeech(input: string): string {
  if (!input) return '';
  let s = sanitizeForDisplay(input);
  // Strip parens / brackets / braces and their contents (non-greedy).
  s = s.replace(/\([^)]*\)/g, '');
  s = s.replace(/\[[^\]]*\]/g, '');
  s = s.replace(/\{[^}]*\}/g, '');
  // Clean up any leftover double spaces or stranded punctuation pairs.
  s = s.replace(/\s+([.,!?;:])/g, '$1');
  s = s.replace(/—\s*—/g, '—');
  return s.replace(/\s+/g, ' ').trim();
}

/**
 * Pick a native voice for a BCP-47 lang prefix ('es', 'vi', etc.).
 * Returns undefined when no matching voice is installed.
 */
function pickLangVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  if (!voices.length || !lang) return undefined;
  const prefix = lang.toLowerCase().split('-')[0];
  const matches = voices.filter((v) => v.lang.toLowerCase().startsWith(prefix));
  if (!matches.length) return undefined;
  // Prefer female voices in that language.
  const female = matches.find(
    (v) => /female|woman|paulina|monica|isabela|catalina|marisol|esperanza|sofia|gabriela|linh|huong|hoai|ngoc/i.test(v.name),
  );
  return female || matches[0];
}

/**
 * Speak a string out loud. Cancels any queued utterance first.
 * Automatically strips asterisks, emojis, markdown, and parens so the
 * voice doesn't read pronunciation hints out loud.
 *
 * Pass `lang` (e.g. 'es-ES', 'vi-VN') to use a native speaker of that
 * language — used by the Spanish + Vietnamese tutors so words sound
 * authentic. Without `lang`, falls back to the Mother Nature picker so
 * every other agent shares one consistent voice.
 *
 * Also dispatches `mn-speech-start` and `mn-speech-end` window events so
 * the floating globe (JarvisFab) can animate in sync with any audio that
 * plays anywhere in the app.
 */
export function speak(text: string, opts?: { rate?: number; pitch?: number; voiceName?: string; lang?: string }) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const clean = sanitizeForSpeech(text);
  if (!clean) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(clean);
  u.rate = opts?.rate ?? 1.0;
  u.pitch = opts?.pitch ?? 1.0;
  u.volume = 1;
  if (opts?.lang) u.lang = opts.lang;

  function pickVoice(list: SpeechSynthesisVoice[]) {
    if (opts?.voiceName) {
      const named = list.find((v) => v.name === opts.voiceName);
      if (named) return named;
    }
    if (opts?.lang) {
      const langVoice = pickLangVoice(list, opts.lang);
      if (langVoice) return langVoice;
    }
    return pickMotherNatureVoice(list);
  }

  // Animation hooks — let the globe (or any other listener) react.
  u.onstart = () => {
    try { window.dispatchEvent(new CustomEvent('mn-speech-start', { detail: { text: clean } })); } catch {}
  };
  u.onend = u.onerror = () => {
    try { window.dispatchEvent(new CustomEvent('mn-speech-end')); } catch {}
  };

  const voices = synth.getVoices();
  const voice = pickVoice(voices);
  if (voice) u.voice = voice;
  if (!voices.length) {
    synth.onvoiceschanged = () => {
      const later = pickVoice(synth.getVoices());
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
