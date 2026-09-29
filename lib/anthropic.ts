import Anthropic from '@anthropic-ai/sdk';
import { assertCredit, countsFromUsage, recordUsage } from '@/lib/ai-usage';

/**
 * The portal's Anthropic client.
 *
 * Identical to `new Anthropic()` from the caller's side, with two things
 * added around every model call: it refuses to spend credit the portal
 * doesn't have, and it writes what the call cost to the ledger. Use this
 * everywhere instead of constructing the SDK directly, or the spend on
 * Settings → Anthropic credit quietly stops matching the bill.
 */

export type SpendContext = {
  /** Which part of the portal is spending, e.g. "agents/crm". Shows up in the breakdown. */
  source: string;
  /** The client the work was for, when there is one. */
  clientId?: string | null;
  /** Who triggered it — a signed-in email, or an MCP token subject. */
  actor?: string | null;
};

export function anthropicFor(ctx: SpendContext, options?: ConstructorParameters<typeof Anthropic>[0]): Anthropic {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, ...(options || {}) });
  return meter(client, ctx);
}

/** Wrap an already-constructed client. Exported for the few callers that need custom options. */
export function meter(client: Anthropic, ctx: SpendContext): Anthropic {
  const messages = client.messages as any;

  const originalCreate = messages.create.bind(messages);
  messages.create = async (params: any, requestOptions?: any) => {
    await assertCredit();
    const model = String(params?.model || 'unknown');
    try {
      const result = await originalCreate(params, requestOptions);
      // A streaming call returns a Stream, not a Message. Those are recorded
      // by the stream() wrapper below, once the final message arrives.
      if (result && typeof result === 'object' && (result as any).usage) {
        void recordUsage({ ...ctx, model, counts: countsFromUsage((result as any).usage) });
      }
      return result;
    } catch (err: any) {
      // A refusal to spend is not spend; anything else is worth a row, so a
      // run of failures is visible next to the successful calls.
      if (err?.name !== 'CreditExhaustedError') {
        void recordUsage({
          ...ctx,
          model,
          counts: { inputTokens: 0, outputTokens: 0, cacheWriteTokens: 0, cacheReadTokens: 0 },
          ok: false,
          error: err?.message || String(err),
        });
      }
      throw err;
    }
  };

  // stream() routes through create() above, which sees a Stream and records
  // nothing. The usage totals only exist on the assembled final message.
  const originalStream = messages.stream.bind(messages);
  messages.stream = (params: any, requestOptions?: any) => {
    const stream = originalStream(params, requestOptions);
    try {
      stream.on('finalMessage', (message: any) => {
        void recordUsage({
          ...ctx,
          model: String(message?.model || params?.model || 'unknown'),
          counts: countsFromUsage(message?.usage),
        });
      });
    } catch {
      // An SDK without the event still streams fine; it just goes unmetered.
    }
    return stream;
  };

  return client;
}
