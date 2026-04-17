'use client';

/**
 * Tracing canvas — for Kyle (kindergarten).
 *
 * Renders the chosen word in big outlined letters and lets him draw on
 * top with finger / mouse / pen. Each finished trace is a gentle
 * confidence builder — there's no auto-grading; mom can check.
 *
 * URL: /student/trace?word=cat   (defaults to first word of the week)
 *      Buttons let him pick from the current week's word list.
 */

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { createClient as createSupabaseClient } from '@/lib/supabase/client';
import {
  getStudentByEmail,
  STUDENTS,
  STUDENT_THEMES,
  getWeeklyWordsForKid,
  type Student,
} from '@/lib/students';
import { isMNAStaff } from '@/lib/staff';

export default function TracePage() {
  const search = useSearchParams();
  const [student, setStudent] = useState<Student | null>(null);
  const word = (search?.get('word') || '').toLowerCase();
  const weekly = getWeeklyWordsForKid();
  const activeWord = (word && /^[a-z]+$/.test(word)) ? word : weekly.words[0];

  useEffect(() => {
    (async () => {
      const supabase = createSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      const userEmail = user?.email || '';
      const s = getStudentByEmail(userEmail);
      // For Kyle: use his profile. Staff preview: default to Kyle (the kid who needs tracing).
      const fallback = STUDENTS.find((st) => st.email === 'kyle@mothernatureagency.com') || STUDENTS[0];
      setStudent(s || (isMNAStaff(userEmail) ? fallback : null));
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

  return (
    <div className="min-h-screen text-white relative" style={{ background: theme.bgGradient, backgroundAttachment: 'fixed' }}>
      <div className="max-w-[1000px] mx-auto px-4 md:px-8 py-6 md:py-10 space-y-5">

        {/* Back nav */}
        <div className="flex items-center gap-3">
          <Link href="/student" className="text-white/70 hover:text-white flex items-center gap-1 text-sm">
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Home
          </Link>
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-[0.15em] font-bold" style={{ color: theme.accent }}>
            Trace Time · {weekly.theme}
          </div>
          <h1 className="text-[28px] font-extrabold mt-1">Trace the word!</h1>
          <p className="text-[12px] text-white/65 mt-1">Use your finger or the mouse. Try to stay on the letters.</p>
        </div>

        {/* Word picker */}
        <div className="flex flex-wrap gap-2">
          {weekly.words.map((w) => (
            <Link
              key={w}
              href={`/student/trace?word=${encodeURIComponent(w)}`}
              replace
              className="text-[14px] font-bold px-3 py-1.5 rounded-lg transition"
              style={{
                background: w === activeWord
                  ? `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`
                  : 'rgba(255,255,255,0.08)',
                color: w === activeWord ? '#fff' : 'rgba(255,255,255,0.75)',
                border: `1px solid ${w === activeWord ? theme.gradientTo : theme.chipBorder}`,
              }}
            >
              {w}
            </Link>
          ))}
        </div>

        <TracingCanvas word={activeWord} theme={theme} />

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
type Theme = (typeof STUDENT_THEMES)[keyof typeof STUDENT_THEMES];

function TracingCanvas({ word, theme }: { word: string; theme: Theme }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [strokeColor, setStrokeColor] = useState<string>(theme.accent);
  const [strokeWidth, setStrokeWidth] = useState(10);

  // Reset / re-draw outline whenever the word changes
  useEffect(() => { redrawBackground(); }, [word]);

  function getCanvas(): HTMLCanvasElement | null {
    return canvasRef.current;
  }

  function redrawBackground() {
    const c = getCanvas();
    if (!c) return;
    // Make sure the canvas internal pixel size matches its CSS box for crisp lines.
    const rect = c.getBoundingClientRect();
    c.width = Math.max(600, Math.floor(rect.width));
    c.height = 300;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);

    // Ruled lines (top, mid dashed, bottom) — like writing paper
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    [60, 250].forEach((y) => {
      ctx.beginPath(); ctx.moveTo(20, y); ctx.lineTo(c.width - 20, y); ctx.stroke();
    });
    ctx.setLineDash([6, 6]);
    ctx.beginPath(); ctx.moveTo(20, 155); ctx.lineTo(c.width - 20, 155); ctx.stroke();
    ctx.setLineDash([]);

    // The word itself, big and outlined
    const fontSize = Math.min(200, Math.floor((c.width - 40) / Math.max(1, word.length) * 1.2));
    ctx.font = `bold ${fontSize}px Georgia, system-ui, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    const cx = c.width / 2;
    const cy = 155;
    ctx.fillText(word.toUpperCase(), cx, cy);
    ctx.strokeText(word.toUpperCase(), cx, cy);
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>): { x: number; y: number } {
    const c = getCanvas();
    if (!c) return { x: 0, y: 0 };
    const rect = c.getBoundingClientRect();
    const scaleX = c.width / rect.width;
    const scaleY = c.height / rect.height;
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    last.current = pointerPos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const c = getCanvas();
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const pos = pointerPos(e);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = strokeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    last.current = pos;
  }
  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    last.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
  }

  const COLORS = ['#ffffff', '#f472b6', '#facc15', '#34d399', '#60a5fa', '#fb923c'];

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        className="w-full rounded-2xl touch-none cursor-crosshair"
        style={{
          background: 'rgba(0,0,0,0.35)',
          border: `2px dashed ${theme.chipBorder}`,
          height: 300,
        }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-white/55 font-bold">Color:</span>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => setStrokeColor(c)}
            className="w-7 h-7 rounded-full transition"
            style={{
              background: c,
              border: strokeColor === c ? '3px solid white' : '2px solid rgba(255,255,255,0.25)',
            }}
            aria-label={`Use ${c}`}
          />
        ))}
        <span className="text-[11px] uppercase tracking-wider text-white/55 font-bold ml-3">Pen:</span>
        {[6, 10, 16].map((w) => (
          <button
            key={w}
            onClick={() => setStrokeWidth(w)}
            className={`text-[11px] font-bold px-2.5 py-1 rounded-md ${strokeWidth === w ? 'text-white' : 'text-white/65'}`}
            style={{
              background: strokeWidth === w
                ? `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})`
                : 'rgba(255,255,255,0.08)',
              border: `1px solid ${theme.chipBorder}`,
            }}
          >
            {w === 6 ? 'Thin' : w === 10 ? 'Medium' : 'Thick'}
          </button>
        ))}
        <button
          onClick={redrawBackground}
          className="ml-auto text-[12px] font-bold px-3 py-1.5 rounded-lg text-white"
          style={{ background: `linear-gradient(135deg,${theme.gradientFrom},${theme.gradientTo})` }}
        >
          Clear & Try Again
        </button>
      </div>
    </div>
  );
}
