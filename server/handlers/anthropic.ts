export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION_HEADER_VALUE = '2023-06-01';
/** Largest body the parse route accepts (pasted text or PDF text). */
export const PARSE_MAX_BODY_BYTES = 1_000_000;
/** Largest body the assist routes accept. */
export const ASSIST_MAX_BODY_BYTES = 200_000;

export interface MessageResponse {
  content?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  stop_reason?: string;
}

export type UpstreamResult = { ok: true; data: MessageResponse } | { ok: false; status: number };

/**
 * Calls the Messages API with the given key. The key goes only into the x-api-key header. Upstream
 * bodies are not returned, so nothing from the provider can leak into a browser response or a log.
 */
export async function callAnthropic(apiKey: string, body: Record<string, unknown>): Promise<UpstreamResult> {
  let upstream: Response;
  try {
    upstream = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION_HEADER_VALUE,
      },
      body: JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 502 };
  }
  if (!upstream.ok) return { ok: false, status: upstream.status };
  return { ok: true, data: (await upstream.json()) as MessageResponse };
}

export function textOfBlocks(blocks: MessageResponse['content']): string {
  return (blocks ?? [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text ?? '')
    .join('');
}
