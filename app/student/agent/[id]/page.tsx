'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { getStudentAgent, STUDENT_THEMES, getStudentByEmail, STUDENTS } from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function StudentAgentChat() {
  const params = useParams<{ id: string }>();
  const agent = getStudentAgent(params.id);
  const [student, setStudent] = useState(STUDENTS[0]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Hmm, something went wrong. Try again? (${e.message})` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen text-white flex flex-col" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <div className="max-w-[820px] w-full mx-auto px-4 md:px-6 py-5 flex flex-col flex-1 gap-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            My Buddies
          </Link>
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
              <div
                key={i}
                className={`rounded-2xl px-4 py-2.5 max-w-[85%] text-[13px] whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user' ? 'self-end text-white' : 'self-start text-white/95'
                }`}
                style={
                  m.role === 'user'
                    ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }
                    : { background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)' }
                }
              >
                {m.content}
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
            className="flex gap-2 p-3 border-t border-white/10"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask ${agent.name} anything…`}
              className="flex-1 rounded-xl px-4 py-2.5 bg-white/8 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30 text-[13px]"
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
