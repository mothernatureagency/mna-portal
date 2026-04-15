'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { getAgent } from '@/lib/agents/config';
import { useClient } from '@/context/ClientContext';
import { getPlaybooksForClient } from '@/lib/agents/playbooks';
import { VoiceButton } from '@/components/ai/VoiceButton';
import { speak, cancelSpeak } from '@/lib/voice';

type Msg = { role: 'user' | 'assistant'; content: string };

function extractJsonArray(text: string): any[] | null {
  const match = text.match(/```json\s*([\s\S]*?)\s*```/i);
  const raw = match ? match[1] : null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export default function AgentChatPage() {
  const params = useParams<{ id: string }>();
  const agent = getAgent(params.id);
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [voiceReply, setVoiceReply] = useState(true);           // auto speak assistant replies
  const voicePendingRef = useRef(false);                        // did user ask by voice?
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get playbooks available for the active client
  const clientPlaybooks = useMemo(
    () => (activeClient?.id ? getPlaybooksForClient(activeClient.id) : []),
    [activeClient?.id],
  );

  // ── Save AI-generated calendar to content tracker + client calendar ──
  async function savePlanToTracker(items: any[]) {
    if (!activeClient?.name) {
      setSaveStatus('No active client selected — pick one from the sidebar first.');
      return;
    }
    setSaveStatus(`Saving ${items.length} posts to ${activeClient.name}…`);
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientName: activeClient.name, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setSaveStatus(
        `Saved ${data.count} posts to ${activeClient.name}. ` +
        `They are now in the Content Tracker and the client's calendar for approval.`
      );
    } catch (e: any) {
      setSaveStatus(`Error: ${e.message}`);
    }
  }

  // ── Apply a playbook for the active client ──────────────────────────
  async function applyPlaybook(playbookId: string, playbookName: string) {
    if (!activeClient?.name) {
      setSaveStatus('No active client selected — pick one from the sidebar first.');
      return;
    }
    setSaveStatus(`Loading "${playbookName}" for ${activeClient.name}…`);
    try {
      const res = await fetch('/api/content-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientName: activeClient.name,
          playbookId,
          startDate: new Date().toISOString().slice(0, 10),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Playbook failed');
      setSaveStatus(
        `Loaded ${data.count} posts from "${playbookName}" into ${activeClient.name}. ` +
        `Posts with captions are ready for client review; others are in drafting.`
      );
    } catch (e: any) {
      setSaveStatus(`Error: ${e.message}`);
    }
  }

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
      // If the user spoke their question, speak the reply back.
      if (voicePendingRef.current && voiceReply && data.reply) {
        // Strip code blocks before speaking — they sound awful read aloud.
        const spoken = String(data.reply).replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
        if (spoken) speak(spoken);
      }
      voicePendingRef.current = false;
    } catch (e: any) {
      setMessages((m) => [...m, { role: 'assistant', content: `Error: ${e.message}` }]);
      voicePendingRef.current = false;
    } finally {
      setLoading(false);
    }
  }

  // Called by the mic button once the user finishes a voice command.
  function handleVoiceInput(text: string) {
    voicePendingRef.current = true;
    send(text);
  }

  return (
    <div className="flex flex-col gap-5 h-[calc(100vh-140px)]">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/agents/ai" className="text-white/60 hover:text-white flex items-center gap-1 text-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span> Agents
        </Link>
        <div className="flex-1" />
        {activeClient && (
          <div className="flex items-center gap-2 text-[11px] text-white/50">
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>business</span>
            Working on: <span className="font-semibold text-white/80">{activeClient.name}</span>
          </div>
        )}
        <button
          type="button"
          onClick={() => { setVoiceReply((v) => !v); if (voiceReply) cancelSpeak(); }}
          title={voiceReply ? 'Voice replies on — click to mute' : 'Voice replies off — click to enable'}
          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium flex items-center gap-1.5 border ${
            voiceReply
              ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
              : 'bg-white/5 border-white/15 text-white/60 hover:bg-white/10'
          }`}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            {voiceReply ? 'volume_up' : 'volume_off'}
          </span>
          Voice {voiceReply ? 'on' : 'off'}
        </button>
      </div>

      {saveStatus && (
        <div className={`glass-card p-3 text-sm ${
          saveStatus.startsWith('Error') ? 'text-rose-300' : 'text-white/90'
        }`}>
          {saveStatus}
        </div>
      )}

      {/* Playbook cards — dynamic per active client */}
      {agent.id === 'content-calendar' && clientPlaybooks.length > 0 && (
        <div className="space-y-2">
          {clientPlaybooks.map((pb) => (
            <div key={pb.id} className="glass-card p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-white font-semibold text-sm">{pb.name}</div>
                <div className="text-white/60 text-xs">{pb.description}</div>
              </div>
              <button
                onClick={() => applyPlaybook(pb.id, pb.name)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-white shrink-0"
                style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
              >
                Load into {activeClient?.shortName || activeClient?.name || 'Client'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* No client selected warning */}
      {agent.id === 'content-calendar' && !activeClient && (
        <div className="glass-card p-4 flex items-center gap-3 border-amber-400/30">
          <span className="material-symbols-outlined text-amber-400" style={{ fontSize: 20 }}>warning</span>
          <div className="text-[12px] text-white/70">
            Select a client from the sidebar to load playbooks or save content calendars.
          </div>
        </div>
      )}

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
          {messages.map((m, i) => {
            const plan = m.role === 'assistant' ? extractJsonArray(m.content) : null;
            return (
              <div
                key={i}
                className={`rounded-2xl px-4 py-3 max-w-[85%] text-sm whitespace-pre-wrap leading-relaxed ${
                  m.role === 'user'
                    ? 'self-end text-white'
                    : 'self-start text-white/90 bg-white/10 border border-white/15'
                }`}
                style={m.role === 'user' ? { background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' } : undefined}
              >
                <div>{m.content}</div>
                {plan && activeClient && (
                  <button
                    onClick={() => savePlanToTracker(plan)}
                    className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#0c6da4,#4ab8ce)' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>save</span>
                    Save {plan.length} posts to {activeClient.shortName || activeClient.name}
                  </button>
                )}
                {plan && !activeClient && (
                  <div className="mt-3 text-[11px] text-amber-300">
                    Select a client from the sidebar to save these posts.
                  </div>
                )}
              </div>
            );
          })}
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
          className="flex gap-2 p-4 border-t border-white/10 items-center"
        >
          <VoiceButton onTranscript={handleVoiceInput} />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Message ${agent.name} or tap the mic…`}
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
