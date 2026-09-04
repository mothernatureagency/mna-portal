'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getDisplayName } from '@/lib/display-names';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const SUGGESTIONS = [
  "What's on my schedule today?",
  'Assign Sable a task to shoot Chill House content, due Friday',
  "What's overdue on the team board?",
  'Every month on the 25th, remind Vanessa to collect specials',
  'What content needs approval this week?',
  "What's on Vanessa's plate right now?",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  // ── Voice mode (the Jarvis part) ──────────────────────────────────
  // Tap the mic to talk; with Voice Mode on, replies are spoken aloud and
  // the mic re-opens after each answer for a hands-free conversation.
  const [voiceOn, setVoiceOn] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(true);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);
  const voiceOnRef = useRef(false);
  const speakingRef = useRef(false);
  const listeningRef = useRef(false);
  const loadingRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  const userEmailRef = useRef('');

  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);
  useEffect(() => { speakingRef.current = speaking; }, [speaking]);
  useEffect(() => { listeningRef.current = listening; }, [listening]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then((res: { data: { user: { email?: string | null } | null } }) => {
      setUserEmail(res.data.user?.email || '');
    });
    const SR = typeof window !== 'undefined' && ((window as any).webkitSpeechRecognition || (window as any).SpeechRecognition);
    if (!SR) setVoiceSupported(false);
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* already stopped */ }
      try { window.speechSynthesis?.cancel(); } catch { /* unavailable */ }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + 'px';
    }
  }, [input]);

  // ── Text-to-speech ────────────────────────────────────────────────

  function pickVoice(): SpeechSynthesisVoice | null {
    const voices = window.speechSynthesis?.getVoices() || [];
    return voices.find((v) => v.name === 'Google US English')
      || voices.find((v) => /Samantha|Karen|Ava|Allison/i.test(v.name))
      || voices.find((v) => (v.lang || '').startsWith('en'))
      || null;
  }

  function speak(text: string) {
    if (!voiceOnRef.current || typeof window === 'undefined' || !window.speechSynthesis) return;
    // Strip characters that read badly aloud (markdown, merge tags, emoji-ish).
    const clean = text.replace(/[*_#`>|]/g, ' ').replace(/\{\{[^}]+\}\}/g, 'the link').replace(/\s+/g, ' ').trim().slice(0, 1400);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onstart = () => { speakingRef.current = true; setSpeaking(true); };
    u.onend = () => {
      speakingRef.current = false;
      setSpeaking(false);
      // Hands-free loop: after answering, listen for the next request.
      if (voiceOnRef.current) setTimeout(() => startListening(), 300);
    };
    u.onerror = () => { speakingRef.current = false; setSpeaking(false); };
    window.speechSynthesis.speak(u);
  }

  function stopSpeaking() {
    try { window.speechSynthesis?.cancel(); } catch { /* unavailable */ }
    speakingRef.current = false;
    setSpeaking(false);
  }

  // ── Speech-to-text ────────────────────────────────────────────────

  function startListening() {
    if (listeningRef.current || loadingRef.current || speakingRef.current) return;
    const SR = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SR) { setVoiceSupported(false); return; }
    try { recognitionRef.current?.stop(); } catch { /* fine */ }

    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = '';

    rec.onresult = (e: any) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setInput((finalText + interim).trimStart());
    };
    rec.onend = () => {
      listeningRef.current = false;
      setListening(false);
      const msg = finalText.trim();
      if (msg) {
        setInput('');
        void send(msg);
      } else if (voiceOnRef.current && !speakingRef.current && !loadingRef.current) {
        // Heard nothing — quietly keep the mic warm in hands-free mode.
        setTimeout(() => { if (voiceOnRef.current && !speakingRef.current && !loadingRef.current) startListening(); }, 500);
      }
    };
    rec.onerror = (e: any) => {
      listeningRef.current = false;
      setListening(false);
      if (e?.error === 'not-allowed' || e?.error === 'service-not-allowed') {
        // Mic permission refused — drop out of voice mode instead of looping.
        voiceOnRef.current = false;
        setVoiceOn(false);
      }
    };

    recognitionRef.current = rec;
    listeningRef.current = true;
    setListening(true);
    try { rec.start(); } catch { listeningRef.current = false; setListening(false); }
  }

  function stopListening() {
    try { recognitionRef.current?.stop(); } catch { /* fine */ }
    listeningRef.current = false;
    setListening(false);
  }

  function toggleVoiceMode() {
    if (voiceOn) {
      voiceOnRef.current = false;
      setVoiceOn(false);
      stopListening();
      stopSpeaking();
      setInput('');
    } else {
      voiceOnRef.current = true;
      setVoiceOn(true);
      // Speaking first doubles as the user-gesture unlock for audio output;
      // the mic opens as soon as the confirmation finishes.
      if (window.speechSynthesis) speak("Voice mode on. I'm listening.");
      else startListening();
    }
  }

  // ── Chat ──────────────────────────────────────────────────────────

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loadingRef.current) return;
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    const newMessages = [...messagesRef.current, userMsg];
    setMessages(newMessages);
    setLoading(true);
    loadingRef.current = true;

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmailRef.current,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();
      const replyText = data.reply || data.error || 'Something went wrong.';

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: replyText,
        timestamp: new Date(),
      };

      setMessages([...newMessages, assistantMsg]);
      loadingRef.current = false;
      setLoading(false);
      speak(replyText);
    } catch {
      const failText = 'Sorry, I had trouble connecting. Try again.';
      setMessages([
        ...newMessages,
        { id: crypto.randomUUID(), role: 'assistant', content: failText, timestamp: new Date() },
      ]);
      loadingRef.current = false;
      setLoading(false);
      speak(failText);
    } finally {
      if (!voiceOnRef.current) setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const greetingName = getDisplayName(userEmail);
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-[900px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="shrink-0 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>smart_toy</span>
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white tracking-tight">MNA Assistant</h1>
            <p className="text-[12px] text-white/40">
              {voiceOn
                ? (speaking ? 'Speaking…' : listening ? 'Listening…' : loading ? 'Thinking…' : 'Voice mode — say something')
                : 'Your personal AI assistant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {speaking && (
            <button
              onClick={stopSpeaking}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white/70 hover:text-white"
              style={{ background: 'rgba(255,255,255,0.08)' }}
              title="Stop speaking"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>stop_circle</span>
            </button>
          )}
          {voiceSupported && (
            <button
              onClick={toggleVoiceMode}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white transition-all"
              style={{
                background: voiceOn ? 'linear-gradient(135deg, #0c6da4, #4ab8ce)' : 'rgba(255,255,255,0.08)',
                border: voiceOn ? '1px solid rgba(74,184,206,0.6)' : '1px solid rgba(255,255,255,0.12)',
                boxShadow: voiceOn ? '0 0 18px rgba(74,184,206,0.35)' : 'none',
              }}
              title={voiceOn ? 'Turn voice mode off' : 'Talk to the assistant hands-free — it speaks its answers and keeps listening'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 17 }}>{voiceOn ? 'headset_mic' : 'headset'}</span>
              {voiceOn ? 'Voice On' : 'Voice Mode'}
              {voiceOn && <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
            </button>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-5 ${listening ? 'animate-pulse' : ''}`}
              style={{
                background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)',
                boxShadow: listening ? '0 0 32px rgba(74,184,206,0.6)' : 'none',
              }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>{listening ? 'graphic_eq' : 'smart_toy'}</span>
            </div>
            <h2 className="text-white text-[18px] font-bold mb-1">{timeGreeting}{greetingName ? `, ${greetingName}` : ''}</h2>
            <p className="text-white/40 text-[13px] mb-8 text-center max-w-md">
              {voiceOn
                ? 'Voice mode is on — just talk. I speak my answers and keep listening.'
                : 'I can assign team tasks, manage your schedule, track campaigns, remember details, and keep you on top of everything. Hit Voice Mode to talk instead of type.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-4 py-3 rounded-xl text-[12px] text-white/60 hover:text-white transition-all"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(74,184,206,0.1)'; e.currentTarget.style.borderColor = 'rgba(74,184,206,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Messages */
          <div className="p-4 space-y-4">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex items-start gap-2.5 max-w-[80%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                    style={{
                      background: m.role === 'assistant'
                        ? 'linear-gradient(135deg, #0c6da4, #4ab8ce)'
                        : 'rgba(255,255,255,0.12)',
                    }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>
                      {m.role === 'assistant' ? 'smart_toy' : 'person'}
                    </span>
                  </div>

                  {/* Bubble */}
                  <div
                    className="rounded-2xl px-4 py-3 text-[13px] leading-relaxed"
                    style={{
                      background: m.role === 'user'
                        ? 'linear-gradient(135deg, #0c6da4, #3a9bc4)'
                        : 'rgba(255,255,255,0.07)',
                      color: '#fff',
                      border: m.role === 'assistant' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                    }}
                  >
                    {m.content.split('\n').map((line, i) => (
                      <React.Fragment key={i}>
                        {line}
                        {i < m.content.split('\n').length - 1 && <br />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
            ))}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-2.5">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
                  >
                    <span className="material-symbols-outlined text-white" style={{ fontSize: 14 }}>smart_toy</span>
                  </div>
                  <div className="rounded-2xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <div className="flex gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 pb-4">
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3 transition-shadow"
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: listening ? '1px solid rgba(74,184,206,0.55)' : '1px solid rgba(255,255,255,0.1)',
            boxShadow: listening ? '0 0 20px rgba(74,184,206,0.25)' : 'none',
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening — just talk…' : 'Ask me anything or tell me what to do...'}
            rows={1}
            className="flex-1 bg-transparent text-white text-[14px] placeholder:text-white/30 focus:outline-none resize-none"
            style={{ minHeight: 24, maxHeight: 120 }}
          />
          {voiceSupported && (
            <button
              onClick={() => (listening ? stopListening() : startListening())}
              disabled={loading}
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-30 ${listening ? 'animate-pulse' : ''}`}
              style={{
                background: listening ? 'linear-gradient(135deg, #e11d48, #f43f5e)' : 'rgba(255,255,255,0.1)',
                boxShadow: listening ? '0 0 16px rgba(244,63,94,0.5)' : 'none',
              }}
              title={listening ? 'Stop listening' : 'Tap to talk'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{listening ? 'mic' : 'mic_none'}</span>
            </button>
          )}
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 transition-all disabled:opacity-30"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
          </button>
        </div>
        <div className="text-[10px] text-white/20 text-center mt-2">
          {voiceSupported
            ? 'Tap the mic to talk, or turn on Voice Mode for a hands-free conversation — it can assign team tasks, manage your schedule, and check campaigns and content.'
            : 'Voice needs Chrome or Edge — in this browser the assistant is text-only.'}
        </div>
      </div>
    </div>
  );
}
