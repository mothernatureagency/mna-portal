'use client';

/**
 * Marissa's Study page — flashcards (with flip + self-grade) and memory.
 * Both stored in client_kv keyed off her email.
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import { getStudentByEmail, STUDENTS, STUDENT_THEMES, type Student } from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';
import JarvisFab from '@/components/ai/JarvisFab';
import type { Flashcard, MemoryItem } from '@/lib/student-memory';

type Tab = 'cards' | 'memory';

function fmtDate(d?: string) {
  if (!d) return '';
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function StudyPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [tab, setTab] = useState<Tab>('cards');
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [memory, setMemory] = useState<MemoryItem[]>([]);
  const [subject, setSubject] = useState<string>('All');

  // Practice deck state
  const [practiceIdx, setPracticeIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const s = getStudentByEmail(userEmail);
      const fetchEmail = s?.email || (isMNAStaff(userEmail) ? STUDENTS[0]?.email : '') || '';
      if (!s && isMNAStaff(userEmail)) {
        setPreviewMode(true);
        setStudent(STUDENTS[0]);
      } else {
        setStudent(s);
      }
      if (!fetchEmail) return;
      await Promise.all([
        fetch(`/api/client-kv?clientId=${encodeURIComponent(fetchEmail)}&key=flashcards`)
          .then((r) => r.json()).then((d) => {
            const raw = Array.isArray(d.value) ? d.value : [];
            // Normalize so old / partially-populated cards don't crash the UI:
            // every card must have id, question, answer, subject, and counters.
            const safe: Flashcard[] = raw
              .filter((c: any) => c && typeof c === 'object' && c.question && c.answer)
              .map((c: any) => ({
                id: String(c.id || `${Date.now()}-${Math.random()}`),
                question: String(c.question),
                answer: String(c.answer),
                subject: String(c.subject || 'General'),
                source: c.source ? String(c.source) : undefined,
                reviewedCount: Number(c.reviewedCount) || 0,
                knownCount: Number(c.knownCount) || 0,
                createdAt: String(c.createdAt || new Date().toISOString()),
                lastReviewedAt: c.lastReviewedAt ? String(c.lastReviewedAt) : undefined,
              }));
            setCards(safe);
          }).catch(() => {}),
        fetch(`/api/client-kv?clientId=${encodeURIComponent(fetchEmail)}&key=memory`)
          .then((r) => r.json()).then((d) => {
            const raw = Array.isArray(d.value) ? d.value : [];
            const safe: MemoryItem[] = raw
              .filter((m: any) => m && typeof m === 'object' && (m.body || m.title))
              .map((m: any) => ({
                id: String(m.id || `${Date.now()}-${Math.random()}`),
                title: String(m.title || (m.body || '').slice(0, 60) || 'Untitled'),
                body: String(m.body || ''),
                subject: m.subject ? String(m.subject) : undefined,
                source: m.source ? String(m.source) : undefined,
                tags: Array.isArray(m.tags) ? m.tags.map(String) : [],
                createdAt: String(m.createdAt || new Date().toISOString()),
              }));
            setMemory(safe);
          }).catch(() => {}),
      ]);
    })();
  }, []);

  if (!student) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">
        Loading…
      </div>
    );
  }
  const theme = STUDENT_THEMES[student.themeColor];

  // ── Subject filter for cards ──
  const subjects = useMemo(() => ['All', ...Array.from(new Set(cards.map((c) => c.subject))).sort()], [cards]);
  const filtered = useMemo(() => subject === 'All' ? cards : cards.filter((c) => c.subject === subject), [cards, subject]);
  // Always-safe lookup — empty filtered → no current card; out-of-bounds idx wraps.
  const currentCard: Flashcard | undefined = filtered.length > 0
    ? filtered[((practiceIdx % filtered.length) + filtered.length) % filtered.length]
    : undefined;

  async function saveCards(next: Flashcard[]) {
    setCards(next);
    if (previewMode) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: student!.email, key: 'flashcards', value: next }),
    });
  }

  async function deleteMemory(id: string) {
    const next = memory.filter((m) => m.id !== id);
    setMemory(next);
    if (previewMode) return;
    await fetch('/api/client-kv', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId: student!.email, key: 'memory', value: next }),
    });
  }

  function gradeCard(known: boolean) {
    if (!currentCard) return;
    const next = cards.map((c) => c.id === currentCard.id ? {
      ...c,
      reviewedCount: c.reviewedCount + 1,
      knownCount: c.knownCount + (known ? 1 : 0),
      lastReviewedAt: new Date().toISOString(),
    } : c);
    saveCards(next);
    setShowAnswer(false);
    setPracticeIdx((i) => (i + 1) % Math.max(1, filtered.length));
  }

  function deleteCard(id: string) {
    const next = cards.filter((c) => c.id !== id);
    saveCards(next);
  }

  return (
    <div className="min-h-screen text-white relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <JarvisFab />
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {previewMode && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
               style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 text-[12px] text-white/70">Staff Preview · viewing {student.firstName}'s study tools.</div>
            <a href="/" className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white">← Back</a>
          </div>
        )}

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Home
          </Link>
          <div className="flex-1" />
          <div className="text-[10px] uppercase tracking-[0.15em] text-white/55 font-bold">Study Tools</div>
        </div>

        <div>
          <h1 className="text-[28px] font-extrabold">My Study Stuff</h1>
          <p className="text-[12px] text-white/60 mt-0.5">
            {cards.length} flashcards · {memory.length} memories saved
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl overflow-hidden border w-fit" style={{ borderColor: theme.chipBorder }}>
          <button
            onClick={() => setTab('cards')}
            className={`px-4 py-2 text-[12px] font-bold transition ${tab === 'cards' ? 'text-white' : 'text-white/60 hover:text-white/90'}`}
            style={tab === 'cards' ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            Flash Cards
          </button>
          <button
            onClick={() => setTab('memory')}
            className={`px-4 py-2 text-[12px] font-bold transition ${tab === 'memory' ? 'text-white' : 'text-white/60 hover:text-white/90'}`}
            style={tab === 'memory' ? { background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` } : { background: 'rgba(255,255,255,0.04)' }}
          >
            My Memory
          </button>
        </div>

        {/* ── FLASH CARDS ── */}
        {tab === 'cards' && (
          <>
            {/* Subject filter */}
            <div className="flex flex-wrap gap-2">
              {subjects.map((s) => (
                <button
                  key={s}
                  onClick={() => { setSubject(s); setPracticeIdx(0); setShowAnswer(false); }}
                  className="text-[11px] font-semibold px-3 py-1 rounded-full border"
                  style={{
                    background: subject === s ? `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` : 'rgba(255,255,255,0.05)',
                    borderColor: subject === s ? theme.gradientTo : 'rgba(255,255,255,0.15)',
                    color: subject === s ? '#fff' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {s} {s !== 'All' ? `(${cards.filter((c) => c.subject === s).length})` : `(${cards.length})`}
                </button>
              ))}
            </div>

            {/* Practice card */}
            {filtered.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <div className="text-[14px] font-bold mb-1">No flashcards yet</div>
                <div className="text-[12px] text-white/60">
                  Chat with a tutor and tap <span className="text-white">Save as Flashcard</span> on a reply you want to remember.
                </div>
              </div>
            ) : currentCard ? (
              <div
                onClick={() => setShowAnswer((v) => !v)}
                className="glass-card p-8 cursor-pointer min-h-[260px] flex flex-col items-center justify-center text-center transition hover:scale-[1.005]"
                style={{ borderLeft: `3px solid ${theme.gradientFrom}` }}
              >
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/55 font-bold mb-3">
                  {currentCard.subject} · Card {(practiceIdx % filtered.length) + 1} of {filtered.length}
                </div>
                {!showAnswer ? (
                  <>
                    <div className="text-[18px] font-bold text-white mb-3">{currentCard.question}</div>
                    <div className="text-[11px] text-white/55">Tap to flip</div>
                  </>
                ) : (
                  <>
                    <div className="text-[14px] text-white/65 mb-2">{currentCard.question}</div>
                    <div className="text-[18px] font-bold mt-2" style={{ color: theme.accent }}>{currentCard.answer}</div>
                  </>
                )}
              </div>
            ) : null}

            {/* Grade buttons */}
            {showAnswer && currentCard && (
              <div className="flex gap-3 justify-center">
                <button
                  onClick={(e) => { e.stopPropagation(); gradeCard(false); }}
                  className="text-[12px] font-bold px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20"
                >
                  Need to study more
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); gradeCard(true); }}
                  className="text-[12px] font-bold px-5 py-2.5 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg,#10b981,#34d399)' }}
                >
                  I knew this!
                </button>
              </div>
            )}

            {/* All cards list */}
            {filtered.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-[0.15em] text-white/55 font-bold mb-2">All Cards</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {filtered.map((c) => (
                    <div key={c.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-[11px] font-bold text-white/85">{c.question}</div>
                          <div className="text-[11px] text-white/60 mt-1">{c.answer}</div>
                          <div className="text-[9px] text-white/40 mt-2 uppercase tracking-wider">
                            {c.subject} · seen {c.reviewedCount}× · known {c.knownCount}×
                          </div>
                        </div>
                        <button onClick={() => deleteCard(c.id)} className="text-white/30 hover:text-rose-400" title="Delete">
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── MEMORY ── */}
        {tab === 'memory' && (
          <>
            {memory.length === 0 ? (
              <div className="glass-card p-10 text-center">
                <div className="text-[14px] font-bold mb-1">Nothing saved yet</div>
                <div className="text-[12px] text-white/60">
                  Tap <span className="text-white">Save to Memory</span> on any tutor reply you want to keep.
                </div>
              </div>
            ) : (
              <ul className="space-y-2">
                {memory.map((m) => (
                  <li key={m.id} className="glass-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className="text-[14px] font-bold text-white">{m.title}</div>
                          {m.subject && (
                            <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full"
                                  style={{ background: theme.chipBg, color: theme.accent }}>
                              {m.subject}
                            </span>
                          )}
                        </div>
                        <div className="text-[12px] text-white/75 whitespace-pre-wrap leading-relaxed">{m.body}</div>
                        <div className="text-[10px] text-white/40 mt-2">{fmtDate(m.createdAt)}</div>
                      </div>
                      <button onClick={() => deleteMemory(m.id)} className="text-white/30 hover:text-rose-400 shrink-0" title="Delete">
                        <span className="material-symbols-outlined" style={{ fontSize: 18 }}>delete</span>
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

      </div>
    </div>
  );
}
