import React from 'react';
import { createClient } from '@/lib/supabase/server';
import { isOwner } from '@/lib/staff';
import { getClient, grantableScopes } from '@/lib/mcp/oauth';
import { ensureSchema } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The consent screen.
 *
 * This is the whole point of using OAuth rather than a pasted token: nothing
 * gets access without a signed-in member of staff reading what is being asked
 * for and saying yes. The form posts to /api/oauth/authorize, which re-reads
 * the session and ignores anything here that claims to be an identity.
 *
 * Reached without a session, middleware sends the visitor to /login and back,
 * query string intact.
 */

const STAFF_EXCLUDED = ['client', 'contractor', 'student', 'creator'];

const SCOPE_WORDS: Record<string, string> = {
  'tasks:read': 'Read the team task board',
  'tasks:write': 'Create and update tasks',
  'schedule:read': 'Read your calendar',
  'schedule:write': 'Add and change your calendar events',
  'memory:read': 'Read your saved notes',
  'memory:write': 'Save notes for you',
  'marketing:read': 'Read campaigns and the content calendar',
  'approvals:read': 'See what is waiting for approval',
  'approvals:decide': 'Approve or reject on your behalf',
  'team:notify': 'Send notifications to the team',
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
         style={{ background: 'linear-gradient(135deg,#0a1929 0%,#0d2b47 25%,#124b73 50%,#1e79a6 75%,#4ab8ce 100%)' }}>
      <div className="w-full max-w-lg rounded-[22px] border border-white/15 bg-white/[0.08] p-8 text-white backdrop-blur-xl">
        {children}
      </div>
    </div>
  );
}

function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <Shell>
      <h1 className="text-xl font-semibold">{title}</h1>
      <p className="mt-3 text-white/70">{detail}</p>
    </Shell>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await ensureSchema();

  const one = (k: string) => {
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v || '';
  };

  const clientId = one('client_id');
  const redirectUri = one('redirect_uri');
  const responseType = one('response_type');
  const codeChallenge = one('code_challenge');
  const challengeMethod = one('code_challenge_method');
  const state = one('state');
  const scope = one('scope');
  const resource = one('resource');

  if (!clientId || !redirectUri) {
    return <Problem title="Incomplete request" detail="The application did not send a client_id and redirect_uri." />;
  }

  const client = await getClient(clientId);
  // Bad client or unregistered redirect: show it here rather than bouncing
  // the browser to an address nobody vouched for.
  if (!client) {
    return <Problem title="Unknown application" detail="This application is not registered with the portal. Ask it to connect again." />;
  }
  if (!client.redirect_uris.includes(redirectUri)) {
    return <Problem title="Unrecognised return address" detail="This application asked to be sent back somewhere it never registered, so the request was stopped." />;
  }
  if (responseType && responseType !== 'code') {
    return <Problem title="Unsupported request" detail={`Only the authorization code flow is supported; this asked for "${responseType}".`} />;
  }
  if (!codeChallenge || (challengeMethod && challengeMethod !== 'S256')) {
    return <Problem title="Unsupported request" detail="This application must use PKCE with SHA-256 (code_challenge_method=S256)." />;
  }

  let email = '';
  let portalRole = 'staff';
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    email = (user?.email || '').toLowerCase();
    portalRole = ((user?.user_metadata as Record<string, unknown> | null)?.role as string) || 'staff';
  } catch {
    /* handled below */
  }
  if (!email) {
    return <Problem title="Not signed in" detail="Sign in to the portal and open this link again." />;
  }
  if (STAFF_EXCLUDED.includes(portalRole)) {
    return (
      <Problem
        title="This account can't grant access"
        detail="These tools read the agency task board and client list. Only staff accounts can approve access to them."
      />
    );
  }

  const scopes = grantableScopes(isOwner(email) ? 'owner' : 'staff', scope || null);
  if (scopes.length === 0) {
    return <Problem title="Nothing to grant" detail="None of the permissions this application asked for are available to your account." />;
  }

  const appName = client.client_name || 'An application';

  return (
    <Shell>
      <h1 className="text-xl font-semibold">Connect {appName} to the portal?</h1>
      <p className="mt-2 text-white/70">
        Signed in as <span className="text-white">{email}</span>. {appName} will act as you, and see only what you can see.
      </p>

      <div className="mt-6">
        <span className="text-sm font-medium text-white/80">It will be able to:</span>
        <ul className="mt-2 space-y-1.5">
          {scopes.map((s) => (
            <li key={s} className="flex gap-2 text-sm text-white/70">
              <span aria-hidden className="text-white/40">•</span>
              <span>{SCOPE_WORDS[s] || s}</span>
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-xs text-white/60">
        Only approve this if you started it. Access lasts until you revoke it in
        Settings, and each request is checked against your account every time.
      </p>

      <form method="POST" action="/api/oauth/authorize" className="mt-6 flex gap-3">
        <input type="hidden" name="client_id" value={clientId} />
        <input type="hidden" name="redirect_uri" value={redirectUri} />
        <input type="hidden" name="state" value={state} />
        <input type="hidden" name="code_challenge" value={codeChallenge} />
        <input type="hidden" name="scope" value={scope} />
        <input type="hidden" name="resource" value={resource} />
        <button
          type="submit" name="decision" value="allow"
          className="flex-1 rounded-lg bg-[#0c6da4] px-5 py-2.5 font-medium text-white hover:bg-[#0a5c8c]"
        >
          Allow
        </button>
        <button
          type="submit" name="decision" value="deny"
          className="rounded-lg border border-white/15 px-5 py-2.5 font-medium text-white/80 hover:bg-white/5"
        >
          Cancel
        </button>
      </form>
    </Shell>
  );
}
