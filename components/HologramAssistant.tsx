'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

/**
 * JARVIS-style hologram assistant. A glowing orb floats bottom-right; tapping it
 * opens a full-screen hologram that listens (voice), thinks, and speaks its
 * reply — with a text box as a fallback. Wired to POST /api/assistant.
 */

type Msg = { role: 'user' | 'assistant'; content: string };
type HState = 'idle' | 'listening' | 'thinking' | 'speaking';

export default function HologramAssistant() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<HState>('idle');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState('');
  const [interim, setInterim] = useState('');
  const [email, setEmail] = useState<string | null>(null);
  const recogRef = useRef<any>(null);
  const [voiceOn, setVoiceOn] = useState(true);

  const supportsVoice = typeof window !== 'undefined' && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    try { createClient().auth.getUser().then(({ data }) => setEmail(data.user?.email || null)).catch(() => {}); } catch {}
  }, []);

  useEffect(() => {
    if (!open) { try { recogRef.current?.stop?.(); } catch {} try { window.speechSynthesis?.cancel(); } catch {} setState('idle'); }
  }, [open]);

  function speak(t: string) {
    if (!voiceOn) { setState('idle'); return; }
    try {
      const synth = window.speechSynthesis;
      if (!synth) { setState('idle'); return; }
      synth.cancel();
      const u = new SpeechSynthesisUtterance(t.replace(/[*_#`>]/g, '').slice(0, 700));
      u.rate = 1.03; u.pitch = 1.0;
      const v = synth.getVoices().find((x) => /daniel|google uk english male|male/i.test(x.name)) || null;
      if (v) u.voice = v;
      u.onstart = () => setState('speaking');
      u.onend = () => setState('idle');
      synth.speak(u);
    } catch { setState('idle'); }
  }

  async function send(content: string) {
    const q = content.trim();
    if (!q) return;
    setText(''); setInterim('');
    const next: Msg[] = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setState('thinking');
    try {
      const res = await fetch('/api/assistant', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: next, email }) });
      const data = await res.json();
      const reply = (data.reply || data.error || 'I could not process that.').toString();
      setMessages([...next, { role: 'assistant', content: reply }]);
      speak(reply);
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection error — try again.' }]);
      setState('idle');
    }
  }

  function toggleListen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    if (state === 'listening') { try { recogRef.current?.stop(); } catch {} setState('idle'); return; }
    try { window.speechSynthesis?.cancel(); } catch {}
    const r = new SR();
    r.lang = 'en-US'; r.interimResults = true; r.continuous = false;
    r.onresult = (e: any) => {
      let final = '', inter = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else inter += t;
      }
      setInterim(inter);
      if (final) { setInterim(''); send(final); }
    };
    r.onerror = () => setState('idle');
    r.onend = () => setState((s) => (s === 'listening' ? 'idle' : s));
    recogRef.current = r;
    setState('listening');
    try { r.start(); } catch { setState('idle'); }
  }

  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const lastAsst = [...messages].reverse().find((m) => m.role === 'assistant');
  const statusLabel = state === 'listening' ? 'Listening…' : state === 'thinking' ? 'Thinking…' : state === 'speaking' ? 'Speaking…' : 'Ready';

  return (
    <>
      {/* Floating trigger orb */}
      {!open && (
        <button onClick={() => setOpen(true)} className="holo-fab" aria-label="Open assistant">
          <span className="holo-fab-core" />
          <span className="holo-fab-ring" />
        </button>
      )}

      {open && (
        <div className="holo-overlay" onClick={() => setOpen(false)}>
          <div className="holo-stage" onClick={(e) => e.stopPropagation()}>
            <button className="holo-close" onClick={() => setOpen(false)} aria-label="Close">
              <span className="material-symbols-outlined">close</span>
            </button>

            {/* Hologram */}
            <div className={`holo ${state}`}>
              <div className="holo-ring r1" />
              <div className="holo-ring r2" />
              <div className="holo-ring r3" />
              <div className="holo-grid" />
              <div className="holo-core" />
              <div className="holo-wave">
                {Array.from({ length: 28 }).map((_, i) => <span key={i} style={{ animationDelay: `${(i % 14) * 60}ms` }} />)}
              </div>
            </div>

            <div className="holo-status">{statusLabel}</div>

            {/* Transcript */}
            <div className="holo-script">
              {lastUser && <div className="holo-you">“{lastUser.content}”</div>}
              {interim && <div className="holo-you dim">“{interim}”</div>}
              {lastAsst && <div className="holo-ai">{lastAsst.content}</div>}
              {!lastUser && !interim && <div className="holo-hint">Tap the mic and talk, or type below. Ask me about the schedule, content, campaigns…</div>}
            </div>

            {/* Controls */}
            <div className="holo-input">
              {supportsVoice && (
                <button className={`holo-mic ${state === 'listening' ? 'on' : ''}`} onClick={toggleListen} aria-label="Talk">
                  <span className="material-symbols-outlined">{state === 'listening' ? 'graphic_eq' : 'mic'}</span>
                </button>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') send(text); }}
                placeholder={supportsVoice ? 'Speak or type…' : 'Type a message…'}
              />
              <button className="holo-send" onClick={() => send(text)} aria-label="Send">
                <span className="material-symbols-outlined">arrow_upward</span>
              </button>
              <button className={`holo-spk ${voiceOn ? 'on' : ''}`} onClick={() => setVoiceOn((v) => !v)} aria-label="Toggle voice" title={voiceOn ? 'Voice on' : 'Voice off'}>
                <span className="material-symbols-outlined">{voiceOn ? 'volume_up' : 'volume_off'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{HOLO_CSS}</style>
    </>
  );
}

const HOLO_CSS = `
.holo-fab { position: fixed; right: 22px; bottom: 22px; z-index: 60; width: 58px; height: 58px; border-radius: 50%; border: none; cursor: pointer; background: radial-gradient(circle at 50% 40%, rgba(56,189,248,0.35), rgba(2,6,23,0.9)); box-shadow: 0 0 22px rgba(56,189,248,0.55), inset 0 0 14px rgba(56,189,248,0.4); }
.holo-fab-core { position: absolute; inset: 16px; border-radius: 50%; background: radial-gradient(circle, #7dd3fc, #0ea5e9 60%, transparent); box-shadow: 0 0 18px #38bdf8; animation: holo-breathe 2.6s ease-in-out infinite; }
.holo-fab-ring { position: absolute; inset: 4px; border-radius: 50%; border: 1.5px solid rgba(125,211,252,0.6); border-top-color: transparent; border-bottom-color: transparent; animation: holo-spin 3.5s linear infinite; }

.holo-overlay { position: fixed; inset: 0; z-index: 80; display: flex; align-items: center; justify-content: center; background: radial-gradient(circle at 50% 45%, rgba(8,20,40,0.72), rgba(2,6,23,0.92)); backdrop-filter: blur(10px); animation: holo-fade 0.25s ease; }
.holo-stage { position: relative; width: min(92vw, 460px); display: flex; flex-direction: column; align-items: center; gap: 18px; padding: 8px; }
.holo-close { position: absolute; top: -6px; right: -6px; background: rgba(255,255,255,0.08); border: none; color: rgba(255,255,255,0.7); border-radius: 50%; width: 34px; height: 34px; cursor: pointer; display: grid; place-items: center; }
.holo-close:hover { color: #fff; background: rgba(255,255,255,0.16); }

.holo { position: relative; width: 240px; height: 240px; display: grid; place-items: center; }
.holo-ring { position: absolute; border-radius: 50%; border: 1.5px solid transparent; }
.holo .r1 { inset: 0; border-color: rgba(56,189,248,0.5); border-right-color: transparent; border-left-color: transparent; animation: holo-spin 6s linear infinite; }
.holo .r2 { inset: 26px; border-color: rgba(125,211,252,0.55); border-top-color: transparent; border-bottom-color: transparent; animation: holo-spin 4.2s linear infinite reverse; }
.holo .r3 { inset: 52px; border-color: rgba(34,211,238,0.45); border-right-color: transparent; animation: holo-spin 8s linear infinite; }
.holo-grid { position: absolute; inset: 40px; border-radius: 50%; background: radial-gradient(circle, transparent 55%, rgba(56,189,248,0.08) 56%, transparent 58%), radial-gradient(circle, transparent 70%, rgba(56,189,248,0.06) 71%, transparent 73%); }
.holo-core { width: 96px; height: 96px; border-radius: 50%; background: radial-gradient(circle at 50% 40%, #bae6fd, #0ea5e9 55%, rgba(2,6,23,0) 78%); box-shadow: 0 0 44px rgba(56,189,248,0.7), inset 0 0 26px rgba(255,255,255,0.35); animation: holo-breathe 3s ease-in-out infinite; }
.holo-wave { position: absolute; bottom: 46px; display: flex; align-items: flex-end; gap: 3px; height: 40px; opacity: 0.25; transition: opacity 0.3s; }
.holo-wave span { width: 3px; height: 30%; border-radius: 3px; background: linear-gradient(180deg, #7dd3fc, #0ea5e9); animation: holo-wave 900ms ease-in-out infinite; }

/* states */
.holo.listening .holo-core { box-shadow: 0 0 60px rgba(56,189,248,0.95), inset 0 0 26px rgba(255,255,255,0.5); animation-duration: 1.1s; }
.holo.listening .holo-wave, .holo.speaking .holo-wave { opacity: 0.95; }
.holo.listening .holo-wave span { animation-duration: 520ms; }
.holo.thinking .holo-ring { animation-duration: 1.6s !important; }
.holo.thinking .holo-core { background: radial-gradient(circle at 50% 40%, #ddd6fe, #7c3aed 55%, rgba(2,6,23,0) 78%); box-shadow: 0 0 46px rgba(139,92,246,0.7), inset 0 0 26px rgba(255,255,255,0.35); }
.holo.speaking .holo-core { animation-duration: 0.7s; box-shadow: 0 0 64px rgba(45,212,191,0.9), inset 0 0 26px rgba(255,255,255,0.5); background: radial-gradient(circle at 50% 40%, #ccfbf1, #14b8a6 55%, rgba(2,6,23,0) 78%); }
.holo.speaking .holo-wave span { animation-duration: 360ms; background: linear-gradient(180deg, #99f6e4, #14b8a6); }

.holo-status { font-size: 11px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(125,211,252,0.9); }
.holo-script { width: 100%; max-height: 30vh; overflow-y: auto; text-align: center; display: flex; flex-direction: column; gap: 8px; }
.holo-you { font-size: 13px; color: rgba(255,255,255,0.85); font-style: italic; }
.holo-you.dim { color: rgba(255,255,255,0.4); }
.holo-ai { font-size: 14px; line-height: 1.5; color: #fff; background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2); border-radius: 14px; padding: 10px 14px; white-space: pre-wrap; }
.holo-hint { font-size: 12px; color: rgba(255,255,255,0.45); }

.holo-input { width: 100%; display: flex; align-items: center; gap: 8px; }
.holo-input input { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(56,189,248,0.25); border-radius: 999px; padding: 11px 16px; color: #fff; font-size: 14px; outline: none; }
.holo-input input::placeholder { color: rgba(255,255,255,0.35); }
.holo-mic, .holo-send, .holo-spk { width: 42px; height: 42px; border-radius: 50%; border: 1px solid rgba(56,189,248,0.3); background: rgba(56,189,248,0.1); color: #7dd3fc; cursor: pointer; display: grid; place-items: center; flex: 0 0 auto; }
.holo-mic:hover, .holo-send:hover, .holo-spk:hover { background: rgba(56,189,248,0.2); color: #fff; }
.holo-mic.on { background: #0ea5e9; color: #fff; box-shadow: 0 0 18px rgba(56,189,248,0.8); animation: holo-breathe 1.2s ease-in-out infinite; }
.holo-spk { width: 38px; height: 38px; }
.holo-spk.on { color: #7dd3fc; }
.holo-spk:not(.on) { color: rgba(255,255,255,0.4); }

@keyframes holo-spin { to { transform: rotate(360deg); } }
@keyframes holo-breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.08); } }
@keyframes holo-wave { 0%,100% { height: 22%; } 50% { height: 100%; } }
@keyframes holo-fade { from { opacity: 0; } to { opacity: 1; } }
`;
