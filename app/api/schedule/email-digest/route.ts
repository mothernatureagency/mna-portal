import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — Returns an HTML email digest for the day.
 * Make.com polls this endpoint each morning and sends via Gmail/SMTP.
 *
 * Query params:
 *   ?email=mn@mothernatureagency.com (default)
 *
 * Returns: { subject, html, plain, summary }
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email') || 'mn@mothernatureagency.com';

  // Today's schedule
  const { rows: todayEvents } = await query(
    `select title, start_time, end_time, event_type, client_id, priority
     from schedule_events
     where user_email = $1 and event_date = current_date and completed = false
     order by start_time asc nulls last`,
    [email]
  );

  // Tomorrow's schedule
  const { rows: tomorrowEvents } = await query(
    `select title, start_time, end_time, event_type, client_id, priority
     from schedule_events
     where user_email = $1 and event_date = current_date + interval '1 day' and completed = false
     order by start_time asc nulls last`,
    [email]
  );

  // Overdue tasks
  const { rows: overdue } = await query(
    `select title, event_date, event_type, client_id
     from schedule_events
     where user_email = $1 and completed = false and event_date < current_date
     order by event_date desc limit 5`,
    [email]
  );

  // Campaign deadlines (next 3 days)
  const { rows: campaigns } = await query(
    `select name, campaign_type, scheduled_date, status, client_id
     from campaigns
     where status in ('drafting', 'pending_review', 'approved')
       and scheduled_date between current_date and current_date + interval '3 days'
     order by scheduled_date asc limit 5`
  );

  // Content needing review
  const { rows: pendingContent } = await query(
    `select title, post_date, platform, client_approval_status
     from content_calendar
     where client_approval_status in ('pending_review', 'changes_requested')
       and post_date between current_date and current_date + interval '3 days'
     order by post_date asc limit 5`
  );

  // Build date strings
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const shortDate = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

  const subject = `MNA Daily Briefing — ${shortDate}`;

  // ─── Build plain text version ────────────────────────────────────
  const plain: string[] = [];
  plain.push(`MNA Daily Briefing — ${dateStr}\n`);

  if (todayEvents.length > 0) {
    plain.push(`\nTODAY'S SCHEDULE (${todayEvents.length}):`);
    todayEvents.forEach((e: any) => {
      const time = e.start_time ? `${e.start_time} ` : '';
      const flag = e.priority === 'high' ? '[!] ' : '';
      plain.push(`  ${flag}${time}${e.title} (${e.event_type})`);
    });
  } else {
    plain.push('\nNo events scheduled for today.');
  }

  if (tomorrowEvents.length > 0) {
    plain.push(`\nTOMORROW (${tomorrowEvents.length}):`);
    tomorrowEvents.forEach((e: any) => {
      const time = e.start_time ? `${e.start_time} ` : '';
      plain.push(`  ${time}${e.title}`);
    });
  }

  if (overdue.length > 0) {
    plain.push(`\nOVERDUE (${overdue.length}):`);
    overdue.forEach((e: any) => {
      plain.push(`  ${e.title} — due ${e.event_date}`);
    });
  }

  if (campaigns.length > 0) {
    plain.push(`\nCAMPAIGN DEADLINES:`);
    campaigns.forEach((c: any) => {
      plain.push(`  ${c.campaign_type === 'sms' ? 'SMS' : 'Email'}: ${c.name} (${c.status}) — ${c.scheduled_date}`);
    });
  }

  if (pendingContent.length > 0) {
    plain.push(`\nCONTENT NEEDING REVIEW (${pendingContent.length}):`);
    pendingContent.forEach((p: any) => {
      plain.push(`  ${p.title || 'Untitled'} — ${p.platform} on ${p.post_date}`);
    });
  }

  plain.push('\n---\nView your full dashboard at portal.mothernatureagency.com');

  // ─── Build HTML version ──────────────────────────────────────────
  const accentColor = '#0c6da4';
  const bgColor = '#0a1929';

  function eventRow(title: string, time: string, type: string, priority: string) {
    const flag = priority === 'high' ? '<span style="color:#f59e0b;font-weight:800;">! </span>' : '';
    const typeColors: Record<string, string> = {
      meeting: '#3b82f6', call: '#22c55e', deadline: '#ef4444', review: '#a855f7', task: '#6b7280', personal: '#f59e0b',
    };
    const tc = typeColors[type] || '#6b7280';
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);">
        ${flag}<span style="color:#fff;font-size:14px;font-weight:600;">${title}</span>
        ${time ? `<br><span style="color:rgba(255,255,255,0.4);font-size:12px;">${time}</span>` : ''}
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.06);text-align:right;">
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:${tc}22;color:${tc};">${type}</span>
      </td>
    </tr>`;
  }

  let html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${bgColor};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px 16px;">

  <!-- Header -->
  <div style="text-align:center;padding:24px 0 20px;">
    <div style="display:inline-block;width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,${accentColor},#4ab8ce);line-height:48px;text-align:center;color:#fff;font-weight:800;font-size:20px;">M</div>
    <h1 style="color:#fff;font-size:22px;font-weight:800;margin:12px 0 4px;">Daily Briefing</h1>
    <p style="color:rgba(255,255,255,0.5);font-size:13px;margin:0;">${dateStr}</p>
  </div>

  <!-- Summary badges -->
  <div style="text-align:center;padding:0 0 24px;">
    <span style="display:inline-block;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;margin:3px;background:rgba(74,184,206,0.15);color:#4ab8ce;">${todayEvents.length} event${todayEvents.length !== 1 ? 's' : ''} today</span>
    ${overdue.length > 0 ? `<span style="display:inline-block;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;margin:3px;background:rgba(239,68,68,0.15);color:#ef4444;">${overdue.length} overdue</span>` : ''}
    ${campaigns.length > 0 ? `<span style="display:inline-block;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;margin:3px;background:rgba(168,85,247,0.15);color:#a855f7;">${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''} due</span>` : ''}
    ${pendingContent.length > 0 ? `<span style="display:inline-block;padding:6px 14px;border-radius:99px;font-size:12px;font-weight:700;margin:3px;background:rgba(245,158,11,0.15);color:#f59e0b;">${pendingContent.length} need review</span>` : ''}
  </div>`;

  // Today's schedule section
  if (todayEvents.length > 0) {
    html += `
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#4ab8ce;">Today's Schedule</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${todayEvents.map((e: any) => eventRow(e.title, e.start_time ? `${e.start_time}${e.end_time ? ' - ' + e.end_time : ''}` : '', e.event_type, e.priority)).join('')}
    </table>
  </div>`;
  }

  // Tomorrow preview
  if (tomorrowEvents.length > 0) {
    html += `
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);">Tomorrow Preview (${tomorrowEvents.length})</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${tomorrowEvents.slice(0, 3).map((e: any) => eventRow(e.title, e.start_time || '', e.event_type, e.priority)).join('')}
    </table>
  </div>`;
  }

  // Overdue
  if (overdue.length > 0) {
    html += `
  <div style="background:rgba(239,68,68,0.05);border:1px solid rgba(239,68,68,0.15);border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:14px 16px;border-bottom:1px solid rgba(239,68,68,0.1);">
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#ef4444;">Overdue</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${overdue.map((e: any) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="color:#fff;font-size:14px;font-weight:600;">${e.title}</span>
          <br><span style="color:rgba(239,68,68,0.6);font-size:12px;">Due ${e.event_date}</span>
        </td>
      </tr>`).join('')}
    </table>
  </div>`;
  }

  // Campaigns
  if (campaigns.length > 0) {
    html += `
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#a855f7;">Campaign Deadlines</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${campaigns.map((c: any) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="color:#fff;font-size:14px;font-weight:600;">${c.name}</span>
          <br><span style="color:rgba(255,255,255,0.4);font-size:12px;">${c.campaign_type === 'sms' ? 'SMS' : 'Email'} · ${c.scheduled_date}</span>
        </td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:rgba(245,158,11,0.15);color:#f59e0b;">${c.status.replace('_', ' ')}</span>
        </td>
      </tr>`).join('')}
    </table>
  </div>`;
  }

  // Pending content
  if (pendingContent.length > 0) {
    html += `
  <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;margin-bottom:16px;">
    <div style="padding:14px 16px;border-bottom:1px solid rgba(255,255,255,0.08);">
      <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.1em;color:#f59e0b;">Content Needing Review</span>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${pendingContent.map((p: any) => `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="color:#fff;font-size:14px;font-weight:600;">${p.title || 'Untitled post'}</span>
          <br><span style="color:rgba(255,255,255,0.4);font-size:12px;">${p.platform} · ${p.post_date}</span>
        </td>
        <td style="padding:8px 12px;text-align:right;border-bottom:1px solid rgba(255,255,255,0.04);">
          <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:99px;background:${p.client_approval_status === 'changes_requested' ? 'rgba(239,68,68,0.15);color:#ef4444;' : 'rgba(245,158,11,0.15);color:#f59e0b;'}">${p.client_approval_status === 'changes_requested' ? 'changes' : 'review'}</span>
        </td>
      </tr>`).join('')}
    </table>
  </div>`;
  }

  // CTA + Footer
  html += `
  <div style="text-align:center;padding:24px 0;">
    <a href="https://portal.mothernatureagency.com" style="display:inline-block;padding:14px 32px;border-radius:14px;background:linear-gradient(135deg,${accentColor},#4ab8ce);color:#fff;font-size:14px;font-weight:700;text-decoration:none;">Open Dashboard</a>
  </div>

  <div style="text-align:center;padding:16px 0;border-top:1px solid rgba(255,255,255,0.06);">
    <p style="color:rgba(255,255,255,0.25);font-size:11px;margin:0;">Powered by Mother Nature Agency</p>
  </div>

</div>
</body>
</html>`;

  return NextResponse.json({
    subject,
    html,
    plain: plain.join('\n'),
    to: email,
    summary: {
      todayEvents: todayEvents.length,
      tomorrowEvents: tomorrowEvents.length,
      overdueCount: overdue.length,
      campaignDeadlines: campaigns.length,
      pendingApprovals: pendingContent.length,
    },
  });
}
