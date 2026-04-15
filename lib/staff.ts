/**
 * Staff directory + client assignments.
 * Single source of truth for "who works on which clients".
 *
 * Emails are matched case-insensitively. Alexus (owner) implicitly sees
 * every client — she's intentionally NOT listed in STAFF_ASSIGNMENTS so the
 * "filter to my clients" logic falls through to "show everything" for her.
 */

export type StaffMember = {
  email: string;
  name: string;
  role: string;
  /** Client ids (from lib/clients.ts) that this person actively works on. */
  assignedClients: string[];
};

export const STAFF: StaffMember[] = [
  {
    email: 'mn@mothernatureagency.com',
    name: 'Alexus Williams',
    role: 'Owner',
    // Owner — handled separately so she always sees the full portfolio.
    assignedClients: ['prime-iv', 'serenity-bayfront', 'prime-iv-pinecrest', 'mna-realty'],
  },
  {
    email: 'admin@mothernatureagency.com',
    name: 'Sable',
    role: 'Social Media',
    // Sable focuses on social / content — the two most content-heavy accounts.
    assignedClients: ['prime-iv', 'serenity-bayfront'],
  },
  {
    email: 'info@mothernatureagency.com',
    name: 'Vanessa',
    role: 'Manager',
    // Vanessa manages ops / ads — the two accounts with live ad spend.
    assignedClients: ['prime-iv', 'mna-realty'],
  },
];

export function getStaffByEmail(email: string | null | undefined): StaffMember | null {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  return STAFF.find((s) => s.email.toLowerCase() === normalized) || null;
}

/** True if this email is MNA staff (as opposed to a client portal user). */
export function isMNAStaff(email: string | null | undefined): boolean {
  return !!getStaffByEmail(email);
}

/** True if this email is the owner (sees everything). */
export function isOwner(email: string | null | undefined): boolean {
  return (email || '').toLowerCase() === 'mn@mothernatureagency.com';
}

/**
 * Return the list of client ids a given user should see in the business
 * overview. Owner → all clients. Other staff → their assignedClients.
 * Unknown email → empty array.
 */
export function getAssignedClientIds(email: string | null | undefined): string[] {
  if (isOwner(email)) {
    return STAFF[0].assignedClients; // full list
  }
  const member = getStaffByEmail(email);
  return member?.assignedClients || [];
}
