import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * POST /api/meeting-notes
 *
 * Receives parsed Google Meet AI summary data from Make.com.
 * Automatically creates tasks in client_requests for any action items found.
 *
 * Body:
 * {
 *   clientId: "prime-iv",
 *   meetingDate: "2026-04-09",
 *   summary: "Full meeting summary text",
 *   actionItems: [
 *     { title: "Approve April content calendar", assignee?: "client" },
 *     { title: "Create graphic for Spring Reset promo", assignee?: "team" }
 *   ],
 *   attendees?: ["alexus@...", "jennifer@..."]
 * }
 *
 * - Items with assignee "client" go into client_requests (MNA asking client)
 * - Items with assignee "team" go into client_requests with clientId "mna" (internal tasks)
 * - Default assignee is "team" if not specified
 */

export async function POST(req: NextRequest) {
  await ensureSchema();

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { clientId, meetingDate, summary, actionItems, attendees } = body || {};
  if (!clientId || !actionItems || !Array.isArray(actionItems)) {
    return NextResponse.json({ error: 'clientId and actionItems[] required' }, { status: 400 });
  }

  // Store the meeting summary
  await query(
    `INSERT INTO client_kv (client_id, key, value, updated_at)
     VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (client_id, key)
     DO UPDATE SET value = client_kv.value || $3::jsonb, updated_at = now()`,
    [
      clientId,
      'meeting_notes',
      JSON.stringify([{ date: meetingDate || new Date().toISOString().slice(0, 10), summary: summary || '', attendees: attendees || [], actionItems }]),
    ],
  );

  // Create tasks from action items
  const created: any[] = [];
  for (const item of actionItems) {
    if (!item.title) continue;
    const assignee = item.assignee || 'team';
    const targetClientId = assignee === 'client' ? clientId : 'mna';
    const description = `From ${meetingDate || 'meeting'} call${assignee === 'client' ? ' — waiting on client' : ' — internal task'}`;

    const { rows } = await query(
      `INSERT INTO client_requests (client_id, title, description) VALUES ($1, $2, $3) RETURNING *`,
      [targetClientId, item.title, description],
    );
    created.push({ ...rows[0], assignee });
  }

  return NextResponse.json({ ok: true, tasksCreated: created.length, tasks: created });
}

/**
 * GET /api/meeting-notes?clientId=prime-iv
 * Returns stored meeting notes/summaries for the client.
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  const { rows } = await query(
    `SELECT value FROM client_kv WHERE client_id = $1 AND key = 'meeting_notes'`,
    [clientId],
  );

  return NextResponse.json({ notes: rows[0]?.value || [] });
}

/**
 * GET /api/meeting-notes?type=weekly-summary&clientId=prime-iv
 * Returns a structured weekly summary for the follow-up email.
 * Includes: content calendar status, open tasks, recent meeting notes.
 */
