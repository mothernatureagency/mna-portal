import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { ensureSchema, query } from '@/lib/db';
import { getAgent } from '@/lib/agents/config';
import { getBrand } from '@/lib/client-brand';
import { getFormat } from '@/lib/graphic-formats';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * The part the content calendar never had: this makes the artwork, not a spec
 * for someone else to make it.
 *
 * The Graphic Designer agent writes the design as a self-contained HTML
 * artboard laid out at the format's exact pixel size. The browser renders it
 * and /api/graphic-projects/render rasterises it to a PNG. Going through HTML
 * rather than an image model is a deliberate trade: type stays crisp and
 * spelled correctly, brand hexes come out exact, and every layer stays
 * editable afterwards — the three things diffusion models reliably ruin on
 * a piece of creative that carries a headline and a phone number.
 *
 * POST /api/graphic-projects/design
 * body: { projectId, instruction?, keepLayout?: boolean }
 * → { html }  (also saved onto the project, previous artboard pushed to versions)
 */

// Artboards get generated on Opus regardless of the agent's chat model —
// layout judgment is the whole job here.
const DESIGN_MODEL = 'claude-opus-5';
const MAX_VERSIONS = 8;

function artboardContract(width: number, height: number) {
  return `
OUTPUT CONTRACT — follow exactly, this is rendered by a machine:

1. Reply with ONE complete HTML document and NOTHING else. No markdown fences,
   no preamble, no explanation before or after. The first characters of your
   reply must be "<!doctype html>".
2. The document contains exactly one root visual element:
   <div id="artboard"> … </div>
   styled to exactly ${width}px wide by ${height}px tall, position:relative,
   overflow:hidden. Never any other size, never a percentage, never a scale
   transform on it. Set body margin:0 and give body the same dimensions.
3. All styling goes in a single <style> block in <head>. No JavaScript at all
   — a <script> tag will be stripped.
4. Fonts: you may load ONE Google Fonts stylesheet with a <link rel="stylesheet"
   href="https://fonts.googleapis.com/css2?...&display=swap"> in <head>. Always
   write font-family with a real fallback stack after it
   (e.g. font-family:'Bebas Neue', Impact, system-ui, sans-serif) so the piece
   still holds up if the webfont is slow.
5. Imagery: you may only reference image URLs from the ASSETS list below, and
   you must use the URL verbatim. If there are no assets, build the whole piece
   out of CSS — gradients, blurred colour blobs, geometric shapes, inline SVG.
   Never invent an image URL, never link a stock photo, never use an <img> src
   that is not in ASSETS.
6. Do NOT use backdrop-filter, external @import, CSS variables in url(), or
   position:fixed — they do not survive rasterisation. Plain filter, blend
   modes, gradients, box-shadow, transform and inline SVG all rasterise fine.
7. Every word of copy must be real DOM text, never baked into an image.
8. Keep all critical copy and the logo inside a ${Math.round(Math.min(width, height) * 0.07)}px safe margin from every edge.

DESIGN STANDARD — this goes out under a client's name:
- One idea per piece. Decide the single focal point before anything else.
- Hard hierarchy: the headline should be 4-8x the size of the smallest text.
  If everything is medium-sized, it reads as nothing.
- Real contrast. Text over imagery needs a scrim, gradient or solid panel
  behind it — never rely on the photo being dark enough.
- Generous negative space. Crowding is the most common way this looks amateur.
- Use the brand palette below, not generic blues. Two colours carry the piece;
  a third is an accent used once.
- The 3-second test: at thumbnail size, the headline and the offer must survive.`;
}

export async function POST(req: NextRequest) {
  await ensureSchema();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 500 });

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { projectId, instruction, keepLayout } = b || {};
  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const { rows } = await query<any>('select * from graphic_projects where id = $1', [projectId]);
  const project = rows[0];
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  const agent = getAgent('graphic-designer');
  if (!agent) return NextResponse.json({ error: 'Graphic Designer agent missing' }, { status: 500 });

  const brand = await getBrand(project.client_id);
  const fmt = getFormat(project.format);
  const assets: Array<{ url: string; label?: string }> = Array.isArray(project.assets) ? project.assets : [];

  // Anything the artboard points at has to come back through our own origin,
  // or the canvas is tainted and the export fails. The proxy does that.
  const assetLines = assets.length
    ? assets.map((a, i) => `  ${i + 1}. ${a.label || 'image'} → /api/graphic-projects/proxy-image?url=${encodeURIComponent(a.url)}`).join('\n')
    : '  (none — build the artwork entirely from CSS and inline SVG)';

  const revising = !!(instruction && project.html);

  const parts = [
    `Design a ${fmt.label} for ${brand.name}${brand.location ? ` (${brand.location})` : ''}.`,
    ``,
    `CANVAS: ${fmt.width} x ${fmt.height}px — ${fmt.usage}`,
    ``,
    `BRAND`,
    `  Business: ${brand.name} · ${brand.industry}`,
    `  Primary: ${brand.primary}`,
    `  Secondary: ${brand.secondary}`,
    `  Accent: ${brand.accent}`,
    `  Gradient: ${brand.gradientFrom} → ${brand.gradientTo}`,
    brand.logoUrl ? `  Logo (use it, small, one corner): ${brand.logoUrl}` : `  No logo file — set the name "${brand.logoText}" as a small wordmark instead`,
    brand.website ? `  Website to lock up with the CTA: ${brand.website}` : '',
    ``,
    `THE PIECE`,
    `  Working title: ${project.title}`,
    project.topic ? `  Subject / angle: ${project.topic}` : '',
    project.headline ? `  Headline (use this wording): ${project.headline}` : `  Headline: write one, under 7 words`,
    project.subhead ? `  Subhead (use this wording): ${project.subhead}` : '',
    project.cta ? `  Call to action: ${project.cta}` : '',
    project.brief ? `\nAPPROVED BRIEF — follow it:\n${project.brief}` : '',
    ``,
    `ASSETS — the only image URLs you may use:`,
    assetLines,
    ``,
  ].filter((l) => l !== '').join('\n');

  const revisionBlock = revising
    ? `\nThis is a revision of the artboard below. Apply this change:\n"${instruction}"\n\n${
        keepLayout
          ? 'Keep the existing layout, structure and composition — change only what the instruction asks for.'
          : 'You may rework the composition if the instruction calls for it.'
      }\n\nCURRENT ARTBOARD:\n${project.html}\n`
    : instruction
      ? `\nExtra direction from the team:\n"${instruction}"\n`
      : '';

  const userPrompt = `${parts}${revisionBlock}\n${artboardContract(fmt.width, fmt.height)}`;

  const client = new Anthropic({ apiKey });
  let raw = '';
  try {
    // Streamed: an artboard runs to thousands of tokens, and the SDK refuses a
    // non-streaming request that could sit open this long.
    const stream = client.messages.stream({
      model: DESIGN_MODEL,
      max_tokens: 16000,
      system: `${agent.systemPrompt}\n\nIn the Graphic Lab you do not write briefs — you build the finished artwork as an HTML artboard that gets rasterised straight to a PNG and posted. Treat the HTML as the deliverable.`,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const res = await stream.finalMessage();
    raw = res.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('');
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Claude API error' }, { status: 500 });
  }

  const html = sanitizeArtboard(raw);
  if (!html) {
    return NextResponse.json({ error: 'The designer did not return a usable artboard. Try again, or add more direction.' }, { status: 502 });
  }

  // Keep the artboard we're replacing so a bad revision is one click back.
  const prior: any[] = Array.isArray(project.versions) ? project.versions : [];
  const versions = project.html
    ? [{ html: project.html, at: new Date().toISOString(), note: instruction || 'previous' }, ...prior].slice(0, MAX_VERSIONS)
    : prior;

  const { rows: saved } = await query<any>(
    `update graphic_projects
        set html = $1, versions = $2::jsonb, status = case when status = 'drafting' then 'designed' else status end, updated_at = now()
      where id = $3 returning *`,
    [html, JSON.stringify(versions), projectId],
  );

  return NextResponse.json({ project: saved[0], html });
}

/**
 * Trim whatever wrapping the model added and refuse anything that can execute.
 * The artboard is injected into a sandboxed iframe, but a stray <script> would
 * still break the rasteriser, so it goes.
 */
function sanitizeArtboard(text: string): string | null {
  let html = (text || '').trim();

  // Strip a markdown fence if one slipped through.
  const fence = html.match(/^```(?:html)?\s*\n([\s\S]*?)\n?```\s*$/i);
  if (fence) html = fence[1].trim();

  // Drop any chat that landed before the document.
  const start = html.search(/<!doctype html|<html[\s>]/i);
  if (start > 0) html = html.slice(start);
  const end = html.toLowerCase().lastIndexOf('</html>');
  if (end !== -1) html = html.slice(0, end + 7);

  if (!/<html[\s>]/i.test(html) || !/id=["']artboard["']/i.test(html)) return null;

  html = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*\/?>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');

  return html;
}
