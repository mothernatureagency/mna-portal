# MCP server

The portal exposes its own MCP server at `POST /api/mcp`. Point Claude at it and
Claude can read the team task board, the staff roster and the client list —
through the same `lib/` code the portal pages use, so there is no second copy of
the rules to keep in sync.

One server, many clients. The same URL serves Claude Code, Claude Desktop, and
(once wired) our own in-portal agents, so a tool added here shows up everywhere
at once.

## What it can do today

| Tool | Answers |
| --- | --- |
| `list_tasks` | "What is Sable working on?", "What's overdue for Prime IV?" |
| `get_task` | Full detail on one task, plus the recurring template it came from |
| `team_workload` | Open / overdue / due-this-week / done-this-month, per teammate |
| `whats_blocked` | Standing status check: overdue tasks, unowned tasks, stale client requests |
| `list_staff` | The roster, with the emails the board actually stores |
| `list_clients` | Every client id the portal knows |

All read-only. Writes (creating and assigning tasks, the approval queue,
notifying teammates) land in the next pass — the scopes for them already exist.

## Minting a token

`/api/mcp` doesn't use the portal session cookie — an MCP client has no browser
session — so it carries its own bearer token. Only the owner can mint one:

```bash
curl -X POST https://<portal>/api/mcp-tokens \
  -H 'Content-Type: application/json' \
  -b '<your portal session cookie>' \
  -d '{"name":"Alexus laptop","subjectEmail":"mn@mothernatureagency.com","role":"owner"}'
```

The response contains the raw token **once**. Only its SHA-256 is stored, so a
leaked `mcp_tokens` row can't be replayed, and a lost token is re-minted rather
than recovered.

- `GET /api/mcp-tokens` lists tokens (prefix, scopes, last used) — never the values.
- `DELETE /api/mcp-tokens?id=…` revokes. The row stays, so "who had access, and
  when" survives.

### Scopes

Authority is the token's scope list. `role` is a label that only picks the
*default* scopes at mint time; once minted, the stored scopes are the whole
truth.

| Scope | Grants |
| --- | --- |
| `tasks:read` | Every tool above |
| `tasks:write` | Creating, assigning and updating tasks (next pass) |
| `approvals:read` | Seeing the approval queue (next pass) |
| `approvals:decide` | Approving or denying — owner default only (next pass) |
| `team:notify` | Emailing a teammate through the existing notification rail (next pass) |

Defaults: `owner` gets everything, `staff`/`manager` get everything except
`approvals:decide`, `agent` gets read-only, `readonly` gets `tasks:read`.

Pass `clientIds` to pin a token to specific clients:

```json
{"name":"Ads agent (Prime IV)","subjectEmail":"agent+ads@mothernatureagency.com",
 "role":"agent","clientIds":["prime-iv"]}
```

A client-scoped token sees only those clients' rows — and *not* tasks with no
client attached, since those are agency business rather than that client's.

## Connecting a client

Claude Code:

```bash
claude mcp add --transport http mna https://<portal>/api/mcp \
  --header "Authorization: Bearer mna_mcp_…"
```

Anything else that speaks Streamable HTTP with a custom header works the same
way. Adding it to **claude.ai** as a custom connector needs OAuth rather than a
bearer token — that's a discovery endpoint plus an authorization server, and is
a separate piece of work if we want it.

## How it's built

- `app/api/mcp/route.ts` — JSON-RPC over Streamable HTTP. Deliberately
  **stateless**: no session id, no server-initiated SSE stream, because Vercel
  functions don't survive between invocations and a session-based transport
  would drop connections at random. `GET` and `DELETE` answer 405, per spec.
- `lib/mcp/auth.ts` — token hashing, minting, and the identity a request resolves to.
- `lib/mcp/tools.ts` — the tool registry. Each tool declares the scope it needs;
  the route hides it from `tools/list` and refuses the call without that scope.
- `middleware.ts` — `/api/mcp` is matched **exactly** as a public route, so the
  owner-only `/api/mcp-tokens` keeps going through cookie auth.
- `lib/db.ts` — the `mcp_tokens` table.

Tools are coarse on purpose. The portal has ~100 API routes; one tool per route
would bury a model in choices it can't rank, so each tool here answers a
question someone actually asks.

### Local testing

`lib/db.ts` always connects with TLS, so a local Postgres needs SSL enabled
(`-c ssl=on` with a self-signed cert) or the pool fails with "The server does
not support SSL connections".
