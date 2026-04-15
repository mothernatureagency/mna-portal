'use client';

/**
 * Floating "Jarvis" mic — lives in the bottom-right of every page.
 *
 * Tap once → listens. Say a command. When the transcript is final it posts
 * to /api/assistant (the existing AI assistant endpoint) and speaks back
 * the reply. Also recognises a few fast-path navigation phrases ("open
 * content calendar", "go to tasks") and routes with next/router instead of
 * bothering the LLM.
 */

import React, { useCallback, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useVoiceRecognition, speak, cancelSpeak } from '@/lib/voice';

// Quick nav phrases → paths. Prefixed with a verb so they don't collide with chatter.
const NAV_PHRASES: { match: RegExp; path: string; label: string }[] = [
  { match: /open (?:the )?content calendar|show (?:me )?content/i, path: '/content-calendar', label: 'content calendar' },
  { match: /open (?:the )?task(?:s| manager)|show (?:me )?(?:my )?tasks/i, path: '/client-tasks', label: 'tasks' },
  { match: /open (?:the )?(?:client )?portal|show (?:me )?(?:the )?dashboard/i, path: '/', label: 'dashboard' },
  { match: /open (?:the )?pipeline|show (?:me )?crm/i, path: '/pipeline', label: 'pipeline' },
  { match: /open (?:the )?email (?:preview|drafts?)/i, path: '/email-preview', label: 'email preview' },
  { match: /open (?:the )?(?:meta )?ads?|show (?:me )?ads?/i, path: '/meta-ads-live', label: 'meta ads' },
  { match: /open (?:the )?ai (?:agents?|assistant)|talk to (?:the )?assistant/i, path: '/agents/ai', label: 'AI agents' },
];

export default function JarvisFab() {
  const router = useRouter();
  const pathname = usePathname();
  const [busy, setBusy] = useState(false);
  const [lastReply, setLastReply] = useState<string>('');
  const lastTranscriptRef = useRef<string>('');

  const handleFinal = useCallback(async (text: string) => {
    if (!text) return;
    lastTranscriptRef.current = text;

    // Fast path: navigation phrases
    const nav = NAV_PHRASES.find((n) => n.match.test(text));
    if (nav) {
      speak(`Opening ${nav.label}.`);
      router.push(nav.path);
      return;
    }

    // Otherwise, treat as a question for the assistant.
    setBusy(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: text }],
          context: { page: pathname || '/' },
        }),
      });
      const data = await res.json();
      const reply = data?.reply || data?.message || data?.content || '';
      if (reply) {
        setLastReply(reply);
        const spoken = String(reply).replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
        if (spoken) speak(spoken);
      } else {
        speak("I didn't catch that. Try again?");
      }
    } catch {
      speak('Something went wrong reaching the assistant.');
    } finally {
      setBusy(false);
    }
  }, [pathname, router]);

  const { supported, listening, transcript, start, stop } = useVoiceRecognition({ onFinalResult: handleFinal });

  // Don't render on login / public-only routes
  const hidden = pathname?.startsWith('/login') || pathname?.startsWith('/book') || pathname?.startsWith('/reset-password');
  if (hidden || !supported) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {lastReply && !listening && (
        <div className="glass-card max-w-sm p-3 text-sm text-white/90 shadow-xl">
          <div className="text-[10px] uppercase tracking-wider text-white/50 mb-1">Nature Assistant</div>
          {lastReply.length > 220 ? `${lastReply.slice(0, 220)}…` : lastReply}
          <button
            onClick={() => { cancelSpeak(); setLastReply(''); }}
            className="ml-2 text-white/40 hover:text-white/80 text-xs"
          >dismiss</button>
        </div>
      )}
      {listening && transcript && (
        <div className="glass-card max-w-sm p-2.5 text-xs text-white/80">
          {transcript}
        </div>
      )}
      <button
        type="button"
        onClick={() => (listening ? stop() : (cancelSpeak(), start()))}
        disabled={busy}
        title={listening ? 'Stop listening' : 'Talk to your assistant'}
        className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition
          ${listening ? 'bg-rose-500 text-white' : busy ? 'bg-amber-500 text-white' : 'text-white'}
        `}
        style={
          !listening && !busy
            ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }
            : undefined
        }
      >
        <span className="material-symbols-outlined" style={{ fontSize: 26 }}>
          {busy ? 'autorenew' : listening ? 'mic' : 'graphic_eq'}
        </span>
        {listening && <span className="absolute inset-0 rounded-full animate-ping bg-rose-500/40" />}
      </button>
    </div>
  );
}
