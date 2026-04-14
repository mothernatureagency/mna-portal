import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET — Returns upcoming events that need SMS reminders.
 * Make.com polls this, sends the SMS via Twilio, then PATCHes reminder_sent = true.
 *
 * Returns events for today and tomorrow that haven't had reminders sent yet.
 */
export async function GET(req: NextRequest) {
  await ensureSchema();
  const email = req.nextUrl.searchParams.get('email') || 'mn@mothernatureagency.com';

  // Get today's and tomorrow's events that haven't been reminded
  const { rows: events } = await query(
    `select * from schedule_events
     where user_email = $1
       and reminder_sent = false
       and completed = false
       and event_date between current_date and current_date + interval '1 day'
     order by event_date asc, start_time asc nulls last`,
    [email]
  );

  // Also get overdue tasks (past date, not completed)
  const { rows: overdue } = await query(
    `select * from schedule_events
     where user_email = $1
       and completed = false
       and event_date < current_date
     order by event_date desc
     limit 5`,
    [email]
  );

  // Get campaign deadlines approaching
  const { rows: campaigns } = await query(
    `select id, name, campaign_type, scheduled_date, status, client_id
     from campaigns
     where status in ('drafting', 'pending_review')
       and scheduled_date between current_date and current_date + interval '3 days'
     order by scheduled_date asc
     limit 5`
  );

  // Get content posts needing review
  const { rows: pendingContent } = await query(
    `select id, title, post_date, platform, client_approval_status
     from content_calendar
     where client_approval_status in ('pending_review', 'changes_requested')
       and post_date between current_date and current_date + interval '3 days'
     order by post_date asc
     limit 5`
  );

  return NextResponse.json({
    events,
    overdue,
    campaigns,
    pendingContent,
    summary: {
      todayEvents: events.filter((e: any) => e.event_date === new Date().toISOString().slice(0, 10)).length,
      tomorrowEvents: events.filter((e: any) => e.event_date !== new Date().toISOString().slice(0, 10)).length,
      overdueCount: overdue.length,
      campaignDeadlines: campaigns.length,
      pendingApprovals: pendingContent.length,
    },
  });
}

/**
 * POST — Generate a formatted SMS digest message for the day.
 * Make.com calls this, gets the message, then sends via Twilio.
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const body = await req.json().catch(() => ({}));
  const email = body.email || 'mn@mothernatureagency.com';

  // Today's schedule
  const { rows: todayEvents } = await query(
    `select title, start_time, end_time, event_type, client_id, priority
     from schedule_events
     where user_email = $1 and event_date = current_date and completed = false
     order by start_time asc nulls last`,
    [email]
  );

  // Upcoming campaign deadlines
  const { rows: campaigns } = await query(
    `select name, campaign_type, scheduled_date, status
     from campaigns
     where status in ('drafting', 'pending_review', 'approved')
       and scheduled_date between current_date and current_date + interval '2 days'
     order by scheduled_date asc limit 3`
  );

  // Content needing attention
  const { rows: pendingContent } = await query(
    `select count(*) as cnt from content_calendar
     where client_approval_status in ('pending_review', 'changes_requested')
       and post_date between current_date and current_date + interval '3 days'`
  );

  // Build the SMS message
  const lines: string[] = [];
  const today = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  lines.push(`MNA Daily ${today}`);

  if (todayEvents.length > 0) {
    lines.push('');
    lines.push(`Schedule (${todayEvents.length}):`);
    todayEvents.slice(0, 4).forEach((e: any) => {
      const time = e.start_time ? `${e.start_time}` : '';
      const flag = e.priority === 'high' ? '!' : '';
      lines.push(`${flag}${time ? time + ' ' : ''}${e.title}`);
    });
    if (todayEvents.length > 4) lines.push(`+${todayEvents.length - 4} more`);
  } else {
    lines.push('No events today');
  }

  if (campaigns.length > 0) {
    lines.push('');
    lines.push('Campaigns due:');
    campaigns.forEach((c: any) => {
      lines.push(`${c.campaign_type === 'sms' ? 'SMS' : 'Email'}: ${c.name} (${c.status})`);
    });
  }

  const pending = parseInt(pendingContent[0]?.cnt || '0');
  if (pending > 0) {
    lines.push('');
    lines.push(`${pending} posts need review`);
  }

  const message = lines.join('\n');

  // Mark today's events as reminded
  await query(
    `update schedule_events set reminder_sent = true
     where user_email = $1 and event_date = current_date and reminder_sent = false`,
    [email]
  );

  return NextResponse.json({ message, charCount: message.length });
}
