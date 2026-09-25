# MCP server

The portal exposes its own MCP server at `POST /api/mcp`. Point Claude at it and
Claude can read the team task board, the staff roster and the client list —
through the same `lib/` code the portal pages use, so there is no second copy of
the rules to keep in sync.

One registry, many clients. The tools live in `lib/mcp/tools.ts` and are reached
two ways:

- **over the wire** by Claude Code, Claude Desktop and anything else speaking
  MCP, through `app/api/mcp/route.ts`;
- **in-process** by the portal's own agents — Jarvis/MOTHER at `/jarvis` and
  `/assistant` — through `lib/mcp/local.ts`, which skips the network entirely
  since they already share the process and the database.

So a tool added once shows up in the voice HUD and in Claude Code together.
Jarvis used to define its own twelve tools inside `app/api/assistant/route.ts`;
those moved here, and four of them were duplicates of tools this registry
already had.

## The tools

| Tool | Scope | Answers |
| --- | --- | --- |
| `list_tasks` | `tasks:read` | "What is Sable working on?", "What's overdue for Prime IV?" |
| `get_task` | `tasks:read` | Full detail on one task, plus the template it came from |
| `team_workload` | `tasks:read` | Open / overdue / due-this-week / done-this-month, per teammate |
| `whats_blocked` | `tasks:read` | Overdue tasks, unowned tasks, stale client requests |
| `list_staff` | `tasks:read` | The roster, with the emails the board stores |
| `list_clients` | `tasks:read` | Every client id the portal knows |
| `create_task` | `tasks:write` | Assign work, including monthly / per-new-client recurring |
| `update_task` | `tasks:write` | Mark done, move a deadline, reassign, re-prioritize |
| `add_event` | `schedule:write` | Put a meeting or reminder on the caller's schedule (syncs to Google) |
| `list_events` | `schedule:read` | "What's on my schedule this week" |
| `complete_event` / `delete_event` | `schedule:write` | Close or drop one of the caller's events |
| `remember` / `recall` | `memory:write` / `memory:read` | The caller's own long-term notes |
| `list_campaigns` | `marketing:read` | Email and SMS pipeline |
| `list_content` | `marketing:read` | Content calendar posts and approval status |

Schedule and memory tools are **personal**: they act on the caller's own rows
and can't reach anyone else's.

Still to come: the approval queue (`approvals:read`, `approvals:decide`) and
teammate notifications (`team:notify`). Their scopes exist; the tools don't yet.

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

Scopes are listed in the tool table above. Defaults by role: `owner` gets
everything, `staff`/`manager` get everything except `approvals:decide`, `agent`
gets `tasks:read` + `marketing:read` + `approvals:read`, `readonly` gets
`tasks:read` + `marketing:read`.

A portal session gets the same treatment: `lib/mcp/local.ts` builds an identity
from the session cookie and hands it `defaultScopesForRole('owner' | 'staff')`.
Client, contractor, student and creator accounts get no tool identity at all.

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
- `lib/mcp/local.ts` — the in-process bridge for the portal's own agents:
  converts the registry to Messages API `tools`, resolves the caller from their
  session cookie, and runs handlers directly.
- `app/api/assistant/route.ts` — Jarvis/MOTHER. Keeps its voice, its pre-loaded
  context and its tool loop; owns no tool definitions.
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
