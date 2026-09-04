import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Premium text-to-speech for the assistant's voice, via ElevenLabs.
 *
 * POST { text } → audio/mpeg of the line read by "Lily" (their velvety
 * British actress voice), or a JSON error the client treats as "fall back
 * to the browser voice". Needs ELEVENLABS_API_KEY in the environment;
 * ELEVENLABS_VOICE_ID overrides the voice if a different one is preferred
 * later. Kept server-side so the key never reaches the browser.
 */

// ElevenLabs premade voice "Lily" — warm, velvety, British actress.
const LILY_VOICE_ID = 'pFZP5JQG7iQjIQuC4Bku';

async function role(): Promise<string> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || (user ? 'staff' : '');
  } catch { return ''; }
}

export async function POST(req: NextRequest) {
  const r = await role();
  if (!r) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  if (r === 'client') return NextResponse.json({ error: 'Staff only' }, { status: 403 });

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'ELEVENLABS_API_KEY not set — using browser voice' }, { status: 501 });

  let body: any;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const text = (body?.text || '').toString().trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: 'text required' }, { status: 400 });

  const voiceId = process.env.ELEVENLABS_VOICE_ID || LILY_VOICE_ID;

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        // Turbo model: near-instant responses at a fraction of the cost —
        // right trade-off for a conversational assistant.
        model_id: 'eleven_turbo_v2_5',
        voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return NextResponse.json({ error: `TTS failed (${res.status})`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'TTS failed' }, { status: 502 });
  }
}
