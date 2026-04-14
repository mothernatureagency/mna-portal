'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
};

const SUGGESTIONS = [
  "What's on my schedule today?",
  "Add a meeting with Prime IV tomorrow at 10am",
  "What campaigns are pending review?",
  "Remember that Pinecrest reopening is May 1st",
  "What content needs approval this week?",
  "Add a task: review Serenity photos by Friday",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email || '');
    });
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

  async function send(text?: string) {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: msg,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setLoading(true);

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: userEmail,
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await res.json();

      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.reply || data.error || 'Something went wrong.',
        timestamp: new Date(),
      };

      setMessages([...newMessages, assistantMsg]);
    } catch {
      setMessages([
        ...newMessages,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: 'Sorry, I had trouble connecting. Try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const greeting = userEmail ? userEmail.split('@')[0].split('.')[0] : '';
  const greetingName = greeting.charAt(0).toUpperCase() + greeting.slice(1);
  const hour = new Date().getHours();
  const timeGreeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="max-w-[900px] mx-auto flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <div className="shrink-0 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
          >
            <span className="material-symbols-outlined text-white" style={{ fontSize: 22 }}>smart_toy</span>
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold text-white tracking-tight">MNA Assistant</h1>
            <p className="text-[12px] text-white/40">Your personal AI assistant</p>
          </div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto rounded-2xl mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
        {messages.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full px-6 py-12">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
            >
              <span className="material-symbols-outlined text-white" style={{ fontSize: 32 }}>smart_toy</span>
            </div>
            <h2 className="text-white text-[18px] font-bold mb-1">{timeGreeting}{greetingName ? `, ${greetingName}` : ''}</h2>
            <p className="text-white/40 text-[13px] mb-8 text-center max-w-md">
              I can manage your schedule, track campaigns, remember important details, and help you stay on top of everything.
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
          className="flex items-end gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask me anything or tell me what to do..."
            rows={1}
            className="flex-1 bg-transparent text-white text-[14px] placeholder:text-white/30 focus:outline-none resize-none"
            style={{ minHeight: 24, maxHeight: 120 }}
          />
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
          MNA Assistant can manage your schedule, remember things, and check your campaigns and content.
        </div>
      </div>
    </div>
  );
}
