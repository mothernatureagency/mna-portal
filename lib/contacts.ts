/**
 * Contact directory for meeting attendees.
 * Combines team members, client contacts, and known emails.
 */

export type Contact = {
  name: string;
  email: string;
  role: string;
  group: 'team' | 'client';
  clientId?: string;
};

export const CONTACTS: Contact[] = [
  // ── MNA Team ──
  { name: 'Alexus Williams', email: 'mn@mothernatureagency.com', role: 'Owner', group: 'team' },
  { name: 'Sable', email: 'admin@mothernatureagency.com', role: 'Social Media', group: 'team' },
  { name: 'Vanessa', email: 'info@mothernatureagency.com', role: 'Manager', group: 'team' },

  // ── Client Contacts ──
  { name: 'Justin Kulkusky', email: 'jkulkusky@primeivhydration.com', role: 'Owner', group: 'client', clientId: 'prime-iv' },
  { name: 'Jennifer Burlison', email: 'niceville@primeivhydration.com', role: 'Admin', group: 'client', clientId: 'prime-iv' },
];

/**
 * Resolve attendee names/emails from a comma-separated string.
 * Matches against the contacts directory by name (case-insensitive) or email.
 * Returns an array of { name, email } for Google Calendar invites.
 */
export function resolveAttendees(input: string): { name: string; email: string }[] {
  if (!input || !input.trim()) return [];

  const parts = input.split(',').map(s => s.trim()).filter(Boolean);
  const resolved: { name: string; email: string }[] = [];

  for (const part of parts) {
    // Check if it's an email address
    if (part.includes('@')) {
      const contact = CONTACTS.find(c => c.email.toLowerCase() === part.toLowerCase());
      resolved.push({
        name: contact?.name || part.split('@')[0],
        email: part.toLowerCase(),
      });
      continue;
    }

    // Match by name (case-insensitive, partial match)
    const lower = part.toLowerCase();
    const match = CONTACTS.find(c =>
      c.name.toLowerCase() === lower ||
      c.name.toLowerCase().includes(lower) ||
      c.name.split(' ')[0].toLowerCase() === lower
    );

    if (match) {
      resolved.push({ name: match.name, email: match.email });
    } else {
      // Keep as-is if no match (user can manually add emails later)
      resolved.push({ name: part, email: '' });
    }
  }

  return resolved;
}

/**
 * Get contacts filtered by group or client.
 */
export function getContactsByGroup(group?: 'team' | 'client', clientId?: string): Contact[] {
  let filtered = CONTACTS;
  if (group) filtered = filtered.filter(c => c.group === group);
  if (clientId) filtered = filtered.filter(c => !c.clientId || c.clientId === clientId);
  return filtered;
}
