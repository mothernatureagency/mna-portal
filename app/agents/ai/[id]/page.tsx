'use client';
import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { getAgent } from '@/lib/agents/config';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function AgentChatPage() {
  const params = useParams<{ id: string }>();
  const agent = getAgent(params.id);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  if (!agent) return notFound();

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent!.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setMessages((m) => [...m, { role: 'assistant', content: data.reply }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `⚠️ ${e.message}` }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agents/ai" className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Agents
        </Link>
        <div className="flex-1" />
      </div>

      <div className="glass-card p-5 flex items-center gap-4">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
        >
          <span className="material-symbols-outlined text-white" style={{ fontSize: 28 }}>{agent.icon}</span>
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-white">{agent.name}</div>
          <div className="text-white/60 text-sm">{agent.description}</div>
        </div>
        <span className="inline-flex items-center gap-1.5 text-xs text-white/70">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" /> Online
        </span>
      </div>

      {/* Chat */}
      <div className="glass-card flex-1 flex flex-col min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          {messages.length === 0 && (
            <div className="flex flex-col gap-3">
              <div className="text-white/70 text-sm">Try asking:</div>
              {agent.suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left rounded-xl px-4 py-3 text-white/90 text-sm border border-white/15 bg-white/5 hover:bg-white/10 transition"
                >
                  {s}
                </button>
              ))}
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed ${
                m.role === 'user'
                  ? 'self-end text-white'
                  : 'self-start text-white/90 bg-white/10 border border-white/15'
              }`}
              style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' } : undefined}
            >
              {m.content}
            </div>
          ))}
          {loading && (
            <div className="self-start text-white/60 text-sm flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              thinking…
            </div>
          )}
        </div>

        {/* Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2 p-4 border-t border-white/10"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agent.name}…`}
            className="flex-1 rounded-xl px-4 py-3 bg-white/5 border border-white/15 text-white placeholder:text-white/40 focus:outline-none focus:border-white/30"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl px-5 font-semibold text-white disabled:opacity-50"
            style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
