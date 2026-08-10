import { getAccessToken } from './google-calendar';

/**
 * Google Business Profile helpers — reviews via the connected staff
 * member's OAuth tokens (scope: business.manage) instead of a Places
 * API key. Uses three Google APIs, all under the same OAuth consent:
 *
 *   - Account Management: list the GBP accounts the user can manage
 *   - Business Information: list locations under an account
 *   - My Business v4: list reviews + post/update review replies
 *
 * All three must be ENABLED on the Google Cloud project that owns the
 * OAuth client. The v4 reviews API additionally needs GBP API access
 * approved for the project (Google's access-request form) — until then
 * Google returns 403/429 with a "quota" or "not authorized" message,
 * which we surface verbatim so the UI can show what's missing.
 */

const ACCOUNT_MGMT = 'https://mybusinessaccountmanagement.googleapis.com/v1';
const BUSINESS_INFO = 'https://mybusinessbusinessinformation.googleapis.com/v1';
const MYBUSINESS_V4 = 'https://mybusiness.googleapis.com/v4';

const STAR_TO_NUMBER: Record<string, number> = {
  ONE: 1,
  TWO: 2,
  THREE: 3,
  FOUR: 4,
  FIVE: 5,
};

export type GbpAccount = { name: string; accountName: string; type: string };
export type GbpLocation = { name: string; title: string };
export type GbpReview = {
  googleReviewId: string;
  reviewName: string; // full resource name, needed to post a reply
  authorName: string | null;
  authorPhotoUrl: string | null;
  rating: number;
  reviewText: string | null;
  reviewDate: string | null;
  replyText: string | null;
  replyDate: string | null;
};

export class GbpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function gbpFetch(userEmail: string, url: string, init?: RequestInit): Promise<any> {
  const accessToken = await getAccessToken(userEmail);
  if (!accessToken) {
    throw new GbpError(401, 'Google not connected for this user — connect (or reconnect) Google first.');
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const body = await res.text();
  if (!res.ok) {
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed?.error?.message || body;
    } catch {}
    if (res.status === 401 || (res.status === 403 && /insufficient/i.test(message))) {
      message = `Google rejected the token (${message}). The connection likely predates the Business Profile scope — disconnect and reconnect Google to re-consent.`;
    } else if (res.status === 403 || res.status === 429) {
      message = `Google Business Profile API blocked the request (${message}). Check that the APIs are enabled on the Cloud project and GBP API access/quota has been granted.`;
    }
    throw new GbpError(res.status, message);
  }
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw new GbpError(502, 'Google returned an unparseable response');
  }
}

/** List GBP accounts the connected user can manage. */
export async function listAccounts(userEmail: string): Promise<GbpAccount[]> {
  const accounts: GbpAccount[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '20' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await gbpFetch(userEmail, `${ACCOUNT_MGMT}/accounts?${params}`);
    for (const a of data.accounts || []) {
      accounts.push({ name: a.name, accountName: a.accountName || a.name, type: a.type || '' });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return accounts;
}

/** List locations under a GBP account (accountName = "accounts/123"). */
export async function listLocations(userEmail: string, accountName: string): Promise<GbpLocation[]> {
  const locations: GbpLocation[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ readMask: 'name,title', pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await gbpFetch(userEmail, `${BUSINESS_INFO}/${accountName}/locations?${params}`);
    for (const l of data.locations || []) {
      locations.push({ name: l.name, title: l.title || l.name });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return locations;
}

function normalizeReview(r: any): GbpReview | null {
  if (!r?.reviewId && !r?.name) return null;
  return {
    googleReviewId: r.reviewId || String(r.name).split('/').pop(),
    reviewName: r.name,
    authorName: r.reviewer?.displayName || null,
    authorPhotoUrl: r.reviewer?.profilePhotoUrl || null,
    rating: STAR_TO_NUMBER[r.starRating] || 0,
    reviewText: r.comment || null,
    reviewDate: r.createTime || null,
    replyText: r.reviewReply?.comment || null,
    replyDate: r.reviewReply?.updateTime || null,
  };
}

/**
 * List all reviews for a location.
 * accountName = "accounts/123", locationName = "locations/456".
 */
export async function listReviews(
  userEmail: string,
  accountName: string,
  locationName: string,
): Promise<GbpReview[]> {
  const reviews: GbpReview[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({ pageSize: '50' });
    if (pageToken) params.set('pageToken', pageToken);
    const data = await gbpFetch(
      userEmail,
      `${MYBUSINESS_V4}/${accountName}/${locationName}/reviews?${params}`,
    );
    for (const r of data.reviews || []) {
      const n = normalizeReview(r);
      if (n) reviews.push(n);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return reviews;
}

/** Create or update the owner reply on a review. */
export async function replyToReview(
  userEmail: string,
  accountName: string,
  locationName: string,
  reviewId: string,
  comment: string,
): Promise<void> {
  await gbpFetch(
    userEmail,
    `${MYBUSINESS_V4}/${accountName}/${locationName}/reviews/${encodeURIComponent(reviewId)}/reply`,
    { method: 'PUT', body: JSON.stringify({ comment }) },
  );
}
