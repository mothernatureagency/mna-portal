import { NextRequest, NextResponse } from 'next/server';
import { ensureSchema, query } from '@/lib/db';
import { getPlaybook } from '@/lib/agents/playbooks';
import { queueEmailNotification, getClientNotificationEmail, STAFF_NOTIFY_EMAIL } from '@/lib/notifications';
import { clients } from '@/lib/clients';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function getOrCreateProject(clientName: string): Promise<string> {
  const existing = await query<{ id: string }>(
    'select id from projects where client_name = $1 limit 1',
    [clientName]
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await query<{ id: string }>(
    'insert into projects (name, client_name) values ($1, $2) returning id',
    [`${clientName} Content`, clientName]
  );
  return created.rows[0].id;
}

function dayOffsetDate(startDate: string, day: number): string {
  // Parse as local noon to avoid UTC midnight timezone shift
  const d = new Date(`${startDate}T12:00:00`);
  d.setDate(d.getDate() + (day - 1));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// PATCH — update a single content item.
// Supports post_date, platform, content_type, title, caption, status,
// client_approval_status, client_comments, mna_comments, photo_drive_url,
// photo_urls (the full photo list; photo_drive_url mirrors its first entry).
// When client_approval_status transitions to 'approved', approved_at is stamped.
export async function PATCH(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { id, post_date, platform, content_type, title, caption, status, client_approval_status, client_comments, mna_comments, photo_drive_url, photo_urls, auto_post } = body || {};
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const fields: string[] = [];
  const values: any[] = [];
  if (post_date !== undefined) { values.push(post_date); fields.push(`post_date = $${values.length}`); }
  if (platform !== undefined) { values.push(platform); fields.push(`platform = $${values.length}`); }
  if (content_type !== undefined) { values.push(content_type); fields.push(`content_type = $${values.length}`); }
  if (title !== undefined) { values.push(title); fields.push(`title = $${values.length}`); }
  if (caption !== undefined) { values.push(caption); fields.push(`caption = $${values.length}`); }
  if (status !== undefined) { values.push(status); fields.push(`status = $${values.length}`); }
  if (client_approval_status !== undefined) {
    values.push(client_approval_status);
    fields.push(`client_approval_status = $${values.length}`);
    if (client_approval_status === 'approved') {
      fields.push(`approved_at = now()`);
    }
  }
  if (client_comments !== undefined) { values.push(client_comments); fields.push(`client_comments = $${values.length}`); }
  if (mna_comments !== undefined) { values.push(mna_comments); fields.push(`mna_comments = $${values.length}`); }
  if (photo_urls !== undefined) {
    const list = Array.isArray(photo_urls)
      ? photo_urls.filter((u: unknown) => typeof u === 'string' && u.trim()).map((u: string) => u.trim())
      : [];
    values.push(JSON.stringify(list));
    fields.push(`photo_urls = $${values.length}::jsonb`);
    // Keep the legacy single-photo column pointing at the cover (first photo).
    if (photo_drive_url === undefined) {
      values.push(list[0] || null);
      fields.push(`photo_drive_url = $${values.length}`);
    }
  }
  if (photo_drive_url !== undefined) {
    values.push(photo_drive_url); fields.push(`photo_drive_url = $${values.length}`);
    if (photo_urls === undefined) {
      // Legacy single-photo edit (e.g. dashboard calendar) — mirror it into the
      // first slot of photo_urls so the list and the cover never disagree.
      values.push(photo_drive_url || null);
      const n = values.length;
      fields.push(`photo_urls = case
        when $${n}::text is null then case when jsonb_array_length(coalesce(photo_urls, '[]'::jsonb)) > 1 then photo_urls - 0 else '[]'::jsonb end
        when jsonb_array_length(coalesce(photo_urls, '[]'::jsonb)) >= 1 then jsonb_set(photo_urls, '{0}', to_jsonb($${n}::text))
        else jsonb_build_array($${n}::text) end`);
    }
  }
  if (auto_post !== undefined) { values.push(auto_post); fields.push(`auto_post = $${values.length}`); }
  const client_visible = body?.client_visible;
  if (client_visible !== undefined) {
    values.push(client_visible);
    fields.push(`client_visible = $${values.length}`);
    // When pushing to client, auto-promote drafting → pending_review
    if (client_visible === true && client_approval_status === undefined) {
      fields.push(`client_approval_status = CASE WHEN client_approval_status = 'drafting' THEN 'pending_review' ELSE client_approval_status END`);
    }
  }
  if (fields.length === 0) return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
  values.push(id);
  const { rows } = await query<any>(
    `update content_calendar set ${fields.join(', ')} where id = $${values.length} returning *`,
    values
  );
  const updated = rows[0];

  // Fire email notifications for key approval transitions.
  // Wrapped so a notification failure never breaks the PATCH.
  try {
    if (updated) {
      // Look up client name from the project, then map to a client id from lib/clients.
      const { rows: projRows } = await query<{ client_name: string }>(
        `select client_name from projects where id = $1`, [updated.project_id],
      );
      const clientName = projRows[0]?.client_name;
      const matchedClient = clients.find(c => c.name === clientName || c.shortName === clientName);
      const clientId = matchedClient?.id || clientName || '';

      const postLabel = `${updated.platform || ''} ${updated.post_date || ''} — ${updated.title || 'Untitled post'}`.trim();

      // 1) Client approved content → notify staff
      if (client_approval_status === 'approved') {
        await queueEmailNotification({
          to: STAFF_NOTIFY_EMAIL,
          subject: `✅ ${clientName || clientId} approved content: ${postLabel}`,
          body: [
            `${clientName || clientId} just approved a content calendar item.`,
            '',
            `Post: ${postLabel}`,
            `Caption: ${updated.caption || '(no caption)'}`,
            updated.client_comments ? `Client comments: ${updated.client_comments}` : '',
            '',
            `View: https://portal.mothernatureagency.com/content-calendar`,
          ].filter(Boolean).join('\n'),
          eventType: 'content_approved',
          clientId,
          relatedId: updated.id,
        });
      }

      // 2) Staff pushed content to the client for review → notify client
      // Triggered when visibility flips on OR when approval status is explicitly
      // moved to 'pending_review' (i.e. "request approval" button).
      const pushedForReview =
        (client_visible === true && updated.client_approval_status !== 'approved') ||
        client_approval_status === 'pending_review';

      if (pushedForReview) {
        const clientEmail = await getClientNotificationEmail(clientId);
        if (clientEmail) {
          await queueEmailNotification({
            to: clientEmail,
            subject: `New content ready for your review — ${clientName || 'your brand'}`,
            body: [
              `Hi! We've got new content ready for your approval.`,
              '',
              `Post: ${postLabel}`,
              `Caption: ${updated.caption || '(draft in progress)'}`,
              '',
              `Review and approve here: https://portal.mothernatureagency.com/client`,
              '',
              '— Mother Nature Agency',
            ].join('\n'),
            eventType: 'approval_requested',
            clientId,
            relatedId: updated.id,
          });
        }
      }
    }
  } catch (err) {
    console.error('[content-calendar] notification enqueue failed', err);
  }

  return NextResponse.json({ item: updated });
}

// GET — list content for a client
// ?client=Name          — returns all items (staff view)
// ?client=Name&visible=1 — returns only client_visible=true items (client portal)
export async function GET(req: NextRequest) {
  await ensureSchema();
  const clientName = req.nextUrl.searchParams.get('client');
  if (!clientName) return NextResponse.json({ items: [] });
  const onlyVisible = req.nextUrl.searchParams.get('visible') === '1';
  const visibleClause = onlyVisible ? ' and cc.client_visible = true' : '';
  const { rows } = await query(
    `select cc.* from content_calendar cc
       join projects p on p.id = cc.project_id
      where p.client_name = $1${visibleClause}
      order by cc.post_date asc, cc.created_at asc`,
    [clientName]
  );
  return NextResponse.json({ items: rows });
}

// POST — bulk insert content items
// body: { clientName, items: [{ post_date, platform, content_type, title, status?,
//         assigned_role?, caption?, photo_drive_url?, photo_urls?, client_visible?,
//         client_approval_status? }], syncExisting? }
//   OR: { clientName, playbookId, startDate }  ← applies a playbook
// Items that already exist (same date + platform + title) are skipped, or —
// with syncExisting — refreshed with this push's media/caption. That's what
// lets a PDM cascade be pushed again once the artwork is attached.
export async function POST(req: NextRequest) {
  await ensureSchema();
  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const clientName: string = body?.clientName;
  if (!clientName) return NextResponse.json({ error: 'clientName required' }, { status: 400 });

  type SeedItem = {
    post_date: string;
    platform: string;
    content_type?: string;
    title?: string;
    status?: string;
    assigned_role?: string;
    caption?: string;
    // Media travels with the post so a cross-posted copy previews the same
    // photos in the target location's calendar (staff and client views).
    photo_drive_url?: string | null;
    photo_urls?: string[] | null;
    // Explicit overrides — a PDM brand post pushed to another location has to
    // land as PDM reference (scheduled + client-visible), not as a fresh draft.
    client_visible?: boolean;
    client_approval_status?: string;
  };
  let items: SeedItem[] = [];

  // When true, an item that already exists at the target (same date+platform+
  // title) is refreshed with this push's media/caption instead of just being
  // skipped. That's what makes "push PDM again once the photos are attached"
  // work — the second push fills in the artwork rather than doing nothing.
  const syncExisting: boolean = body?.syncExisting === true;

  if (body?.playbookId) {
    const pb = getPlaybook(body.playbookId);
    if (!pb) return NextResponse.json({ error: 'Unknown playbook' }, { status: 404 });
    const startDate: string = body?.startDate || new Date().toISOString().slice(0, 10);
    items = pb.items.map((it) => {
      // PDM brand cascade posts are informational only — they don't need
      // MNA review/approval because PDM already posts them from the brand
      // corporate page. Flag the assignee so the calendar styles them
      // dark blue and the insert logic auto-approves.
      const isPDM = typeof it.phase === 'string' && /^PDM\b/i.test(it.phase);
      return {
        post_date: dayOffsetDate(startDate, it.day),
        platform: it.platform,
        content_type: it.content_type,
        title: `[${it.phase}] ${it.title} — Hook: ${it.hook} | CTA: ${it.cta}`,
        status: isPDM ? 'Reference' : 'Draft',
        assigned_role: isPDM ? 'PDM (Brand)' : 'Social Media Manager',
        caption: it.caption,
      };
    });
  } else if (Array.isArray(body?.items)) {
    items = body.items;
  } else {
    return NextResponse.json({ error: 'items or playbookId required' }, { status: 400 });
  }

  const projectId = await getOrCreateProject(clientName);
  const inserted: any[] = [];
  let skipped = 0;
  let updated = 0;
  for (const it of items) {
    if (!it.post_date || !it.platform) continue;
    const isPDM = it.assigned_role === 'PDM (Brand)';
    // Skip if an identical row already exists for this project. Stops
    // duplicate playbook seeds / double-clicks from filling the calendar
    // with copies of the same post.
    const dupe = await query<{ id: string }>(
      `select id from content_calendar
        where project_id = $1
          and post_date = $2
          and platform = $3
          and coalesce(title, '') = coalesce($4, '')
        limit 1`,
      [projectId, it.post_date, it.platform, it.title || null],
    );
    if (dupe.rows[0]) {
      const photos = Array.isArray(it.photo_urls) ? it.photo_urls.filter(Boolean) : [];
      const cover = it.photo_drive_url || photos[0] || null;
      // A PDM brand post pushed here before this route carried PDM identity
      // landed as a plain draft. Re-align it (unless it already went out) so it
      // reads as reference content in every location's calendar.
      let touched = false;
      if (syncExisting && it.assigned_role === 'PDM (Brand)') {
        const realigned = await query(
          `update content_calendar
              set assigned_role = 'PDM (Brand)',
                  status = 'Reference',
                  client_approval_status = 'scheduled',
                  client_visible = true
            where id = $1
              and coalesce(publish_status, '') <> 'posted'
              and (coalesce(assigned_role, '') <> 'PDM (Brand)'
                   or coalesce(client_approval_status, '') <> 'scheduled'
                   or client_visible is distinct from true)
            returning id`,
          [dupe.rows[0].id],
        );
        touched = realigned.rows.length > 0;
      }
      if (syncExisting && (cover || it.caption)) {
        // Only ever fills gaps or refreshes media — never blanks out artwork or
        // a caption the target location wrote for itself.
        const { rows } = await query(
          `update content_calendar
              set photo_urls = case when $2::jsonb is null then photo_urls else $2::jsonb end,
                  photo_drive_url = coalesce($3, photo_drive_url),
                  caption = case when coalesce(caption, '') = '' then coalesce($4, caption) else caption end
            where id = $1
              and (($2::jsonb is not null and coalesce(photo_urls, '[]'::jsonb) is distinct from $2::jsonb)
                   or ($3::text is not null and photo_drive_url is distinct from $3)
                   or (coalesce(caption, '') = '' and coalesce($4, '') <> ''))
            returning id`,
          [
            dupe.rows[0].id,
            photos.length > 0 ? JSON.stringify(photos) : cover ? JSON.stringify([cover]) : null,
            cover,
            it.caption || null,
          ],
        );
        if (rows[0]) touched = true;
      }
      if (touched) { updated++; continue; }
      skipped++;
      continue;
    }

    const photos = Array.isArray(it.photo_urls) ? it.photo_urls.filter(Boolean) : [];
    const cover = it.photo_drive_url || photos[0] || null;
    const photoList = photos.length > 0 ? photos : cover ? [cover] : [];
    const { rows } = await query(
      `insert into content_calendar (project_id, post_date, platform, content_type, title, status, assigned_role, caption, client_approval_status, client_visible, photo_drive_url, photo_urls)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb) returning *`,
      [
        projectId,
        it.post_date,
        it.platform,
        it.content_type || null,
        it.title || null,
        it.status || 'Draft',
        it.assigned_role || null,
        it.caption || null,
        // PDM reference posts don't go through approval. Mark them 'scheduled'
        // so the client sees them as already-locked scheduled content (no
        // approval actions, no special color) rather than something to review.
        // Otherwise: pre-written caption → pending_review; else drafting.
        it.client_approval_status
          || (isPDM
            ? 'scheduled'
            : it.caption ? 'pending_review' : 'drafting'),
        // PDM posts are visible to the client too — they fill the client's
        // calendar so it doesn't look empty, even though MNA didn't write them.
        it.client_visible !== undefined ? it.client_visible : isPDM,
        cover,
        JSON.stringify(photoList),
      ]
    );
    inserted.push(rows[0]);
  }
  return NextResponse.json({ inserted, count: inserted.length, skipped, updated });
}

// DELETE — remove a content item (staff only)
export async function DELETE(req: NextRequest) {
  await ensureSchema();
  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await query('delete from content_calendar where id = $1', [id]);
  return NextResponse.json({ ok: true });
}
