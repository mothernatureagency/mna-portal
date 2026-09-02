import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';
import { getBrand } from '@/lib/client-brand';
import { getFormat } from '@/lib/graphic-formats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * Draft the design brief for a Graphic Lab project — the concept, palette,
 * copy and imagery direction, before any pixels exist. Optional: you can go
 * straight to an artboard. It earns its place when the piece needs signing
 * off in words first, or when the headline still has to be written.
 *
 * POST /api/graphic-projects/brief
 * body: { projectId, note?, save?: boolean }
 * → { brief }
 */
export async function POST(req: NextRequest) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { projectId, note, save } = b || {};
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const { rows } = await query<any>('select * from graphic_projects where id = $1', [projectId]);
  const project = rows[0];
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const agent = getAgent('graphic-designer');
  if (!agent) return NextResponse.json({ error: 'Graphic Designer agent missing' }, { status: 500 });

  const brand = await getBrand(project.client_id);
  const fmt = getFormat(project.format);

  const userPrompt = [
    `Write the design brief for this piece.`,
    ``,
    `Client: ${brand.name}${brand.location ? ` (${brand.location})` : ''} · ${brand.industry}`,
    `Brand palette: ${brand.primary} / ${brand.secondary} / ${brand.accent}`,
    `Canvas: ${fmt.label} — ${fmt.width}x${fmt.height}px · ${fmt.usage}`,
    `Working title: ${project.title}`,
    project.topic ? `Subject / angle: ${project.topic}` : '',
    project.headline ? `Headline already approved: ${project.headline}` : '',
    project.subhead ? `Subhead already approved: ${project.subhead}` : '',
    project.cta ? `CTA: ${project.cta}` : '',
    note ? `\nWhat the team asked for:\n${note}` : '',
    ``,
    `Give it in your standard format. Write the actual headline and CTA copy —`,
    `this brief goes straight into building the artwork, so no placeholders.`,
    `No preamble, don't restate the request back to me.`,
  ].filter((l) => l !== '').join('\n');

  const client = new Anthropic({ apiKey });
  try {
    const res = await client.messages.create({
      model: agent.model,
      max_tokens: 1500,
      system: agent.systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const brief = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n').trim();

    if (save && brief) {
      await query('update graphic_projects set brief = $1, updated_at = now() where id = $2', [brief, projectId]);
    }
    return NextResponse.json({ brief });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Claude API error' }, { status: 500 });
  }
}
