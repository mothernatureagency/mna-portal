/**
 * Contact directory for meeting attendees.
 * DB-backed — reads from the contacts table.
 * Falls back to hardcoded defaults if DB is unavailable.
 */

import { query } from './db';

export type Contact = {
  id?: string;
  name: string;
  email: string;
  role: string;
  group: 'team' | 'client';
  clientId?: string;
  company?: string;
};

// Hardcoded fallback in case DB isn't available
const FALLBACK_CONTACTS: Contact[] = [
  { name: 'Alexus Williams', email: 'mn@mothernatureagency.com', role: 'Owner', group: 'team' },
  { name: 'Sable', email: 'admin@mothernatureagency.com', role: 'Social Media', group: 'team' },
  { name: 'Vanessa', email: 'info@mothernatureagency.com', role: 'Manager', group: 'team' },
  { name: 'Justin Kulkusky', email: 'jkulkusky@primeivhydration.com', role: 'Owner', group: 'client', clientId: 'prime-iv' },
  { name: 'Jennifer Burlison', email: 'niceville@primeivhydration.com', role: 'Admin', group: 'client', clientId: 'prime-iv' },
];

/**
 * Fetch all contacts from the database.
 */
export async function getAllContacts(): Promise<Contact[]> {
  try {
    const { rows } = await query('SELECT * FROM contacts ORDER BY contact_group ASC, name ASC', []);
    return rows.map((r: any) => ({
      id: r.id,
      name: r.name,
      email: r.email,
      role: r.role || '',
      group: r.contact_group || 'client',
      clientId: r.client_id || undefined,
      company: r.company || undefined,
    }));
  } catch {
    return FALLBACK_CONTACTS;
  }
}

/**
 * Resolve attendee names/emails from a comma-separated string.
 * Matches against the contacts directory by name (case-insensitive) or email.
 */
export async function resolveAttendees(input: string): Promise<{ name: string; email: string }[]> {
  if (!input || !input.trim()) return [];

  const contacts = await getAllContacts();
  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  const resolved: { name: string; email: string }[] = [];

  for (const part of parts) {
    // Check if it's an email address
    if (part.includes('@')) {
      const contact = contacts.find(c => c.email.toLowerCase() === part.toLowerCase());
      resolved.push({
        name: contact?.name || part.split('@')[0],
        email: part.toLowerCase(),
      });
      continue;
    }

    // Match by name (case-insensitive, partial match)
    const lower = part.toLowerCase();
    const match = contacts.find(c =>
      c.name.toLowerCase() === lower ||
      c.name.toLowerCase().includes(lower) ||
      c.name.split(' ')[0].toLowerCase() === lower
    );

    if (match) {
      resolved.push({ name: match.name, email: match.email });
    } else {
      // Keep as-is if no match (user typed a raw name)
      resolved.push({ name: part, email: '' });
    }
  }

  return resolved;
}

/**
 * Get contacts formatted for the AI assistant system prompt.
 */
export async function getContactsForPrompt(): Promise<string> {
  const contacts = await getAllContacts();
  if (contacts.length === 0) return 'No contacts in directory yet.';
  return contacts.map(c =>
    `- ${c.name} (${c.email}) — ${c.role}${c.clientId ? ` [${c.clientId}]` : ''}${c.company ? ` @ ${c.company}` : ''}`
  ).join('\n');
}

/**
 * Get contacts filtered by group or client.
 */
export async function getContactsByGroup(group?: 'team' | 'client', clientId?: string): Promise<Contact[]> {
  const all = await getAllContacts();
  let filtered = all;
  if (group) filtered = filtered.filter(c => c.group === group);
  if (clientId) filtered = filtered.filter(c => !c.clientId || c.clientId === clientId);
  return filtered;
}
