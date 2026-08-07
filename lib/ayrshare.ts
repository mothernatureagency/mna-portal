/**
 * Ayrshare posting provider — one API for Instagram, Facebook, and TikTok
 * (plus others). Each client connects their own social accounts to an
 * Ayrshare "user profile"; we post on their behalf with that profile key.
 *
 * Env: AYRSHARE_API_KEY (your Ayrshare Business API key).
 * Per-client: their Ayrshare Profile Key, stored in client_kv
 * (key 'ayrshare_profile_key').
 *
 * Nothing here publishes on its own — callers decide when.
 */

const API = 'https://api.ayrshare.com/api';

// Map our platform labels to Ayrshare platform names.
export function ayrsharePlatform(platform: string): string | null {
  const p = (platform || '').toLowerCase();
  if (p.includes('instagram')) return 'instagram';
  if (p.includes('facebook') || p === 'meta') return 'facebook';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('pinterest')) return 'pinterest';
  if (p === 'x/twitter' || p.includes('twitter') || p === 'x') return 'twitter';
  return null;
}

// A post's platform label → the Ayrshare platforms to publish to.
export function platformsFor(platform: string): string[] {
  const p = (platform || '').toLowerCase();
  if (p === 'meta') return ['facebook', 'instagram'];
  const one = ayrsharePlatform(platform);
  return one ? [one] : [];
}

// Only a direct, public media URL works — Google Drive share links won't.
export function mediaFor(url: string | null): string[] {
  const u = (url || '').trim();
  if (!u || !/^https?:\/\//i.test(u) || /drive\.google\.com|docs\.google\.com/i.test(u)) return [];
  return [u];
}

export type PublishInput = {
  profileKey?: string;      // the client's Ayrshare profile key
  caption: string;
  mediaUrls?: string[];     // public image/video URLs
  platforms: string[];      // ayrshare platform names
  scheduleISO?: string;     // optional future time to schedule at Ayrshare
};

export type PublishResult =
  | { ok: true; id: string; raw: any }
  | { ok: false; error: string; raw?: any };

export async function ayrsharePublish(input: PublishInput): Promise<PublishResult> {
  const key = process.env.AYRSHARE_API_KEY;
  if (!key) return { ok: false, error: 'AYRSHARE_API_KEY is not set in the environment.' };
  if (!input.platforms.length) return { ok: false, error: 'No supported platform for this post.' };
  if (!input.caption.trim() && !(input.mediaUrls && input.mediaUrls.length)) {
    return { ok: false, error: 'Nothing to post — add a caption or media.' };
  }

  const body: Record<string, unknown> = {
    post: input.caption,
    platforms: input.platforms,
  };
  if (input.mediaUrls && input.mediaUrls.length) body.mediaUrls = input.mediaUrls;
  if (input.scheduleISO) body.scheduleDate = input.scheduleISO;
  if (input.profileKey) body.profileKey = input.profileKey;

  try {
    const res = await fetch(`${API}/post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    const raw = await res.json().catch(() => ({}));
    // Ayrshare returns status 'success' + an id, or an errors array.
    if (res.ok && (raw.status === 'success' || raw.id)) {
      return { ok: true, id: raw.id || raw.postIds?.[0]?.id || 'posted', raw };
    }
    const err = raw?.errors?.[0]?.message || raw?.message || `Publish failed (${res.status})`;
    return { ok: false, error: err, raw };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Publish request failed' };
  }
}
