'use client';

/**
 * Cute kid journal — Marissa, Kyle, or whoever's logged in as a student.
 *
 * Features:
 *  - Lock screen if a passcode is set (kid can set it themselves)
 *  - Mood emoji selector + title + body
 *  - Filter: My Entries · Notes from Mom · All
 *  - Per-entry sharing: Just Me · Mom · AI · Both — controls who sees it
 *  - "Talk to AI about this" button when entry is shared with AI
 *  - Mom and MNA staff land on the kid's journal but only see entries
 *    with shared='mom' or 'both' (unless they enter the passcode)
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  getStudentByEmail,
  STUDENTS,
  STUDENT_THEMES,
  type Student,
} from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';
import JarvisFab from '@/components/ai/JarvisFab';
import { speak, sanitizeForDisplay } from '@/lib/voice';

type Entry = {
  id: string;
  owner_email: string;
  author: 'kid' | 'mom';
  title: string | null;
  body: string;
  mood: string | null;
  shared: 'none' | 'mom' | 'ai' | 'both';
  created_at: string;
};

type Tab = 'mine' | 'mom' | 'all';

const MOODS = [
  { e: '😊', l: 'Good' },
  { e: '🤩', l: 'Amazing' },
  { e: '😴', l: 'Tired' },
  { e: '😤', l: 'Frustrated' },
  { e: '😢', l: 'Sad' },
  { e: '🤔', l: 'Thinking' },
  { e: '🎉', l: 'Celebrating' },
  { e: '😎', l: 'Cool' },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function JournalPage() {
  const [me, setMe] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [hasCode, setHasCode] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [codeInput, setCodeInput] = useState('');
  const [codeStored, setCodeStored] = useState('');
  const [showSetCode, setShowSetCode] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [tab, setTab] = useState<Tab>('all');

  // New-entry form
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [mood, setMood] = useState('');
  const [shared, setShared] = useState<Entry['shared']>('none');
  const [busy, setBusy] = useState(false);

  // AI chat for an entry
  const [aiOpen, setAiOpen] = useState<Entry | null>(null);
  const [aiInput, setAiInput] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiReply, setAiReply] = useState('');

  // Load auth + student
  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setMe(userEmail);
      const s = getStudentByEmail(userEmail);
      if (s) setStudent(s);
      else if (isMNAStaff(userEmail)) {
        setPreviewMode(true);
        setStudent(STUDENTS[0]);
      }
    })();
  }, []);

  async function load(code?: string) {
    if (!student) return;
    const headers: Record<string, string> = {};
    if (code) headers['x-journal-code'] = code;
    const r = await fetch(`/api/journal?ownerEmail=${encodeURIComponent(student.email)}`, { headers });
    const d = await r.json();
    setEntries(d.entries || []);
    setHasCode(!!d.hasCode);
    setUnlocked(!!d.unlocked);
  }

  useEffect(() => { if (student) load(); }, [student]);

  const isOwner = me.toLowerCase() === student?.email.toLowerCase();

  async function setPasscode() {
    if (!student || !newCode.trim()) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: student.email, key: 'journal_code', value: newCode.trim() }),
    });
    setHasCode(true);
    setShowSetCode(false);
    setNewCode('');
  }

  async function clearPasscode() {
    if (!student) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: student.email, key: 'journal_code', value: null }),
    });
    setHasCode(false);
    setUnlocked(true);
  }

  async function tryUnlock() {
    if (!codeInput.trim()) return;
    setCodeStored(codeInput.trim());
    await load(codeInput.trim());
    setCodeInput('');
  }

  async function addEntry() {
    if (!student || !body.trim()) return;
    setBusy(true);
    try {
      const r = await fetch('/api/journal', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ownerEmail: student.email,
          author: previewMode && !isOwner ? 'mom' : (isOwner ? 'kid' : 'mom'),
          title: title.trim() || undefined,
          body: body.trim(),
          mood: mood || undefined,
          shared,
        }),
      });
      const d = await r.json();
      if (r.ok && d.entry) {
        setEntries((prev) => [d.entry, ...prev]);
        setBody(''); setTitle(''); setMood(''); setShared('none');
      }
    } finally { setBusy(false); }
  }

  async function deleteEntry(id: string) {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    await fetch(`/api/journal?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  async function askAI(entry: Entry) {
    if (!aiInput.trim()) return;
    setAiBusy(true); setAiReply('');
    try {
      const sys = `You are a kind, encouraging buddy talking with a child about their journal entry. Keep replies short, warm, and supportive. Never give medical or unsafe advice. If they share something serious or sad, gently suggest talking to a parent.`;
      const userMsg = `My journal entry:\n\n${entry.title ? entry.title + '\n' : ''}${entry.body}\n\n${entry.mood ? `I felt: ${entry.mood}\n\n` : ''}My question for you: ${aiInput.trim()}`;
      const r = await fetch('/api/student-agent/study-buddy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `${sys}\n\n${userMsg}` }],
        }),
      });
      const d = await r.json();
      if (r.ok && d.reply) {
        const cleaned = sanitizeForDisplay(d.reply);
        setAiReply(cleaned);
        speak(cleaned, { rate: 1.0, pitch: 1.05 });
      }
    } finally { setAiBusy(false); }
  }

  if (!student) {
    return <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">Loading…</div>;
  }
  const theme = STUDENT_THEMES[student.themeColor];

  // Lock screen — owner has a passcode set and hasn't unlocked yet
  if (isOwner && hasCode && !unlocked) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center p-6 relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
        <JarvisFab />
        <div className="max-w-sm w-full glass-card p-6 text-center">
          <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-3" style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
            <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>lock</span>
          </div>
          <h1 className="text-[20px] font-extrabold">Your secret journal</h1>
          <p className="text-[12px] text-white/65 mt-1 mb-4">Type your code to unlock 🔐</p>
          <input
            type="password"
            autoFocus
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') tryUnlock(); }}
            className="w-full px-4 py-3 rounded-xl border text-white text-center text-[18px] tracking-widest focus:outline-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
            placeholder="••••"
          />
          <button
            onClick={tryUnlock}
            disabled={!codeInput.trim()}
            className="mt-3 w-full text-[13px] font-bold px-4 py-2.5 rounded-xl text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
          >
            Unlock
          </button>
          <Link href="/student" className="text-[11px] text-white/50 hover:text-white/80 mt-3 inline-block">
            ← Back home
          </Link>
        </div>
      </div>
    );
  }

  // Tab filter
  const filtered = entries.filter((e) => {
    if (tab === 'mine') return e.author === 'kid';
    if (tab === 'mom') return e.author === 'mom';
    return true;
  });

  return (
    <div className="min-h-screen text-white relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <JarvisFab />
      <div className="max-w-[820px] mx-auto px-4 md:px-6 py-6 md:py-10 space-y-6">

        {previewMode && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap" style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 text-[12px] text-white/70">
              Staff Preview · viewing {student.firstName}'s journal. Mom-shared entries only unless you have her code.
            </div>
            <div className="flex gap-1">
              {STUDENTS.map((s) => (
                <button key={s.email} onClick={() => setStudent(s)}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition ${student.email === s.email ? 'text-white' : 'text-white/65 hover:text-white bg-white/10'}`}
                  style={student.email === s.email ? { background: `linear-gradient(135deg,${STUDENT_THEMES[s.themeColor].gradientFrom},${STUDENT_THEMES[s.themeColor].gradientTo})` } : {}}>
                  {s.firstName}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Home
          </Link>
          <div className="flex-1" />
          {isOwner && (
            hasCode ? (
              <button onClick={clearPasscode} className="text-[10px] text-white/55 hover:text-white">
                🔓 Remove code
              </button>
            ) : (
              <button onClick={() => setShowSetCode(true)} className="text-[10px] font-semibold text-white/70 hover:text-white">
                🔒 Set a secret code
              </button>
            )
          )}
        </div>

        <div>
          <h1 className="text-[34px] font-extrabold leading-none">
            {student.firstName}'s Journal <span style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>📖</span>
          </h1>
          <p className="text-[12px] text-white/65 mt-1">
            Write about today, document what you remember, share with mom or just keep it private.
          </p>
        </div>

        {/* Set code dialog */}
        {showSetCode && (
          <div className="glass-card p-4">
            <div className="text-[13px] font-bold mb-2">Pick a secret code 🔐</div>
            <p className="text-[11px] text-white/65 mb-3">Anything you'll remember — letters, numbers, or both. Mom can also enter it to read your private entries if you forget.</p>
            <div className="flex gap-2">
              <input
                type="password"
                autoFocus
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') setPasscode(); }}
                className="flex-1 px-3 py-2 rounded-lg border text-white text-[13px] focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                placeholder="Your secret code"
              />
              <button onClick={setPasscode} disabled={!newCode.trim()}
                className="text-[12px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
                Save Code
              </button>
              <button onClick={() => setShowSetCode(false)} className="text-[12px] font-semibold px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* New entry form */}
        <div className="glass-card p-5">
          <div className="text-[14px] font-bold mb-3">
            {previewMode || !isOwner ? '✏️ Write a note to ' + student.firstName : '✏️ Write today\'s entry'}
          </div>
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border text-white text-[14px] placeholder:text-white/45 focus:outline-none mb-2"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          <textarea
            placeholder="What happened today? What are you thinking about?"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            className="w-full px-3 py-2.5 rounded-lg border text-white text-[14px] placeholder:text-white/45 focus:outline-none mb-2 resize-none"
            style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
          />
          {/* Mood picker */}
          <div className="flex flex-wrap items-center gap-1 mb-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/55 mr-1">Mood:</span>
            {MOODS.map((m) => (
              <button
                key={m.e}
                onClick={() => setMood(mood === m.e ? '' : m.e)}
                className={`text-[18px] px-2 py-1 rounded-lg transition ${mood === m.e ? 'scale-110' : 'opacity-60 hover:opacity-100'}`}
                style={mood === m.e ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` } : {}}
                title={m.l}
              >
                {m.e}
              </button>
            ))}
          </div>
          {/* Share picker */}
          <div className="flex items-center gap-1 flex-wrap mb-3">
            <span className="text-[10px] uppercase tracking-wider font-bold text-white/55 mr-1">Share with:</span>
            {([
              { v: 'none', l: '🔒 Just me' },
              { v: 'mom',  l: '💜 Mom' },
              { v: 'ai',   l: '✨ AI' },
              { v: 'both', l: '💜✨ Mom + AI' },
            ] as { v: Entry['shared']; l: string }[]).map((s) => (
              <button
                key={s.v}
                onClick={() => setShared(s.v)}
                className={`text-[11px] font-semibold px-2.5 py-1 rounded-full transition`}
                style={shared === s.v
                  ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`, color: '#fff' }
                  : { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.65)', border: `1px solid ${theme.chipBorder}` }}
              >
                {s.l}
              </button>
            ))}
          </div>
          <button
            onClick={addEntry}
            disabled={busy || !body.trim()}
            className="text-[13px] font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50"
            style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
          >
            {busy ? 'Saving…' : '📔 Add to Journal'}
          </button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1">
          {([
            { v: 'all',  l: 'Everything' },
            { v: 'mine', l: 'My Entries' },
            { v: 'mom',  l: 'Notes from Mom' },
          ] as { v: Tab; l: string }[]).map((t) => (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition ${tab === t.v ? 'text-white' : 'text-white/60 hover:text-white/90'}`}
              style={tab === t.v
                ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }
                : { background: 'rgba(255,255,255,0.04)', border: `1px solid ${theme.chipBorder}` }}
            >
              {t.l}
            </button>
          ))}
        </div>

        {/* Entries */}
        {filtered.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <span className="material-symbols-outlined inline-block mb-2" style={{ fontSize: 40, color: theme.accent, opacity: 0.5 }}>auto_stories</span>
            <div className="text-[13px] font-semibold">No entries yet</div>
            <p className="text-[11px] text-white/55 mt-1">Write your first one above 💜</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((e) => (
              <li key={e.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {e.author === 'mom' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: 'linear-gradient(135deg,#ec4899,#f472b6)' }}>
                        💜 From Mom
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
                        ✏️ {student.firstName}
                      </span>
                    )}
                    {e.mood && <span className="text-[18px]">{e.mood}</span>}
                    <span className="text-[10px] text-white/45">{fmtDate(e.created_at)}</span>
                  </div>
                  <button onClick={() => deleteEntry(e.id)} className="text-white/30 hover:text-rose-400 shrink-0" title="Delete">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
                {e.title && <div className="text-[14px] font-bold text-white mb-1">{e.title}</div>}
                <div className="text-[13px] text-white/85 leading-relaxed whitespace-pre-wrap">{e.body}</div>
                <div className="flex items-center gap-2 mt-3 flex-wrap">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-white/45">Shared:</span>
                  <span className="text-[10px] text-white/65">
                    {e.shared === 'none' ? '🔒 Just me'
                      : e.shared === 'mom' ? '💜 Mom can see'
                      : e.shared === 'ai' ? '✨ AI can see'
                      : '💜✨ Mom + AI can see'}
                  </span>
                  {(e.shared === 'ai' || e.shared === 'both') && (
                    <button
                      onClick={() => { setAiOpen(e); setAiInput(''); setAiReply(''); }}
                      className="ml-auto text-[10px] font-bold px-2.5 py-1 rounded-md text-white"
                      style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
                    >
                      ✨ Talk to AI about this
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* AI dialog */}
        {aiOpen && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={() => setAiOpen(null)}>
            <div className="max-w-md w-full glass-card p-5" onClick={(e) => e.stopPropagation()}>
              <div className="text-[14px] font-bold mb-1">✨ Talk about this entry</div>
              <p className="text-[11px] text-white/65 mb-3">The AI buddy will read your entry and chat about it. Ask anything.</p>
              <input
                autoFocus
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') askAI(aiOpen!); }}
                placeholder="What do you want to ask?"
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/45 focus:outline-none mb-2"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              {aiReply && (
                <div className="rounded-lg p-3 mb-3 text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap"
                     style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.chipBorder}` }}>
                  {aiReply}
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setAiOpen(null)} className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20">
                  Close
                </button>
                <button onClick={() => askAI(aiOpen!)} disabled={aiBusy || !aiInput.trim()}
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
                  {aiBusy ? 'Thinking…' : 'Ask'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
