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
  STUDENT_THEMES,
  getAgentsForStudent,
  getWeeklyLesson,
  getWeeklyWordsForKid,
  getHomeschoolDay,
  getBlocksForChild,
  isSummerBreak,
  getSummerThemeForWeek,
  type Student,
} from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';
import JarvisFab from '@/components/ai/JarvisFab';

type SchedEv = {
  id: string;
  title: string;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  event_type: string;
};

type StudentTask = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  client_id: string;
  created_at: string;
  completed_at: string | null;
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
  const [tasks, setTasks] = useState<StudentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [calMonthOffset, setCalMonthOffset] = useState(0);

  // ── New-task quick form ──
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');     // YYYY-MM-DD optional reminder
  const [newTaskNote, setNewTaskNote] = useState('');

  // ── Google Calendar connection ──
  const [gcalConnected, setGcalConnected] = useState(false);

  // ── New-event quick form ──
  const [newEventOpen, setNewEventOpen] = useState(false);
  const todayIso = new Date().toISOString().slice(0, 10);
  const [eventForm, setEventForm] = useState({
    title: '', date: todayIso, start_time: '15:00', end_time: '16:00', event_type: 'task',
  });

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      setEmail(userEmail);

      const s = getStudentByEmail(userEmail);
      // Use the student's email for fetches (or first student's email in staff preview)
      const fetchEmail = s?.email || (isMNAStaff(userEmail) ? STUDENTS[0]?.email : '') || '';
      if (!s && isMNAStaff(userEmail)) {
        setPreviewMode(true);
        setStudent(STUDENTS[0] || null);
      } else {
        setStudent(s);
      }
      if (!s && !isMNAStaff(userEmail)) { setLoading(false); return; }

      const todayStr = new Date().toISOString().slice(0, 10);
      const futureStr = new Date(Date.now() + 35 * 86400000).toISOString().slice(0, 10);

      await Promise.all([
        fetch(`/api/schedule?email=${encodeURIComponent(fetchEmail)}&from=${todayStr}&to=${futureStr}`)
          .then((r) => r.json()).then((d) => setEvents(d.events || [])).catch(() => {}),
        fetch(`/api/client-requests?assignedTo=${encodeURIComponent(fetchEmail)}`)
          .then((r) => r.json()).then((d) => setTasks(d.requests || d.items || [])).catch(() => {}),
        fetch(`/api/google/status?email=${encodeURIComponent(fetchEmail)}`)
          .then((r) => r.json()).then((d) => setGcalConnected(!!d.connected)).catch(() => {}),
      ]);
      // After loading, also pull any Google Calendar events into the same array
      if (fetchEmail) {
        try {
          const r = await fetch(`/api/google/sync?email=${encodeURIComponent(fetchEmail)}&from=${todayStr}&to=${futureStr}`);
          const d = await r.json();
          if (Array.isArray(d.events)) {
            const gevents = d.events.map((e: any) => ({
              id: `g-${e.id}`,
              title: e.title,
              event_date: e.date || e.event_date,
              start_time: e.start_time,
              end_time: e.end_time,
              event_type: 'google',
            }));
            setEvents((prev) => [...prev, ...gevents]);
          }
        } catch {}
      }
      setLoading(false);
    })();
  }, []);

  // Toggle a task complete/open
  async function toggleTask(t: StudentTask) {
    const next = t.status === 'completed' ? 'open' : 'completed';
    await fetch('/api/client-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: t.id, status: next }),
    }).catch(() => {});
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status: next, completed_at: next === 'completed' ? new Date().toISOString() : null } : x)));
  }

  // Create a new task. Reminder date is appended into the description so it
  // surfaces in the list without needing a new column.
  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    const fetchEmail = student?.email || STUDENTS[0].email;
    const description = [
      newTaskNote.trim(),
      newTaskDue ? `Reminder: ${newTaskDue}` : '',
    ].filter(Boolean).join(' · ');
    const res = await fetch('/api/client-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: 'mna',           // logical owner of the task
        title: newTaskText.trim(),
        description: description || null,
        assignedTo: fetchEmail,
      }),
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const created = data.request || data.item || null;
      if (created) setTasks((prev) => [created, ...prev]);
    }
    setNewTaskText(''); setNewTaskNote(''); setNewTaskDue('');
    setNewTaskOpen(false);
  }

  // Create a new schedule event so it shows up on her calendar grid.
  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventForm.title.trim()) return;
    const fetchEmail = student?.email || STUDENTS[0].email;
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: fetchEmail,
        title: eventForm.title.trim(),
        event_date: eventForm.date,
        start_time: eventForm.start_time || null,
        end_time: eventForm.end_time || null,
        event_type: eventForm.event_type,
        priority: 'normal',
      }),
    }).catch(() => null);
    if (res && res.ok) {
      const data = await res.json();
      const created = data.event || null;
      if (created) setEvents((prev) => [...prev, created]);
    }
    setEventForm({ ...eventForm, title: '' });
    setNewEventOpen(false);
  }

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
      className="min-h-screen text-white relative"
      style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}
    >
      {/* Mother Nature floating globe — Marissa can tap her to talk anytime */}
      <JarvisFab />
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
                Viewing <span className="font-bold text-white">{student.firstName}</span>'s portal.
              </div>
            </div>
            {/* Quick flip between students in preview */}
            <div className="flex items-center gap-1">
              {STUDENTS.map((s) => (
                <button
                  key={s.email}
                  onClick={() => setStudent(s)}
                  className={`text-[11px] font-bold px-3 py-1.5 rounded-lg transition ${student.email === s.email ? 'text-white' : 'text-white/65 hover:text-white bg-white/10'}`}
                  style={student.email === s.email ? { background: `linear-gradient(135deg,${STUDENT_THEMES[s.themeColor].gradientFrom},${STUDENT_THEMES[s.themeColor].gradientTo})` } : {}}
                >
                  {s.firstName}
                </button>
              ))}
            </div>
            <a
              href="/"
              className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white shrink-0"
            >
              ← Back
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

        {/* ── SUMMER BREAK BANNER ── */}
        {isSummerBreak() && (() => {
          const summer = getSummerThemeForWeek();
          const who: 'marissa' | 'kyle' | null =
            student.email === 'marissa@mothernatureagency.com' ? 'marissa' :
            student.email === 'kyle@mothernatureagency.com' ? 'kyle' : null;
          const ideas = who ? summer.ideas.filter((i) => i.who === who || i.who === 'both') : summer.ideas;
          return (
            <div className="rounded-2xl p-5 relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(250,204,21,0.12))', border: '1px solid rgba(250,204,21,0.4)' }}>
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                     style={{ background: 'linear-gradient(135deg,#f97316,#facc15)' }}>
                  <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>wb_sunny</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold text-amber-300">
                    Summer Break · {summer.theme}
                  </div>
                  <div className="text-[18px] font-extrabold mt-0.5">School's out — let's play!</div>
                  <ul className="space-y-1.5 mt-3">
                    {ideas.map((i, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-[12px] text-white/85">
                        <span className="text-[14px] leading-none mt-0.5 text-amber-300">•</span>
                        <span>{i.activity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── TODAY'S HOMESCHOOL PLAN ── (hidden during summer) */}
        {!isSummerBreak() && (() => {
          const day = getHomeschoolDay();
          if (!day) return null;
          const who: 'marissa' | 'kyle' | null =
            student.email === 'marissa@mothernatureagency.com' ? 'marissa' :
            student.email === 'kyle@mothernatureagency.com' ? 'kyle' : null;
          if (!who) return null;
          const blocks = getBlocksForChild(day, who);
          return (
            <div className="rounded-2xl p-5 relative overflow-hidden"
                 style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}>
              <div className="absolute top-0 left-0 right-0 h-1"
                   style={{ background: `linear-gradient(90deg,${theme.gradientFrom},${theme.gradientTo})` }} />
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.accent }}>
                    Today · {day.theme}
                  </div>
                  <div className="text-[18px] font-extrabold mt-0.5">{day.name}'s Schedule</div>
                </div>
                <Link href="/student/week" className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                      style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
                  Full Week →
                </Link>
              </div>
              {blocks.length === 0 ? (
                <div className="text-[12px] text-white/55 text-center py-4">Nothing on the schedule today — enjoy!</div>
              ) : (
                <ul className="space-y-2">
                  {blocks.map((b, i) => (
                    <li key={i} className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                        style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {b.time && (
                        <div className="text-[11px] font-bold w-24 shrink-0" style={{ color: theme.accent }}>{b.time}</div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-bold">{b.subject}</div>
                        {b.detail && <div className="text-[11px] text-white/65 mt-0.5">{b.detail}</div>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })()}

        {/* ── WEEKLY LESSON / WORDS ── */}
        {student.email === 'kyle@mothernatureagency.com' ? (
          (() => {
            // Kyle gets Words of the Week — kindergarten word family + tracing CTA
            const w = getWeeklyWordsForKid();
            return (
              <div
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg,${theme.gradientFrom},${theme.gradientTo})` }}
                />
                <div className="flex items-start gap-4 flex-wrap">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>spellcheck</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.accent }}>
                      Words of the Week · {w.theme}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {w.words.map((word) => (
                        <Link
                          key={word}
                          href={`/student/trace?word=${encodeURIComponent(word)}`}
                          className="text-[28px] font-extrabold px-4 py-2 rounded-xl text-white tracking-wide hover:scale-105 transition-transform"
                          style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`, fontFamily: 'system-ui' }}
                        >
                          {word}
                        </Link>
                      ))}
                    </div>
                    <div
                      className="mt-4 rounded-lg px-3 py-2 text-[12px] flex items-start gap-2"
                      style={{ background: theme.chipBg, border: `1px solid ${theme.chipBorder}` }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: theme.accent }}>lightbulb</span>
                      <span><span className="font-bold" style={{ color: theme.accent }}>Fun fact:</span> {w.funFact}</span>
                    </div>
                    <div className="text-[11px] text-white/55 mt-2">Tap any word to trace it!</div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          (() => {
            const lesson = getWeeklyLesson();
            return (
              <div
                className="rounded-2xl p-5 relative overflow-hidden"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ background: `linear-gradient(90deg,${theme.gradientFrom},${theme.gradientTo})` }}
                />
                <div className="flex items-start gap-4 flex-wrap">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                    style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>auto_awesome</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.accent }}>
                      Lesson of the Week · {lesson.topic}
                    </div>
                    <div className="text-[18px] font-extrabold mt-0.5">{lesson.title}</div>
                    <p className="text-[13px] text-white/80 mt-1.5 leading-relaxed">{lesson.body}</p>
                    <div
                      className="mt-3 rounded-lg px-3 py-2 text-[11px] flex items-start gap-2"
                      style={{ background: theme.chipBg, border: `1px solid ${theme.chipBorder}` }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: theme.accent }}>lightbulb</span>
                      <span><span className="font-bold" style={{ color: theme.accent }}>Fun fact:</span> {lesson.funFact}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}

        {/* ── MY BUDDIES (AI tutor grid) ── */}
        <div>
          <div className="flex items-end justify-between mb-3">
            <div>
              <h2 className="text-[18px] font-extrabold">My Buddies</h2>
              <p className="text-[12px] text-white/60">Pick someone to help you out today.</p>
            </div>
            <div className="flex items-center gap-2">
              {student.email === 'kyle@mothernatureagency.com' && (
                <Link
                  href="/student/trace"
                  className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                  style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
                >
                  ✏️ Trace Words
                </Link>
              )}
              <Link
                href="/student/study"
                className="text-[11px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
              >
                📚 Study & Flashcards
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {getAgentsForStudent(student).map((a) => (
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

        {/* ── MY TASKS ── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[14px] font-bold">My Tasks</div>
              <div className="text-[11px] text-white/60">{tasks.filter((t) => t.status !== 'completed').length} to do</div>
            </div>
            <button
              onClick={() => setNewTaskOpen((v) => !v)}
              className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
              style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
            >
              {newTaskOpen ? 'Cancel' : '+ Add Task'}
            </button>
          </div>

          {newTaskOpen && (
            <form
              onSubmit={addTask}
              className="rounded-xl p-3 mb-3 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}
            >
              <input
                autoFocus
                type="text"
                placeholder="What do you need to do?"
                value={newTaskText}
                onChange={(e) => setNewTaskText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={newTaskDue}
                  onChange={(e) => setNewTaskDue(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type="text"
                  placeholder="Notes (optional)"
                  value={newTaskNote}
                  onChange={(e) => setNewTaskNote(e.target.value)}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] placeholder:text-white/55 focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
              </div>
              <button
                type="submit"
                className="w-full text-[13px] font-bold px-3 py-2 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
              >
                Save Task
              </button>
            </form>
          )}

          {tasks.length === 0 && !newTaskOpen ? (
            <div className="text-[12px] text-white/60 text-center py-6">
              No tasks yet. Tap <span className="text-white">+ Add Task</span> to add one,
              or wait for Mom to assign you something.
            </div>
          ) : tasks.length === 0 ? null : (
            <ul className="space-y-2">
              {tasks.slice(0, 12).map((t) => {
                const done = t.status === 'completed';
                return (
                  <li
                    key={t.id}
                    className="flex items-start gap-3 rounded-xl px-3 py-2.5"
                    style={{ background: 'rgba(255,255,255,0.05)', opacity: done ? 0.55 : 1 }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleTask(t)}
                      className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition"
                      style={{
                        background: done ? `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${done ? theme.gradientTo : 'rgba(255,255,255,0.25)'}`,
                      }}
                      aria-label={done ? 'Mark as not done' : 'Mark as done'}
                    >
                      {done && <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>check</span>}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className={`text-[13px] font-semibold ${done ? 'line-through text-white/55' : 'text-white'}`}>{t.title}</div>
                      {t.description && <div className="text-[11px] text-white/55 mt-0.5">{t.description}</div>}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* ── MONTHLY CALENDAR ── */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCalMonthOffset((o) => o - 1)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/75"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_left</span>
              </button>
              <div className="text-[14px] font-bold min-w-[140px] text-center">
                {(() => {
                  const d = new Date();
                  d.setDate(1);
                  d.setMonth(d.getMonth() + calMonthOffset);
                  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
                })()}
              </div>
              <button
                onClick={() => setCalMonthOffset((o) => o + 1)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/75"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>chevron_right</span>
              </button>
              {calMonthOffset !== 0 && (
                <button onClick={() => setCalMonthOffset(0)} className="text-[10px] font-semibold text-white/55 hover:text-white/85 ml-1">
                  Today
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {gcalConnected ? (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-300" style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>check_circle</span>
                  Google
                </span>
              ) : student?.email ? (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const r = await fetch(`/api/google/connect?email=${encodeURIComponent(student!.email)}`);
                      const data = await r.json();
                      if (data.url) window.location.href = data.url;
                    } catch {}
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold text-white hover:opacity-90 transition"
                  style={{ background: 'linear-gradient(135deg,#4285F4,#34A853)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12 }}>calendar_add_on</span>
                  Connect Google
                </button>
              ) : null}
              <button
                onClick={() => setNewEventOpen((v) => !v)}
                className="text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
              >
                {newEventOpen ? 'Cancel' : '+ Add Event'}
              </button>
            </div>
          </div>

          {newEventOpen && (
            <form
              onSubmit={addEvent}
              className="rounded-xl p-3 mb-4 space-y-2"
              style={{ background: 'rgba(0,0,0,0.35)', border: `1px solid ${theme.chipBorder}` }}
            >
              <input
                autoFocus
                type="text"
                placeholder="Event title (e.g. Math homework, Singing practice)"
                value={eventForm.title}
                onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border text-white text-[13px] placeholder:text-white/55 focus:outline-none"
                style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
              />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({ ...eventForm, date: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type="time"
                  value={eventForm.start_time}
                  onChange={(e) => setEventForm({ ...eventForm, start_time: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <input
                  type="time"
                  value={eventForm.end_time}
                  onChange={(e) => setEventForm({ ...eventForm, end_time: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                />
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                  className="px-3 py-2 rounded-lg border text-white text-[12px] focus:outline-none"
                  style={{ background: 'rgba(0,0,0,0.45)', borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  <option value="task" className="bg-slate-900">School / Task</option>
                  <option value="meeting" className="bg-slate-900">Class / Meeting</option>
                  <option value="personal" className="bg-slate-900">Personal</option>
                  <option value="deadline" className="bg-slate-900">Deadline</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full text-[13px] font-bold px-3 py-2 rounded-lg text-white"
                style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
              >
                Save to Calendar
              </button>
            </form>
          )}

          {/* Calendar grid */}
          {(() => {
            const today = new Date();
            const view = new Date(today.getFullYear(), today.getMonth() + calMonthOffset, 1);
            const firstDow = view.getDay();
            const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
            const cells: { day: number | null; iso: string | null }[] = [];
            for (let i = 0; i < firstDow; i++) cells.push({ day: null, iso: null });
            for (let d = 1; d <= daysInMonth; d++) {
              const iso = `${view.getFullYear()}-${String(view.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
              cells.push({ day: d, iso });
            }
            while (cells.length % 7 !== 0) cells.push({ day: null, iso: null });
            const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const eventsByDay = events.reduce<Record<string, SchedEv[]>>((acc, e) => {
              (acc[e.event_date] ||= []).push(e); return acc;
            }, {});
            return (
              <>
                <div className="grid grid-cols-7 gap-1 mb-1">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="text-[10px] font-bold uppercase tracking-wider text-white/45 text-center">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map((c, i) => {
                    if (!c.day) return <div key={i} className="aspect-square rounded-md" style={{ background: 'rgba(255,255,255,0.02)' }} />;
                    const dayEvents = c.iso ? eventsByDay[c.iso] || [] : [];
                    const isToday = c.iso === todayIso;
                    return (
                      <div
                        key={i}
                        className="aspect-square rounded-md p-1.5 flex flex-col gap-0.5 overflow-hidden"
                        style={{
                          background: isToday ? `linear-gradient(135deg,${theme.gradientFrom}33,${theme.gradientTo}22)` : 'rgba(255,255,255,0.04)',
                          border: isToday ? `1px solid ${theme.gradientTo}` : '1px solid rgba(255,255,255,0.06)',
                        }}
                      >
                        <div className={`text-[10px] font-bold ${isToday ? 'text-white' : 'text-white/65'}`}>{c.day}</div>
                        {dayEvents.slice(0, 2).map((ev) => (
                          <div
                            key={ev.id}
                            className="text-[8px] leading-tight px-1 py-0.5 rounded truncate"
                            style={{ background: theme.chipBg, color: theme.accent }}
                            title={ev.title}
                          >
                            {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 2 && <div className="text-[7px] text-white/45">+{dayEvents.length - 2}</div>}
                      </div>
                    );
                  })}
                </div>
              </>
            );
          })()}

          {/* Upcoming list under the grid */}
          {events.length > 0 && (
            <div className="mt-5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 mb-2">Coming Up</div>
              <ul className="space-y-2">
                {events.slice(0, 6).map((e) => (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <div className="text-[11px] text-white/65 w-24 shrink-0 font-semibold">{fmtDate(e.event_date)}</div>
                    <div className="text-[11px] text-white/65 w-24 shrink-0">{e.start_time || 'all day'}</div>
                    <div className="text-sm font-semibold flex-1 truncate">{e.title}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

type Theme = (typeof STUDENT_THEMES)[keyof typeof STUDENT_THEMES];

function Chip({ label, theme }: { label: string; theme: Theme }) {
  return (
    <span
      className="text-[11px] font-semibold px-3 py-1 rounded-full"
      style={{ background: theme.chipBg, border: `1px solid ${theme.chipBorder}`, color: theme.accent }}
    >
      {label}
    </span>
  );
}
