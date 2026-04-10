import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';

/**
 * GET /api/weekly-summary?clientId=prime-iv
 *
 * Returns a structured weekly summary for generating follow-up emails.
 * Called by Make.com on a weekly schedule to build the recap email.
 *
 * Response includes:
 * - Content calendar status (pending review, approved, scheduled counts)
 * - Open client tasks (things we need from the client)
 * - Open team tasks (internal action items)
 * - Items needing client approval
 */

export async function GET(req: NextRequest) {
  await ensureSchema();

  const clientId = req.nextUrl.searchParams.get('clientId');
  if (!clientId) return NextResponse.json({ error: 'clientId required' }, { status: 400 });

  // Get client name for content calendar lookup
  const { clients } = await import('@/lib/clients');
  const client = clients.find((c) => c.id === clientId);
  if (!client) return NextResponse.json({ error: 'Unknown client' }, { status: 404 });

  // Content calendar status counts
  const { rows: contentStatus } = await query(
    `SELECT
       client_approval_status,
       COUNT(*) as count
     FROM content_calendar cc
     JOIN projects p ON p.id = cc.project_id
     WHERE p.client_name = $1
       AND cc.post_date >= CURRENT_DATE
       AND cc.post_date < CURRENT_DATE + interval '30 days'
     GROUP BY client_approval_status`,
    [client.name],
  );

  // Posts pending client review (need approval)
  const { rows: pendingReview } = await query(
    `SELECT cc.title, cc.post_date, cc.platform
     FROM content_calendar cc
     JOIN projects p ON p.id = cc.project_id
     WHERE p.client_name = $1
       AND cc.client_approval_status = 'pending_review'
     ORDER BY cc.post_date
     LIMIT 20`,
    [client.name],
  );

  // Open client tasks (things MNA needs from the client)
  const { rows: clientTasks } = await query(
    `SELECT title, description, created_at
     FROM client_requests
     WHERE client_id = $1 AND status = 'open'
     ORDER BY created_at DESC`,
    [clientId],
  );

  // Open internal team tasks
  const { rows: teamTasks } = await query(
    `SELECT title, description, created_at
     FROM client_requests
     WHERE client_id = 'mna' AND status = 'open'
     ORDER BY created_at DESC`,
    [],
  );

  // Build email-ready summary
  const statusCounts = contentStatus.reduce<Record<string, number>>((acc, r) => {
    acc[r.client_approval_status] = Number(r.count);
    return acc;
  }, {});

  const summary = {
    clientName: client.name,
    clientId: client.id,
    generatedAt: new Date().toISOString(),
    contentCalendar: {
      next30Days: statusCounts,
      pendingReviewCount: statusCounts['pending_review'] || 0,
      approvedCount: statusCounts['approved'] || 0,
      scheduledCount: statusCounts['scheduled'] || 0,
      draftingCount: statusCounts['drafting'] || 0,
    },
    pendingReview: pendingReview.map((p) => ({
      title: p.title?.replace(/^\[.*?\]\s*/, '').split(' — ')[0] || 'Untitled',
      date: p.post_date,
      platform: p.platform,
    })),
    clientTasks: clientTasks.map((t) => ({ title: t.title, description: t.description })),
    teamTasks: teamTasks.map((t) => ({ title: t.title, description: t.description })),
    // Pre-formatted email sections for Make to drop into a template
    emailSections: {
      greeting: `Hi ${client.shortName} team,`,
      contentLine: statusCounts['pending_review']
        ? `We have ${statusCounts['pending_review']} post(s) ready for your review in the content calendar.`
        : 'All content is approved and on track for the week ahead.',
      clientTasksList: clientTasks.length > 0
        ? clientTasks.map((t) => `- ${t.title}`).join('\n')
        : 'No open items from your side this week.',
      teamTasksList: teamTasks.length > 0
        ? teamTasks.map((t) => `- ${t.title}`).join('\n')
        : null,
      closing: 'Let us know if you have any questions. Talk soon!',
      signature: 'Mother Nature Agency',
    },
  };

  return NextResponse.json(summary);
}
