'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { getStudentAgent, STUDENT_THEMES, getStudentByEmail, STUDENTS } from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';
import { VoiceButton } from '@/components/ai/VoiceButton';
import { speak, cancelSpeak, sanitizeForDisplay } from '@/lib/voice';
import JarvisFab from '@/components/ai/JarvisFab';
import { uid, type Flashcard, type MemoryItem } from '@/lib/student-memory';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function StudentAgentChat() {
  const params = useParams<{ id: string }>();
  const agent = getStudentAgent(params.id);
  const [student, setStudent] = useState(STUDENTS[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);   // auto-speak tutor replies (on by default for kids)
  const voicePendingRef = useRef(false);          // did Marissa ask by voice?
  const scrollRef = useRef<HTMLDivElement>(null);
  const [savedToast, setSavedToast] = useState<string>('');

  // ── Persistence helpers (all keyed off the student's email) ──
  async function saveKV(key: string, value: any) {
    if (!student?.email) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: student.email, key, value }),
    }).catch(() => {});
  }
  async function loadKV<T = any>(key: string): Promise<T[]> {
    if (!student?.email) return [];
    try {
      const r = await fetch(`/api/client-kv?clientId=${encodeURIComponent(student.email)}&key=${key}`);
      const d = await r.json();
      return Array.isArray(d.value) ? d.value : [];
    } catch { return []; }
  }

  function flashToast(msg: string) {
    setSavedToast(msg);
    setTimeout(() => setSavedToast(''), 2500);
  }

  async function saveAsFlashcard(text: string) {
    flashToast('Making a flashcard…');
    try {
      const r = await fetch('/api/student-memory/extract-card', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, subject: agent?.role || 'General' }),
      });
      const data = await r.json();
      if (!data.question || !data.answer) {
        flashToast('Couldn\'t make a card from that — try a different reply.');
        return;
      }
      const card: Flashcard = {
        id: uid(),
        question: data.question,
        answer: data.answer,
        subject: data.subject || agent?.role || 'General',
        source: agent?.id,
        reviewedCount: 0,
        knownCount: 0,
        createdAt: new Date().toISOString(),
      };
      const existing = await loadKV<Flashcard>('flashcards');
      await saveKV('flashcards', [card, ...existing]);
      flashToast(`✓ Saved flashcard (${existing.length + 1} total)`);
    } catch {
      flashToast('Couldn\'t save that card.');
    }
  }

  async function saveToMemory(text: string) {
    const item: MemoryItem = {
      id: uid(),
      title: text.slice(0, 60).trim() + (text.length > 60 ? '…' : ''),
      body: text,
      subject: agent?.role,
      source: agent?.id,
      tags: [],
      createdAt: new Date().toISOString(),
    };
    const existing = await loadKV<MemoryItem>('memory');
    await saveKV('memory', [item, ...existing]);
    flashToast(`✓ Saved to memory (${existing.length + 1} total)`);
  }

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const s = getStudentByEmail(userEmail);
      if (s) { setStudent(s); return; }
      // Staff preview falls back to the first student in the directory.
      if (isMNAStaff(userEmail) && STUDENTS[0]) setStudent(STUDENTS[0]);
    })();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  // Stop any ongoing speech when leaving the page (so the tutor doesn't
  // keep talking after Marissa navigates back to the buddy grid).
  useEffect(() => () => { cancelSpeak(); }, []);

  if (!agent) return notFound();
  const theme = STUDENT_THEMES[student.themeColor];

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`/api/student-agent/${agent!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      // Display: keep pronunciation hints in parens visible on screen so
      // Marissa can read them. Speech: speak() internally strips parens
      // so the tutor doesn't pronounce the English approximation aloud.
      const displayed = sanitizeForDisplay(data.reply);
      setMessages((m) => [...m, { role: 'assistant', content: displayed }]);
      if (voiceOn && data.reply) {
        // Use the same Mother Nature voice as the floating assistant for
        // every tutor — except language tutors (es / vi) which switch to
        // a native voice so the words sound authentic.
        speak(data.reply, agent!.voiceLang ? { lang: agent!.voiceLang } : undefined);
      }
      voicePendingRef.current = false;
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Hmm, something went wrong. Try again? (${e.message})` }]);
      voicePendingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  // Called by the mic button when Marissa finishes speaking.
  function handleVoiceInput(text: string) {
    voicePendingRef.current = true;
    send(text);
  }

  return (
    <div className="min-h-screen text-white flex flex-col relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      {/* Mother Nature floating globe — available on every tutor page */}
      <JarvisFab />
      {/* Save toast */}
      {savedToast && (
        <div
          className="fixed top-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-white text-[12px] font-semibold shadow-2xl"
          style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
        >
          {savedToast}
        </div>
      )}
      <div className="max-w-[820px] w-full mx-auto px-4 md:px-6 py-5 flex flex-col flex-1 gap-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            My Buddies
          </Link>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => { setVoiceOn((v) => !v); if (voiceOn) cancelSpeak(); }}
            title={voiceOn ? 'Voice on — click to mute' : 'Voice off — click to enable'}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold flex items-center gap-1.5 border transition ${
              voiceOn
                ? 'text-emerald-200'
                : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
            }`}
            style={voiceOn ? { background: 'rgba(16,185,129,0.18)', borderColor: 'rgba(110,231,183,0.4)' } : undefined}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
              {voiceOn ? 'volume_up' : 'volume_off'}
            </span>
            Voice {voiceOn ? 'on' : 'off'}
          </button>
        </div>

        {/* ── Agent card ── */}
        <div
          className="rounded-2xl p-4 flex items-center gap-4"
          style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}
        >
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 28 }}>{agent.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[18px] font-extrabold">{agent.name}</div>
            <div className="text-[12px] uppercase tracking-wider font-semibold" style={{ color: theme.accent }}>
              {agent.role}
            </div>
            <div className="text-[12px] text-white/70 mt-0.5">{agent.tagline}</div>
          </div>
        </div>

        {/* ── Chat ── */}
        <div className="flex-1 flex flex-col rounded-2xl min-h-[400px]" style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <div className="text-[12px] text-white/65 mb-1">Try asking:</div>
                {agent.suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left rounded-xl px-4 py-2.5 text-[13px] text-white/90 transition hover:scale-[1.01]"
                    style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} max-w-[85%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
                <div
                  className={`rounded-2xl px-4 py-2.5 text-[13px] whitespace-pre-wrap leading-relaxed ${
                    m.role === 'user' ? 'text-white' : 'text-white/95'
                  }`}
                  style={
                    m.role === 'user'
                      ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }
                      : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }
                  }
                >
                  {m.content}
                </div>
                {m.role === 'assistant' && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <button
                      onClick={() => saveAsFlashcard(m.content)}
                      className="text-[10px] font-bold px-2 py-1 rounded-md text-white/80 hover:text-white"
                      style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${theme.chipBorder}` }}
                    >
                      <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 12 }}>style</span>
                      Save as Flashcard
                    </button>
                    <button
                      onClick={() => saveToMemory(m.content)}
                      className="text-[10px] font-bold px-2 py-1 rounded-md text-white/80 hover:text-white"
                      style={{ background: 'rgba(255,255,255,0.07)', border: `1px solid ${theme.chipBorder}` }}
                    >
                      <span className="material-symbols-outlined align-middle mr-1" style={{ fontSize: 12 }}>bookmark_add</span>
                      Save to Memory
                    </button>
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="self-start text-white/55 text-[12px] flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-white/55 animate-pulse" />
                thinking…
              </div>
            )}
          </div>

          {/* ── Input ── */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex gap-2 p-3 border-t border-white/10 items-center"
          >
            <VoiceButton onTranscript={handleVoiceInput} />
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${agent.name} or tap the mic…`}
              // Darker fill so white type stays clearly readable on every theme
              className="flex-1 rounded-xl px-4 py-2.5 border text-white placeholder:text-white/55 focus:outline-none text-[14px]"
              style={{
                background: 'rgba(0,0,0,0.45)',
                borderColor: 'rgba(255,255,255,0.25)',
                caretColor: '#fff',
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="rounded-xl px-5 font-semibold text-white text-[13px] disabled:opacity-50"
              style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
