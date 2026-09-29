import { query } from '@/lib/db';

/**
 * Anthropic credit: what the portal has paid for, and what it has spent.
 *
 * Anthropic bills the organisation, not the portal, and its API has no
 * "what is my balance" endpoint. So the portal keeps its own ledger: you
 * record a top-up here when you buy credit, every model call is priced from
 * the token counts Anthropic returns, and the balance is the difference.
 * It tracks the real bill as closely as the price table below is correct,
 * which is why the price table is overridable without a deploy.
 */

/** USD per million tokens. */
export type ModelRate = {
  input: number;
  output: number;
  /** 5-minute cache writes. Anthropic charges these at 1.25x input. */
  cacheWrite: number;
  /** Cache reads. Charged at 0.1x input. */
  cacheRead: number;
};

function rate(input: number, output: number): ModelRate {
  return { input, output, cacheWrite: input * 1.25, cacheRead: input * 0.1 };
}

/**
 * List prices as published at the time of writing. Verify against
 * anthropic.com/pricing when a model is added or a price moves — a wrong
 * number here doesn't change the bill, only the portal's estimate of it.
 * ANTHROPIC_PRICE_OVERRIDES lets you correct one without a deploy:
 *   {"claude-opus-5": {"input": 15, "output": 75}}
 */
const BASE_RATES: Record<string, ModelRate> = {
  'claude-opus-5': rate(15, 75),
  'claude-sonnet-5': rate(3, 15),
  'claude-haiku-4-5': rate(1, 5),
};

/** Fallback for a model we have no price for — Sonnet, the middle tier. */
const DEFAULT_RATE = rate(3, 15);

let overrides: Record<string, Partial<ModelRate>> | null = null;
function priceOverrides(): Record<string, Partial<ModelRate>> {
  if (overrides) return overrides;
  try {
    overrides = JSON.parse(process.env.ANTHROPIC_PRICE_OVERRIDES || '{}');
  } catch {
    console.warn('[ai-usage] ANTHROPIC_PRICE_OVERRIDES is not valid JSON; ignoring it');
    overrides = {};
  }
  return overrides!;
}

/** Model ids carry dated suffixes (…-20251001); price on the family. */
function rateFor(model: string): ModelRate {
  const over = priceOverrides();
  const keys = [model, ...Object.keys(BASE_RATES).filter((k) => model.startsWith(k))];
  for (const key of keys) {
    const base = BASE_RATES[key];
    const patch = over[key];
    if (base || patch) {
      const merged = { ...(base || DEFAULT_RATE), ...(patch || {}) };
      // An override that sets input alone should move the cache rates with it.
      if (patch && patch.input !== undefined && patch.cacheWrite === undefined) {
        merged.cacheWrite = patch.input * 1.25;
      }
      if (patch && patch.input !== undefined && patch.cacheRead === undefined) {
        merged.cacheRead = patch.input * 0.1;
      }
      return merged;
    }
  }
  return DEFAULT_RATE;
}

export type TokenCounts = {
  inputTokens: number;
  outputTokens: number;
  cacheWriteTokens: number;
  cacheReadTokens: number;
};

/** What one call cost, in USD. */
export function costOf(model: string, counts: TokenCounts): number {
  const r = rateFor(model);
  const usd =
    (counts.inputTokens * r.input +
      counts.outputTokens * r.output +
      counts.cacheWriteTokens * r.cacheWrite +
      counts.cacheReadTokens * r.cacheRead) /
    1_000_000;
  // Six decimals matches the ai_usage column; a single cheap call is ~$0.0002.
  return Math.round(usd * 1e6) / 1e6;
}

/** Pull the token counts out of a Message, whatever the SDK version calls them. */
export function countsFromUsage(usage: any): TokenCounts {
  return {
    inputTokens: Number(usage?.input_tokens || 0),
    outputTokens: Number(usage?.output_tokens || 0),
    cacheWriteTokens: Number(usage?.cache_creation_input_tokens || 0),
    cacheReadTokens: Number(usage?.cache_read_input_tokens || 0),
  };
}

export type UsageEntry = {
  /** Which part of the portal spent it, e.g. "agents/crm", "content-calendar/generate". */
  source: string;
  model: string;
  clientId?: string | null;
  actor?: string | null;
  counts: TokenCounts;
  ok?: boolean;
  error?: string | null;
};

/**
 * Write one call to the ledger. Never throws: metering must not be able to
 * take down a feature that was otherwise working.
 */
export async function recordUsage(entry: UsageEntry): Promise<void> {
  try {
    const cost = costOf(entry.model, entry.counts);
    await query(
      `insert into ai_usage
         (source, model, client_id, actor, input_tokens, output_tokens,
          cache_write_tokens, cache_read_tokens, cost_usd, ok, error)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        entry.source,
        entry.model,
        entry.clientId || null,
        entry.actor || null,
        entry.counts.inputTokens,
        entry.counts.outputTokens,
        entry.counts.cacheWriteTokens,
        entry.counts.cacheReadTokens,
        cost,
        entry.ok !== false,
        entry.error ? String(entry.error).slice(0, 500) : null,
      ],
    );
    balanceCache = null; // the next check should see this spend
  } catch (err: any) {
    console.error('[ai-usage] could not record usage:', err?.message || err);
  }
}

export type CreditSettings = {
  lowBalanceUsd: number;
  /** When true, calls are refused once the balance reaches zero. */
  hardStop: boolean;
};

export type CreditSummary = CreditSettings & {
  toppedUpUsd: number;
  /** Whether any top-up has ever been recorded — not the same as a positive total. */
  hasLedger: boolean;
  spentUsd: number;
  balanceUsd: number;
  spentLast30Usd: number;
  spentLast7Usd: number;
  /** Days of runway at the last 7 days' rate; null when nothing was spent. */
  daysRemaining: number | null;
  low: boolean;
};

export async function creditSettings(): Promise<CreditSettings> {
  const { rows } = await query<{ low_balance_usd: string; hard_stop: boolean }>(
    `select low_balance_usd, hard_stop from ai_credit_settings where id = true`,
  );
  const row = rows[0];
  return {
    lowBalanceUsd: row ? Number(row.low_balance_usd) : 25,
    hardStop: row ? !!row.hard_stop : false,
  };
}

export async function creditSummary(): Promise<CreditSummary> {
  const [ledger, spend, settings] = await Promise.all([
    query<{ total: string; entries: number }>(
      `select coalesce(sum(amount_usd), 0)::text as total, count(*)::int as entries from ai_credit_ledger`,
    ),
    query<{ total: string; last30: string; last7: string }>(
      `select coalesce(sum(cost_usd), 0)::text as total,
              coalesce(sum(cost_usd) filter (where at > now() - interval '30 days'), 0)::text as last30,
              coalesce(sum(cost_usd) filter (where at > now() - interval '7 days'), 0)::text as last7
         from ai_usage where ok`,
    ),
    creditSettings(),
  ]);

  const toppedUpUsd = Number(ledger.rows[0]?.total || 0);
  const hasLedger = Number(ledger.rows[0]?.entries || 0) > 0;
  const spentUsd = Number(spend.rows[0]?.total || 0);
  const spentLast7Usd = Number(spend.rows[0]?.last7 || 0);
  const balanceUsd = toppedUpUsd - spentUsd;
  const perDay = spentLast7Usd / 7;

  return {
    ...settings,
    toppedUpUsd,
    hasLedger,
    spentUsd,
    balanceUsd,
    spentLast30Usd: Number(spend.rows[0]?.last30 || 0),
    spentLast7Usd,
    daysRemaining: perDay > 0 ? Math.max(0, Math.floor(balanceUsd / perDay)) : null,
    low: hasLedger && balanceUsd <= settings.lowBalanceUsd,
  };
}

/** Thrown when the portal is out of credit and hard stop is on. */
export class CreditExhaustedError extends Error {
  constructor(balanceUsd: number) {
    super(
      `The portal is out of Anthropic credit (balance $${balanceUsd.toFixed(2)}). ` +
        `Add credit in Settings → Anthropic credit to turn the AI features back on.`,
    );
    this.name = 'CreditExhaustedError';
  }
}

// One balance read per 30s per warm function, rather than per model call.
let balanceCache: { at: number; balanceUsd: number; hardStop: boolean; hasLedger: boolean } | null = null;
const BALANCE_TTL_MS = 30_000;

/**
 * Refuse the call when the credit has run out.
 *
 * Deliberately fails open. If the ledger is unreadable, or no credit has ever
 * been recorded, every AI feature keeps working exactly as it did before —
 * a database blip should not silently switch off the portal, and neither
 * should never having used this page.
 */
export async function assertCredit(): Promise<void> {
  const now = Date.now();
  if (!balanceCache || now - balanceCache.at > BALANCE_TTL_MS) {
    try {
      const summary = await creditSummary();
      balanceCache = {
        at: now,
        balanceUsd: summary.balanceUsd,
        hardStop: summary.hardStop,
        hasLedger: summary.hasLedger,
      };
    } catch (err: any) {
      console.error('[ai-usage] could not read the credit balance:', err?.message || err);
      return; // fail open
    }
  }
  // hasLedger, not a positive total: once the spend has eaten the top-ups the
  // sum is zero, which is exactly when the stop is supposed to fire.
  const { hardStop, balanceUsd, hasLedger } = balanceCache;
  if (hardStop && hasLedger && balanceUsd <= 0) throw new CreditExhaustedError(balanceUsd);
}

/** Drop the cached balance — call after a top-up so the next check sees it. */
export function invalidateCreditCache(): void {
  balanceCache = null;
}
