'use client';
import React, { useEffect, useState } from 'react';

type Contact = {
  id: string;
  name: string;
  email: string;
  role: string | null;
  contact_group: string;
  client_id: string | null;
  company: string | null;
  created_at: string;
};

const GROUPS = [
  { value: 'team', label: 'Team', color: 'bg-emerald-500/20 text-emerald-300' },
  { value: 'client', label: 'Client', color: 'bg-sky-500/20 text-sky-300' },
  { value: 'prospect', label: 'Prospect', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'vendor', label: 'Vendor', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'other', label: 'Other', color: 'bg-white/10 text-white/60' },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  const [form, setForm] = useState({
    name: '', email: '', role: '', contact_group: 'client', client_id: '', company: '',
  });

  useEffect(() => {
    fetch('/api/contacts')
      .then(r => r.json())
      .then(d => setContacts(d.contacts || []))
      .finally(() => setLoading(false));
  }, []);

  function resetForm() {
    setForm({ name: '', email: '', role: '', contact_group: 'client', client_id: '', company: '' });
    setShowAdd(false);
    setEditId(null);
  }

  async function saveContact() {
    if (!form.name || !form.email) { alert('Name and email required'); return; }

    if (editId) {
      const res = await fetch('/api/contacts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editId, ...form }),
      });
      const data = await res.json();
      if (res.ok) {
        setContacts(prev => prev.map(c => c.id === editId ? data.contact : c));
        resetForm();
      }
    } else {
      const res = await fetch('/api/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok) {
        setContacts(prev => [...prev, data.contact]);
        resetForm();
      }
    }
  }

  async function deleteContact(id: string) {
    if (!confirm('Delete this contact?')) return;
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
    setContacts(prev => prev.filter(c => c.id !== id));
  }

  function startEdit(c: Contact) {
    setForm({
      name: c.name, email: c.email, role: c.role || '',
      contact_group: c.contact_group, client_id: c.client_id || '', company: c.company || '',
    });
    setEditId(c.id);
    setShowAdd(true);
  }

  const filtered = contacts.filter(c => {
    if (filter !== 'all' && c.contact_group !== filter) return false;
    if (search) {
      const s = search.toLowerCase();
      return c.name.toLowerCase().includes(s) || c.email.toLowerCase().includes(s) || (c.company || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-white/80" style={{ fontSize: 28 }}>contacts</span>
            <h1 className="text-3xl font-bold text-white tracking-tight">Contacts</h1>
          </div>
          <p className="text-white/60 mt-1">{contacts.length} contacts</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(!showAdd); }}
          className="text-[12px] font-bold px-4 py-2 rounded-xl text-white"
          style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}
        >
          {showAdd ? 'Cancel' : '+ Add Contact'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30 w-64"
        />
        <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${filter === 'all' ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'}`}
          >
            All
          </button>
          {GROUPS.map(g => (
            <button
              key={g.value}
              onClick={() => setFilter(g.value)}
              className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${filter === g.value ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/70'}`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Add/Edit form */}
      {showAdd && (
        <div className="glass-card p-5 space-y-3">
          <div className="text-[13px] font-bold text-white mb-1">{editId ? 'Edit Contact' : 'New Contact'}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input type="text" placeholder="Full name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            <input type="email" placeholder="Email address" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            <input type="text" placeholder="Role (e.g. Owner, Manager)" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select value={form.contact_group} onChange={e => setForm({ ...form, contact_group: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none">
              {GROUPS.map(g => <option key={g.value} value={g.value}>{g.label}</option>)}
            </select>
            <input type="text" placeholder="Company (optional)" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
            <input type="text" placeholder="Client ID (e.g. prime-iv)" value={form.client_id} onChange={e => setForm({ ...form, client_id: e.target.value })}
              className="text-[12px] px-3 py-2 rounded-xl bg-white/5 border border-white/15 text-white outline-none placeholder:text-white/30" />
          </div>
          <button onClick={saveContact} className="text-[12px] font-bold px-5 py-2 rounded-xl text-white" style={{ background: 'linear-gradient(135deg, #0c6da4, #4ab8ce)' }}>
            {editId ? 'Update Contact' : 'Add Contact'}
          </button>
        </div>
      )}

      {loading && <div className="text-white/50 text-center py-8">Loading contacts...</div>}

      {/* Contact list */}
      {!loading && (
        <div className="glass-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-white/40">
              <span className="material-symbols-outlined block mb-2" style={{ fontSize: 32 }}>person_off</span>
              No contacts found
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map(c => {
                const group = GROUPS.find(g => g.value === c.contact_group) || GROUPS[4];
                return (
                  <div key={c.id} className="flex items-center gap-4 p-4 hover:bg-white/5 transition-colors">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-[14px] shrink-0"
                      style={{ background: 'rgba(255,255,255,0.1)' }}>
                      {c.name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-white">{c.name}</span>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${group.color}`}>{group.label}</span>
                        {c.role && <span className="text-[10px] text-white/40">{c.role}</span>}
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {c.email}
                        {c.company && <span> · {c.company}</span>}
                        {c.client_id && <span className="text-[10px] text-sky-400/60"> · {c.client_id}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startEdit(c)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                      </button>
                      <button onClick={() => deleteContact(c.id)} className="w-8 h-8 rounded-lg flex items-center justify-center text-white/30 hover:text-rose-300 hover:bg-rose-500/10 transition-colors">
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
