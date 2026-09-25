/**
 * Minimal GoHighLevel v2 API client (works with Revive white-label — same
 * API surface at services.leadconnectorhq.com, authorized per-location with
 * Private Integration tokens).
 *
 * Required Private Integration scopes per location:
 *   contacts.readonly, conversations.readonly, conversations/message.readonly,
 *   conversations/message.write
 *
 * All calls take the location's decrypted token — never a shared agency key —
 * so tenant isolation is enforced by GHL itself on top of our own scoping.
 */

const BASE = 'https://services.leadconnectorhq.com';

export class GhlError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function ghlFetch<T = any>(
  token: string,
  path: string,
  opts: { method?: string; version?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      Version: opts.version || '2021-04-15',
      Accept: 'application/json',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // Never include the token in the error; text is the API's response body.
    throw new GhlError(`GHL ${opts.method || 'GET'} ${path} → ${res.status}: ${text.slice(0, 300)}`, res.status);
  }
  return res.json() as Promise<T>;
}

export type GhlContact = {
  id: string;
  firstName?: string;
  lastName?: string;
  name?: string;
  phone?: string;
  email?: string;
  dnd?: boolean;
  dndSettings?: Record<string, { status?: string }>;
  tags?: string[];
};

export type GhlMessage = {
  id: string;
  direction: 'inbound' | 'outbound';
  type?: number;
  messageType?: string;
  body?: string;
  dateAdded?: string;
  status?: string;
  contactId?: string;
  conversationId?: string;
};

export async function getContact(token: string, contactId: string): Promise<GhlContact | null> {
  try {
    const data = await ghlFetch<{ contact: GhlContact }>(token, `/contacts/${contactId}`, {
      version: '2021-07-28',
    });
    return data.contact || null;
  } catch (e) {
    if (e instanceof GhlError && e.status === 404) return null;
    throw e;
  }
}

/** SMS opt-out check: global DND or SMS-channel DND. */
export function contactOptedOut(contact: GhlContact | null): boolean {
  if (!contact) return false;
  if (contact.dnd) return true;
  const sms = contact.dndSettings?.SMS;
  return !!sms && (sms.status || '').toLowerCase() === 'active';
}

export async function searchConversations(
  token: string,
  locationId: string,
  params: { contactId?: string; limit?: number } = {},
): Promise<Array<{ id: string; contactId: string; lastMessageDirection?: string; lastMessageDate?: number; unreadCount?: number }>> {
  const qs = new URLSearchParams({ locationId, limit: String(params.limit || 20) });
  if (params.contactId) qs.set('contactId', params.contactId);
  qs.set('sortBy', 'last_message_date');
  qs.set('sort', 'desc');
  const data = await ghlFetch<{ conversations: any[] }>(token, `/conversations/search?${qs.toString()}`);
  return data.conversations || [];
}

/** Recent messages for a conversation, oldest → newest. */
export async function getConversationMessages(
  token: string,
  conversationId: string,
  limit = 25,
): Promise<GhlMessage[]> {
  const data = await ghlFetch<{ messages: { messages: GhlMessage[] } | GhlMessage[] }>(
    token,
    `/conversations/${conversationId}/messages?limit=${limit}`,
  );
  const raw: GhlMessage[] = Array.isArray((data.messages as any)?.messages)
    ? (data.messages as any).messages
    : Array.isArray(data.messages)
      ? (data.messages as GhlMessage[])
      : [];
  // API returns newest first; flip so transcripts read top-down.
  return raw.slice().reverse();
}

/**
 * Send an outbound message through the location's own subaccount so it comes
 * from the client's existing phone number.
 */
export async function sendMessage(
  token: string,
  params: { contactId: string; message: string; type?: 'SMS' | 'Email' | 'Live_Chat' },
): Promise<{ messageId?: string; conversationId?: string }> {
  const data = await ghlFetch<{ messageId?: string; conversationId?: string }>(
    token,
    `/conversations/messages`,
    {
      method: 'POST',
      body: {
        type: params.type || 'SMS',
        contactId: params.contactId,
        message: params.message,
      },
    },
  );
  return data;
}

// ── Calendars (requires calendars.readonly, calendars/events.readonly,
//    calendars/events.write on the Private Integration) ────────────────────

export async function listCalendars(
  token: string,
  locationId: string,
): Promise<Array<{ id: string; name: string; isActive?: boolean }>> {
  const data = await ghlFetch<{ calendars: any[] }>(token, `/calendars/?locationId=${encodeURIComponent(locationId)}`);
  return (data.calendars || []).map((c) => ({ id: c.id, name: c.name, isActive: c.isActive }));
}

/**
 * Real availability for a calendar between two times. Returns ISO slot start
 * strings (with the calendar's own UTC offset), flattened across days.
 */
export async function getFreeSlots(
  token: string,
  calendarId: string,
  startMs: number,
  endMs: number,
  timezone?: string,
): Promise<string[]> {
  const qs = new URLSearchParams({ startDate: String(startMs), endDate: String(endMs) });
  if (timezone) qs.set('timezone', timezone);
  const data = await ghlFetch<Record<string, any>>(token, `/calendars/${calendarId}/free-slots?${qs.toString()}`);
  const slots: string[] = [];
  for (const [key, val] of Object.entries(data || {})) {
    if (key === 'traceId') continue;
    if (Array.isArray((val as any)?.slots)) slots.push(...(val as any).slots);
  }
  return slots.sort();
}

export async function createAppointment(
  token: string,
  params: {
    calendarId: string;
    locationId: string;
    contactId: string;
    startTime: string; // ISO with offset, must be a returned free slot
    title?: string;
  },
): Promise<{ id?: string }> {
  const data = await ghlFetch<{ id?: string; event?: { id?: string } }>(token, `/calendars/events/appointments`, {
    method: 'POST',
    body: {
      calendarId: params.calendarId,
      locationId: params.locationId,
      contactId: params.contactId,
      startTime: params.startTime,
      title: params.title,
      appointmentStatus: 'confirmed',
    },
  });
  return { id: data.id || data.event?.id };
}

/** Hour+minute of an ISO timestamp in a given IANA timezone, as "HH:MM". */
export function localTimeOfDay(iso: string, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: timezone,
    });
    return fmt.format(new Date(iso)).replace(/^24/, '00');
  } catch {
    return '00:00';
  }
}
