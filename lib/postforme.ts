/**
 * Post for Me posting provider — one API for Instagram, Facebook, TikTok,
 * YouTube (plus X, LinkedIn, Pinterest, Threads, Bluesky).
 *
 * Each client (location) connects their own social accounts through a Post for
 * Me OAuth link tagged with external_id = <clientId>. That lets us resolve
 * exactly which accounts belong to which client at post time — no per-client
 * key to paste, unlike the old Ayrshare "profile key" flow.
 *
 * Env: POST_FOR_ME_API_KEY (your Post for Me API key).
 * Docs: https://api.postforme.dev  (REST, /v1)
 *
 * Nothing here publishes on its own — callers decide when.
 */

const API = 'https://api.postforme.dev/v1';

function apiKey(): string | null {
  return process.env.POST_FOR_ME_API_KEY || null;
}
function authHeaders(key: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
}

// Our platform label → Post for Me platform name.
export function postformePlatform(platform: string): string | null {
  const p = (platform || '').toLowerCase();
  if (p.includes('instagram')) return 'instagram';
  if (p.includes('facebook')) return 'facebook';
  if (p.includes('tiktok')) return 'tiktok';
  if (p.includes('youtube')) return 'youtube';
  if (p.includes('linkedin')) return 'linkedin';
  if (p.includes('pinterest')) return 'pinterest';
  if (p.includes('threads')) return 'threads';
  if (p.includes('bluesky')) return 'bluesky';
  if (p === 'x/twitter' || p.includes('twitter') || p === 'x') return 'x';
  return null;
}

// Normalize provider variants (e.g. "tiktok_business" → "tiktok") so a post's
// platform matches a connected account regardless of account subtype.
export function platformBase(p: string): string {
  return (p || '').toLowerCase().replace(/_business$/, '');
}

// A post's platform label → the Post for Me platforms to publish to.
export function platformsFor(platform: string): string[] {
  const p = (platform || '').toLowerCase();
  if (p === 'meta') return ['facebook', 'instagram'];
  const one = postformePlatform(platform);
  return one ? [one] : [];
}

// The set of platforms the portal offers a connect button for.
export const CONNECTABLE_PLATFORMS = ['instagram', 'facebook', 'tiktok', 'youtube'] as const;

// Only a direct, public media URL works — Google Drive share links won't.
export function mediaFor(url: string | null): string[] {
  const u = (url || '').trim();
  if (!u || !/^https?:\/\//i.test(u) || /drive\.google\.com|docs\.google\.com/i.test(u)) return [];
  return [u];
}

// Is this media URL a video? (uploaded videos are named "…-video.<ext>")
export function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(url || '') || /-video\./i.test(url || '');
}

// Platforms that can ONLY post video (no image-only posts).
export function isVideoOnlyPlatform(p: string): boolean {
  const b = platformBase(p);
  return b === 'tiktok' || b === 'youtube';
}

export type PfmAccount = { id: string; platform: string; username: string | null; pageId: string | null; photo: string | null; status?: string };

/**
 * List connected accounts in the whole Post for Me project (the "pool").
 * We deliberately do NOT group by external_id: connecting Facebook/Instagram
 * pulls in every page/account the user admins, so a single OAuth can't be
 * trusted to belong to one client. Instead the portal lets staff explicitly
 * assign specific accounts to each client (stored in client_kv
 * 'postforme_accounts'), and we post only to those.
 */
export async function postformeListAccounts(opts?: { platforms?: string[] }): Promise<PfmAccount[]> {
  const key = apiKey();
  if (!key) return [];
  const params = new URLSearchParams();
  params.set('status', 'connected');
  params.set('limit', '100');
  for (const pl of opts?.platforms || []) params.append('platform', pl);
  try {
    const res = await fetch(`${API}/social-accounts?${params.toString()}`, { headers: authHeaders(key) });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) return [];
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : raw?.items || [];
    return items.map((a: any) => ({
      id: a.id,
      platform: a.platform,
      username: a.username ?? a.display_name ?? null,
      pageId: a.user_id ?? null, // the Facebook/Instagram page id — disambiguates same-named pages
      photo: a.profile_photo_url ?? null,
      status: a.status,
    }));
  } catch {
    return [];
  }
}

// Diagnostic: raw account list with NO status filter, to see exactly what the
// Post for Me API returns (status/platform values, count, HTTP status).
export async function postformeRawAccounts(): Promise<{ ok: boolean; httpStatus: number; count: number; items: any[]; errorBody?: any }> {
  const key = apiKey();
  if (!key) return { ok: false, httpStatus: 0, count: 0, items: [] };
  try {
    const res = await fetch(`${API}/social-accounts?limit=100`, { headers: authHeaders(key) });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, httpStatus: res.status, count: 0, items: [], errorBody: raw };
    const items = Array.isArray(raw?.data) ? raw.data : Array.isArray(raw) ? raw : raw?.items || [];
    // Never return secrets (access_token/refresh_token) — only safe identifiers.
    return {
      ok: res.ok,
      httpStatus: res.status,
      count: items.length,
      items: items.map((a: any) => ({ id: a.id, platform: a.platform, status: a.status, username: a.username ?? null, pageId: a.user_id ?? null, external_id: a.external_id ?? null })),
    };
  } catch (e: any) {
    return { ok: false, httpStatus: -1, count: 0, items: [{ error: e?.message }] };
  }
}

// Generate a connect (OAuth) link for a client to add one platform.
export async function postformeAuthUrl(
  clientId: string,
  platform: string,
  redirect?: string,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const key = apiKey();
  if (!key) return { ok: false, error: 'POST_FOR_ME_API_KEY is not set in the environment.' };
  const pfm = postformePlatform(platform) || platform;
  const body: Record<string, unknown> = { platform: pfm, external_id: clientId };
  if (redirect) body.redirect_url_override = redirect;
  try {
    const res = await fetch(`${API}/social-accounts/auth-url`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(body),
    });
    const raw: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: raw?.error?.message || raw?.message || `Auth URL failed (${res.status})` };
    const url = raw?.url || raw?.auth_url || raw?.data?.url;
    if (!url) return { ok: false, error: 'No auth URL returned by Post for Me.' };
    return { ok: true, url };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Auth URL request failed' };
  }
}

export type PublishInput = {
  accountIds: string[]; // the exact Post for Me accounts to post to
  caption: string;
  mediaUrls?: string[]; // public image/video URLs
  scheduleISO?: string; // optional ISO time; we publish now, so usually omitted
};

export type PublishResult =
  | { ok: true; id: string; accounts: number; raw: any }
  | { ok: false; error: string; raw?: any };

export async function postformePublish(input: PublishInput): Promise<PublishResult> {
  const key = apiKey();
  if (!key) return { ok: false, error: 'POST_FOR_ME_API_KEY is not set in the environment.' };
  const ids = (input.accountIds || []).filter(Boolean);
  if (!ids.length) return { ok: false, error: 'No account assigned to this client for this platform.' };
  if (!input.caption.trim() && !(input.mediaUrls && input.mediaUrls.length)) {
    return { ok: false, error: 'Nothing to post — add a caption or media.' };
  }

  const body: Record<string, unknown> = {
    caption: input.caption,
    social_accounts: ids,
  };
  if (input.mediaUrls && input.mediaUrls.length) body.media = input.mediaUrls.map((url) => ({ url }));
  if (input.scheduleISO) body.scheduled_at = input.scheduleISO;

  try {
    const res = await fetch(`${API}/social-posts`, {
      method: 'POST',
      headers: authHeaders(key),
      body: JSON.stringify(body),
    });
    const raw: any = await res.json().catch(() => ({}));
    const id = raw?.id || raw?.data?.id;
    if (res.ok && id) return { ok: true, id: String(id), accounts: ids.length, raw };
    const err = raw?.error?.message || raw?.message || raw?.errors?.[0]?.message || `Publish failed (${res.status})`;
    return { ok: false, error: err, raw };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Publish request failed' };
  }
}
