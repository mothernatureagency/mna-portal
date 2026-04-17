'use client';

/**
 * Full week view + Montessori weekly plan.
 * Each kid sees ONLY blocks tagged with their name (or "both").
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  getStudentByEmail,
  STUDENTS,
  STUDENT_THEMES,
  HOMESCHOOL_WEEK,
  getBlocksForChild,
  getMontessoriPlan,
  type Student,
} from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';
import JarvisFab from '@/components/ai/JarvisFab';

export default function WeekPage() {
  const [student, setStudent] = useState<Student | null>(null);
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const s = getStudentByEmail(userEmail);
      if (s) { setStudent(s); return; }
      if (isMNAStaff(userEmail)) { setPreviewMode(true); setStudent(STUDENTS[0]); }
    })();
  }, []);

  if (!student) {
    return <div className="min-h-screen flex items-center justify-center text-white/60 text-sm">Loading…</div>;
  }
  const theme = STUDENT_THEMES[student.themeColor];
  const who: 'marissa' | 'kyle' = student.email === 'kyle@mothernatureagency.com' ? 'kyle' : 'marissa';
  const plan = getMontessoriPlan();
  const todayDow = new Date().getDay();
  const activitiesForKid = who === 'marissa' ? plan.marissaActivities : plan.kyleActivities;

  return (
    <div className="min-h-screen text-white relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <JarvisFab />
      <div className="max-w-[1100px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {previewMode && (
          <div className="rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
               style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)' }}>
            <span className="material-symbols-outlined text-amber-300" style={{ fontSize: 20 }}>visibility</span>
            <div className="flex-1 text-[12px] text-white/70">Staff Preview · {student.firstName}'s week</div>
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
        <div className="flex items-center gap-3">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Home
          </Link>
        </div>

        <div>
          <h1 className="text-[28px] font-extrabold">{student.firstName}'s Weekly Schedule</h1>
          <p className="text-[12px] text-white/65 mt-1">Homeschool plan + Montessori week. Only your blocks are shown.</p>
        </div>

        {/* ── Weekly schedule grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {HOMESCHOOL_WEEK.map((day) => {
            const isToday = day.weekday === todayDow;
            const blocks = getBlocksForChild(day, who);
            return (
              <div key={day.weekday} className="rounded-xl p-3 min-h-[180px]"
                   style={{
                     background: isToday ? `linear-gradient(135deg,${theme.gradientFrom}22,${theme.gradientTo}11)` : 'rgba(255,255,255,0.04)',
                     border: isToday ? `1px solid ${theme.gradientTo}` : `1px solid ${theme.chipBorder}`,
                   }}>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-[12px] font-extrabold">{day.name}</div>
                  {isToday && (
                    <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                          style={{ background: theme.chipBg, color: theme.accent }}>Today</span>
                  )}
                </div>
                <div className="text-[10px] uppercase tracking-wider font-bold mb-2" style={{ color: theme.accent }}>{day.theme}</div>
                <ul className="space-y-1.5">
                  {blocks.map((b, i) => (
                    <li key={i} className="text-[11px]">
                      {b.time && <span className="font-bold mr-1">{b.time}</span>}
                      <span className="font-semibold">{b.subject}</span>
                      {b.detail && <div className="text-white/55 text-[10px] leading-snug">{b.detail}</div>}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        {/* ── Montessori Plan for the Week ── */}
        <div className="rounded-2xl p-5"
             style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${theme.chipBorder}` }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                 style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}>
              <span className="material-symbols-outlined text-white" style={{ fontSize: 26 }}>spa</span>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.accent }}>
                Montessori Monday · This Week
              </div>
              <div className="text-[20px] font-extrabold leading-tight">{plan.theme}</div>
              <div className="text-[12px] text-white/65 mt-0.5">{plan.bigIdea}</div>
            </div>
          </div>

          {/* Activities for THIS kid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-white/55 mb-2">
                {student.firstName}'s Activities
              </div>
              <ul className="space-y-1.5">
                {activitiesForKid.map((a, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] text-white/85">
                    <span className="text-[13px] leading-none mt-0.5" style={{ color: theme.accent }}>•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-white/55 mb-2">
                Together Activity
              </div>
              <div className="rounded-xl p-3 text-[12px]"
                   style={{ background: theme.chipBg, border: `1px solid ${theme.chipBorder}` }}>
                {plan.jointActivity}
              </div>
              <div className="text-[11px] uppercase tracking-wider font-bold text-white/55 mb-2 mt-4">
                Supplies to Gather
              </div>
              <div className="flex flex-wrap gap-1.5">
                {plan.supplies.map((s, i) => (
                  <span key={i} className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
