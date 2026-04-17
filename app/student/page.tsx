'use client';

/**
 * Student Portal — kid-focused homepage for Marissa (and future students).
 *
 * Layout:
 *   - Welcome header with their name + grade + interests
 *   - Today panel (date + a friendly motivational line)
 *   - "My Buddies" — grid of AI tutor cards (8 specialized tutors)
 *   - Schedule (next 7 days from schedule_events)
 *
 * Staff (mn@) can preview by visiting /student directly.
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  getStudentByEmail,
  STUDENTS,
  STUDENT_AGENTS,
  STUDENT_THEMES,
  type Student,
} from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';

type SchedEv = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
};

const FRIENDLY_LINES = [
  'You\'re going to crush today.',
  'Small steps, big wins.',
  'Stay curious — learning is your superpower.',
  'You bring the effort, I\'ll bring the help.',
  'Today is a great day to learn something new.',
];

function fmtDate(d: string) {
  return new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function StudentPortal() {
  const [email, setEmail] = useState('');
  const [student, setStudent] = useState<Student | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [events, setEvents] = useState<SchedEv[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setEmail(userEmail);

      const s = getStudentByEmail(userEmail);
      if (!s && isMNAStaff(userEmail)) {
        // Staff preview — show the first student's portal
        setPreviewMode(true);
        setStudent(STUDENTS[0] || null);
        setLoading(false);
        return;
      }
      setStudent(s);
      if (!s) { setLoading(false); return; }

      const todayStr = new Date().toISOString().slice(0, 10);
      const futureStr = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
      fetch(`/api/schedule?email=${encodeURIComponent(userEmail)}&from=${todayStr}&to=${futureStr}`)
        .then((r) => r.json())
        .then((d) => setEvents(d.events || []))
        .catch(() => {});
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">
        Loading your portal…
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 gap-3">
        <div className="text-white text-lg font-bold">Student account not configured</div>
        <p className="text-white/60 text-sm max-w-md">
          Your email <span className="text-white">{email || '(none)'}</span> isn't recognized as a student account.
        </p>
      </div>
    );
  }

  const theme = STUDENT_THEMES[student.themeColor];
  const today = new Date();
  const todayStr = today.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  const motivational = FRIENDLY_LINES[today.getDate() % FRIENDLY_LINES.length];

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}
    >
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {/* ── STAFF PREVIEW BANNER ── */}
        {previewMode && (
          <div
            className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}
          >
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold text-amber-100">Staff Preview Mode</div>
              <div className="text-[11px] text-white/70">
                Viewing {student.firstName}'s portal. This is what she sees when she logs in.
              </div>
            </div>
            <a
              href="/"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
            >
              ← Back to staff portal
            </a>
          </div>
        )}

        {/* ── WELCOME HEADER ── */}
        <div className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <div
              className="text-[11px] uppercase tracking-[0.15em] font-bold"
              style={{ color: theme.accent }}
            >
              {todayStr}
            </div>
            <h1 className="text-[34px] md:text-[40px] font-extrabold mt-1 leading-none">
              Hi, {student.firstName} <span style={{
                background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})`,
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              }}>✨</span>
            </h1>
            <div className="text-white/75 text-sm mt-1">{motivational}</div>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Chip label={`${student.age} years old`} theme={theme} />
              <Chip label={student.grade} theme={theme} />
              <Chip label={student.school} theme={theme} />
              {student.interests.map((i) => (
                <Chip key={i} label={`💜 ${i}`} theme={theme} />
              ))}
            </div>
          </div>
          {!previewMode && (
            <button
              onClick={async () => { await createSupabaseClient().auth.signOut(); window.location.href = '/login'; }}
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20"
            >
              Sign out
            </button>
          )}
        </div>

        {/* ── MY BUDDIES (AI tutor grid) ── */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-[18px] font-extrabold">My Buddies</h2>
              <p className="text-[12px] text-white/60">Pick someone to help you out today.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {STUDENT_AGENTS.map((a) => (
              <Link
                key={a.id}
                href={`/student/agent/${a.id}`}
                className="group rounded-2xl p-4 transition-all hover:scale-[1.02]"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${theme.chipBorder}`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: `linear-gradient(135deg, ${theme.gradientFrom}, ${theme.gradientTo})` }}
                >
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>{a.icon}</span>
                </div>
                <div className="text-[14px] font-bold text-white">{a.name}</div>
                <div className="text-[11px] font-medium uppercase tracking-wider mt-0.5" style={{ color: theme.accent }}>
                  {a.role}
                </div>
                <div className="text-[12px] text-white/65 mt-2 leading-snug">{a.tagline}</div>
                <div className="flex items-center gap-1 mt-3 text-[11px] font-semibold" style={{ color: theme.accent }}>
                  Chat now
                  <span className="material-symbols-outlined transition-transform group-hover:translate-x-1" style={{ fontSize: 14 }}>arrow_forward</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── THIS WEEK ── */}
        <div className="glass-card p-5">
          <div className="text-[14px] font-bold mb-3">This Week</div>
          {events.length === 0 ? (
            <div className="text-[12px] text-white/60 text-center py-6">
              No events scheduled — that's a clean slate to learn something new.
            </div>
          ) : (
            <ul className="space-y-2">
              {events.slice(0, 8).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  <div className="text-[11px] text-white/65 w-24 shrink-0 font-semibold">{fmtDate(e.event_date)}</div>
                  <div className="text-[11px] text-white/65 w-28 shrink-0">{e.start_time || 'all day'}{e.end_time ? `–${e.end_time}` : ''}</div>
                  <div className="text-sm font-semibold flex-1 truncate">{e.title}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

      </div>
    </div>
  );
}

function Chip({ label, theme }: { label: string; theme: typeof STUDENT_THEMES['purple'] }) {
  return (
    <span
      className="text-[11px] font-semibold px-3 py-1 rounded-full"
      style={{ background: theme.chipBg, border: `1px solid ${theme.chipBorder}`, color: theme.accent }}
    >
      {label}
    </span>
  );
}
