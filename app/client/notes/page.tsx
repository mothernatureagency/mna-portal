'use client';
import React, { useEffect, useState } from 'react';
import { useClientPortal } from '@/components/client-portal/ClientPortalContext';

export const dynamic = 'force-dynamic';

type ActionItem = { title: string; assignee?: 'client' | 'team'; done?: boolean };

type MeetingNote = {
  id: string;
  meeting_date: string;
  title: string | null;
  summary: string | null;
  attendees: string | null;
  action_items: ActionItem[] | null;
  created_at: string;
};

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export default function ClientNotesPage() {
  const { client } = useClientPortal();
  const { gradientFrom, gradientTo } = client.branding;
  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setLoading(true);
    fetch(`/api/meeting-notes?clientId=${encodeURIComponent(client.id)}&visible=1`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .finally(() => setLoading(false));
  }, [client.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-6 rounded-full" style={{ background: `linear-gradient(180deg, ${gradientFrom}, ${gradientTo})` }} />
          <h1 className="text-[22px] font-extrabold text-white tracking-tight">Meeting Notes</h1>
        </div>
        <p className="text-[12px] text-white/60 pl-3.5">
          Summaries and action items from our weekly calls.
        </p>
      </div>

      {loading && <div className="text-white/40 text-center py-8 text-[13px]">Loading notes...</div>}

      {!loading && notes.length === 0 && (
        <div className="glass-card p-10 text-center">
          <div className="text-[14px] font-semibold text-white/60">No meeting notes shared yet</div>
          <div className="text-[12px] text-white/40 mt-1">Your team will share call summaries and action items here.</div>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-4">
        {notes.map((note) => {
          const isExpanded = expanded[note.id];
          const actionItems = Array.isArray(note.action_items) ? note.action_items : [];
          const clientItems = actionItems.filter((a) => a.assignee === 'client');

          return (
            <div key={note.id} className="glass-card overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [note.id]: !e[note.id] }))}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}40, ${gradientTo}40)` }}>
                  <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>event_note</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold text-white truncate">{note.title || 'Meeting Notes'}</span>
                    {clientItems.length > 0 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        {clientItems.length} item{clientItems.length !== 1 ? 's' : ''} for you
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {fmtDate(note.meeting_date)}
                    {note.attendees && ` · ${note.attendees}`}
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 18, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  expand_more
                </span>
              </div>

              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  {note.summary && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Summary</div>
                      <div className="text-[12px] text-white/80 whitespace-pre-wrap bg-white/5 rounded-xl p-4 border border-white/10 leading-relaxed">
                        {note.summary}
                      </div>
                    </div>
                  )}

                  {actionItems.length > 0 && (
                    <div>
                      <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Action Items</div>
                      <div className="space-y-2">
                        {actionItems.map((item, i) => (
                          <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                            item.assignee === 'client'
                              ? 'bg-amber-500/10 border-amber-500/20'
                              : 'bg-white/5 border-white/10'
                          }`}>
                            <span className={`w-2 h-2 rounded-full shrink-0 ${item.assignee === 'client' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                            <div className="flex-1">
                              <div className="text-[12px] text-white font-medium">{item.title}</div>
                              <div className="text-[10px] text-white/40">
                                {item.assignee === 'client' ? 'Your action item' : 'Team handling this'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
