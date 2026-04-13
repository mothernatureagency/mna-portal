'use client';
import React, { useEffect, useState } from 'react';
import { useClient } from '@/context/ClientContext';
import { createClient } from '@/lib/supabase/client';

type ActionItem = { title: string; assignee?: 'client' | 'team'; assignedTo?: string; done?: boolean };

type MeetingNote = {
  id: string;
  client_id: string;
  meeting_date: string;
  title: string | null;
  summary: string | null;
  attendees: string | null;
  action_items: ActionItem[] | null;
  client_visible: boolean;
  created_at: string;
};

const MNA_EMAILS = ['mn@mothernatureagency.com', 'admin@mothernatureagency.com', 'info@mothernatureagency.com'];

function fmtDate(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  } catch { return iso; }
}

export default function MeetingNotesPage() {
  const ctx = useClient() as any;
  const activeClient = ctx?.activeClient;
  const { gradientFrom, gradientTo } = activeClient?.branding || { gradientFrom: '#0c6da4', gradientTo: '#4ab8ce' };

  const [notes, setNotes] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStaff, setIsStaff] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', summary: '', attendees: '', meeting_date: '' });
  const [taskCreating, setTaskCreating] = useState<Record<string, boolean>>({});

  const [newNote, setNewNote] = useState({
    meeting_date: new Date().toISOString().slice(0, 10),
    title: '',
    summary: '',
    attendees: '',
    actionItems: [{ title: '', assignee: 'team' as 'client' | 'team' }],
  });

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setIsStaff(MNA_EMAILS.includes(user?.email || ''));
    });
  }, []);

  useEffect(() => {
    if (!activeClient?.id) return;
    setLoading(true);
    fetch(`/api/meeting-notes?clientId=${encodeURIComponent(activeClient.id)}`)
      .then((r) => r.json())
      .then((d) => setNotes(d.notes || []))
      .finally(() => setLoading(false));
  }, [activeClient?.id]);

  async function createNote() {
    if (!newNote.meeting_date || !newNote.summary.trim()) {
      alert('Date and summary are required');
      return;
    }
    const actionItems = newNote.actionItems.filter((a) => a.title.trim());
    const res = await fetch('/api/meeting-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientId: activeClient.id,
        meetingDate: newNote.meeting_date,
        title: newNote.title || `${activeClient.shortName} Weekly Call`,
        summary: newNote.summary,
        attendees: newNote.attendees || null,
        actionItems: actionItems.length > 0 ? actionItems : null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Failed'); return; }
    setNotes((prev) => [data.note, ...prev]);
    setNewNote({
      meeting_date: new Date().toISOString().slice(0, 10),
      title: '',
      summary: '',
      attendees: '',
      actionItems: [{ title: '', assignee: 'team' }],
    });
    setShowAddForm(false);
    if (data.tasksCreated?.length > 0) {
      alert(`${data.tasksCreated.length} task(s) created from action items!`);
    }
  }

  async function patchNote(id: string, payload: Record<string, unknown>) {
    const res = await fetch('/api/meeting-notes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...data.note } : n)));
  }

  async function deleteNote(id: string) {
    if (!confirm('Delete this meeting note?')) return;
    await fetch(`/api/meeting-notes?id=${id}`, { method: 'DELETE' });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  async function createTaskFromItem(noteId: string, item: ActionItem) {
    setTaskCreating((p) => ({ ...p, [`${noteId}-${item.title}`]: true }));
    try {
      const note = notes.find((n) => n.id === noteId);
      await fetch('/api/client-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: activeClient.id,
          title: item.title,
          description: `From ${note?.meeting_date || 'meeting'} call${item.assignee === 'client' ? ' — waiting on client' : ' — internal task'}`,
          assignedTo: item.assignedTo || null,
        }),
      });
      alert(`Task created: "${item.title}"`);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setTaskCreating((p) => ({ ...p, [`${noteId}-${item.title}`]: false }));
    }
  }

  function startEdit(note: MeetingNote) {
    setEditingId(note.id);
    setEditDraft({
      title: note.title || '',
      summary: note.summary || '',
      attendees: note.attendees || '',
      meeting_date: note.meeting_date,
    });
  }

  async function saveEdit(id: string) {
    try {
      await patchNote(id, {
        title: editDraft.title || null,
        summary: editDraft.summary || null,
        attendees: editDraft.attendees || null,
        meeting_date: editDraft.meeting_date,
      });
      setEditingId(null);
    } catch (e: any) { alert(e.message); }
  }

  if (!activeClient) return null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>description</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Meeting Notes</h1>
          </div>
          <p className="text-white/60 mt-1">
            {activeClient.name} · {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
        </div>
        {isStaff && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            {showAddForm ? 'Cancel' : '+ New Note'}
          </button>
        )}
      </div>

      {/* Add note form */}
      {isStaff && showAddForm && (
        <div className="glass-card p-5 space-y-3">
          <div className="text-[13px] font-bold text-white">New Meeting Note</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              type="date"
              value={newNote.meeting_date}
              onChange={(e) => setNewNote({ ...newNote, meeting_date: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none"
            />
            <input
              type="text"
              placeholder={`Title (default: "${activeClient.shortName} Weekly Call")`}
              value={newNote.title}
              onChange={(e) => setNewNote({ ...newNote, title: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
            />
            <input
              type="text"
              placeholder="Attendees (e.g. Alexus, Jennifer)"
              value={newNote.attendees}
              onChange={(e) => setNewNote({ ...newNote, attendees: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
            />
          </div>
          <textarea
            placeholder="Meeting summary / key notes..."
            value={newNote.summary}
            onChange={(e) => setNewNote({ ...newNote, summary: e.target.value })}
            rows={6}
            className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
          />

          {/* Action items */}
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Action Items (optional — auto-creates tasks)</div>
            {newNote.actionItems.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Task title..."
                  value={item.title}
                  onChange={(e) => {
                    const items = [...newNote.actionItems];
                    items[i] = { ...items[i], title: e.target.value };
                    setNewNote({ ...newNote, actionItems: items });
                  }}
                  className="flex-1 text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30"
                />
                <select
                  value={item.assignee}
                  onChange={(e) => {
                    const items = [...newNote.actionItems];
                    items[i] = { ...items[i], assignee: e.target.value as 'client' | 'team' };
                    setNewNote({ ...newNote, actionItems: items });
                  }}
                  className="text-[12px] px-3 py-2 rounded-lg bg-white/5 border border-white/15 text-white outline-none w-28"
                >
                  <option value="team">Team</option>
                  <option value="client">Client</option>
                </select>
                <button
                  onClick={() => {
                    const items = newNote.actionItems.filter((_, j) => j !== i);
                    setNewNote({ ...newNote, actionItems: items.length ? items : [{ title: '', assignee: 'team' }] });
                  }}
                  className="text-white/30 hover:text-red-400"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
                </button>
              </div>
            ))}
            <button
              onClick={() => setNewNote({ ...newNote, actionItems: [...newNote.actionItems, { title: '', assignee: 'team' }] })}
              className="text-[11px] text-white/50 hover:text-white/80 font-semibold"
            >
              + Add action item
            </button>
          </div>

          <button
            onClick={createNote}
            className="text-[12px] font-bold px-5 py-2 rounded-xl text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}
          >
            Save Note
          </button>
        </div>
      )}

      {/* Push to client controls */}
      {isStaff && notes.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm flex items-center gap-2">
              <span className="material-symbols-outlined" style={{ fontSize: 18 }}>send</span>
              Client Visibility
            </div>
            <div className="text-white/60 text-xs">
              {notes.filter((n) => n.client_visible).length} of {notes.length} notes visible to client.
            </div>
          </div>
        </div>
      )}

      {loading && <div className="text-white/50 text-center py-8">Loading notes...</div>}

      {!loading && notes.length === 0 && (
        <div className="glass-card p-12 flex flex-col items-center text-center gap-4">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white"
            style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28 }}>description</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">No meeting notes yet</h2>
            <p className="text-white/50 text-sm mt-1">Add notes from your weekly calls to keep everything in one place.</p>
          </div>
        </div>
      )}

      {/* Notes list */}
      <div className="space-y-4">
        {notes.map((note) => {
          const isExpanded = expanded[note.id];
          const isEditing = editingId === note.id;
          const actionItems = Array.isArray(note.action_items) ? note.action_items : [];

          return (
            <div key={note.id} className="glass-card overflow-hidden">
              {/* Header */}
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-white/5 transition-colors"
                onClick={() => setExpanded((e) => ({ ...e, [note.id]: !e[note.id] }))}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `linear-gradient(135deg, ${gradientFrom}40, ${gradientTo}40)` }}>
                  <span className="material-symbols-outlined text-white/80" style={{ fontSize: 20 }}>event_note</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[14px] font-bold text-white truncate">{note.title || 'Meeting Notes'}</span>
                    {note.client_visible ? (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300">Shared with client</span>
                    ) : (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/40">Internal only</span>
                    )}
                    {actionItems.length > 0 && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        {actionItems.length} action item{actionItems.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-white/50 mt-0.5">
                    {fmtDate(note.meeting_date)}
                    {note.attendees && ` · ${note.attendees}`}
                  </div>
                </div>
                <span className="material-symbols-outlined text-white/30" style={{ fontSize: 20, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                  expand_more
                </span>
              </div>

              {/* Expanded body */}
              {isExpanded && (
                <div className="border-t border-white/10 p-4 space-y-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <input type="date" value={editDraft.meeting_date}
                          onChange={(e) => setEditDraft({ ...editDraft, meeting_date: e.target.value })}
                          className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
                        <input type="text" value={editDraft.title} placeholder="Title..."
                          onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                          className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
                        <input type="text" value={editDraft.attendees} placeholder="Attendees..."
                          onChange={(e) => setEditDraft({ ...editDraft, attendees: e.target.value })}
                          className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
                      </div>
                      <textarea value={editDraft.summary}
                        onChange={(e) => setEditDraft({ ...editDraft, summary: e.target.value })}
                        rows={8}
                        className="w-full text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none" />
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(note.id)}
                          className="text-[11px] font-bold px-4 py-1.5 rounded-lg text-white"
                          style={{ background: `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})` }}>Save</button>
                        <button onClick={() => setEditingId(null)}
                          className="text-[11px] font-semibold px-4 py-1.5 rounded-lg bg-white/10 text-white/60">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Summary */}
                      {note.summary && (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Summary</div>
                          <div className="text-[12px] text-white/80 whitespace-pre-wrap bg-white/5 rounded-xl p-4 border border-white/10 leading-relaxed">
                            {note.summary}
                          </div>
                        </div>
                      )}

                      {/* Action items */}
                      {actionItems.length > 0 && (
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wider text-white/50 mb-2">Action Items</div>
                          <div className="space-y-2">
                            {actionItems.map((item, i) => (
                              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${item.assignee === 'client' ? 'bg-amber-400' : 'bg-sky-400'}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[12px] text-white font-medium">{item.title}</div>
                                  <div className="text-[10px] text-white/40">
                                    {item.assignee === 'client' ? 'Client action' : 'Team action'}
                                  </div>
                                </div>
                                {isStaff && (
                                  <button
                                    onClick={() => createTaskFromItem(note.id, item)}
                                    disabled={taskCreating[`${note.id}-${item.title}`]}
                                    className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-white/10 text-white/60 hover:bg-white/15 hover:text-white disabled:opacity-50 shrink-0"
                                  >
                                    {taskCreating[`${note.id}-${item.title}`] ? 'Creating...' : '→ Create task'}
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Staff actions */}
                      {isStaff && (
                        <div className="flex gap-2 flex-wrap pt-2 border-t border-white/10">
                          <button onClick={() => startEdit(note)}
                            className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/10 text-white/70 hover:bg-white/15">
                            Edit
                          </button>
                          <button
                            onClick={() => patchNote(note.id, { client_visible: !note.client_visible })}
                            className={`text-[11px] font-semibold px-3 py-2 rounded-lg ${
                              note.client_visible
                                ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                : 'bg-white/10 text-white/50 hover:bg-white/15'
                            }`}>
                            {note.client_visible ? '✓ Shared with client' : 'Share with client'}
                          </button>
                          <button onClick={() => deleteNote(note.id)}
                            className="text-[11px] font-semibold px-3 py-2 rounded-lg bg-white/5 text-white/30 hover:bg-red-500/20 hover:text-red-300 ml-auto">
                            Delete
                          </button>
                        </div>
                      )}
                    </>
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
