import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * AI voiceover generation via ElevenLabs.
 *
 * POST /api/video-projects/voiceover
 * body: { script, voiceId?, modelId? }
 *
 * Returns: audio/mpeg binary stream (save as .mp3 on the client)
 *
 * Requires ELEVENLABS_API_KEY in Vercel env. If not set, returns a 503
 * so the frontend can fall back to browser SpeechSynthesis.
 *
 * Default voice: "Rachel" (warm, natural, widely used). Voice IDs can be
 * swapped by passing voiceId in the body. List voices at
 * https://api.elevenlabs.io/v1/voices.
 */
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM'; // Rachel
const DEFAULT_MODEL = 'eleven_multilingual_v2';

export async function POST(req: NextRequest) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: 'ELEVENLABS_API_KEY not set. Add it in Vercel env to enable high-quality AI voiceovers. The frontend falls back to browser speech synthesis when this is missing.' },
      { status: 503 },
    );
  }

  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const { script, voiceId, modelId } = b || {};
  if (!script) return NextResponse.json({ error: 'script required' }, { status: 400 });

  const useVoice = voiceId || DEFAULT_VOICE_ID;
  const useModel = modelId || DEFAULT_MODEL;

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${useVoice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': key,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text: String(script).slice(0, 5000),
        model_id: useModel,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      }),
    });
    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json({ error: `ElevenLabs error ${r.status}: ${errText.slice(0, 300)}` }, { status: 500 });
    }
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Disposition': 'inline; filename="voiceover.mp3"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Voiceover request failed' }, { status: 500 });
  }
}

// GET returns the list of available voices so the UI can let the user pick
export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ voices: [], error: 'ELEVENLABS_API_KEY not set' }, { status: 503 });
  try {
    const r = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': key },
    });
    if (!r.ok) return NextResponse.json({ voices: [], error: `ElevenLabs ${r.status}` }, { status: 500 });
    const data = await r.json();
    const voices = (data.voices || []).map((v: any) => ({
      voice_id: v.voice_id,
      name: v.name,
      category: v.category,
      labels: v.labels || {},
      preview_url: v.preview_url,
    }));
    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ voices: [], error: e?.message }, { status: 500 });
  }
}
