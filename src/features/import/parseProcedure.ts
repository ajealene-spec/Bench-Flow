import { apiKeyHeaders } from '../../app/apiKey';
import { apiUrl } from '../../app/apiBase';
import { mapAiProtocol, validateAiProtocol } from './aiSchema';
import type { ProtocolDraft } from './draft';
import { parseOffline } from './offlineParse';

/** The import result. Both readers produce this shape. */
export type ParseOutcome = ProtocolDraft;

export const AI_READER_LABEL = 'AI reader';
export const OFFLINE_READER_LABEL = 'Offline reader — add an API key in Settings for best results';

/** Whether the dev server has an Anthropic API key. Null when the server cannot be reached. */
export async function getParserStatus(): Promise<boolean | null> {
  if (!navigator.onLine) return null;
  try {
    const res = await fetch(apiUrl('/api/parse'), { headers: await apiKeyHeaders() });
    if (!res.ok) return null;
    const info = (await res.json()) as { configured?: boolean };
    return Boolean(info.configured);
  } catch {
    return null;
  }
}

function offline(text: string, note: string): ParseOutcome {
  return { ...parseOffline(text), note };
}

/**
 * Uses the AI reader when online and configured. The server's answer is validated again here, with
 * the pasted text as the source, so hazard quotes must appear in what the user pasted. Any failure
 * falls back to the offline reader, and the note says why.
 */
export async function parseProcedure(text: string): Promise<ParseOutcome> {
  if (!navigator.onLine) return offline(text, 'You are offline, so the offline reader was used.');

  try {
    const status = await fetch(apiUrl('/api/parse'), { headers: await apiKeyHeaders() });
    const info = status.ok ? ((await status.json()) as { configured?: boolean }) : {};
    if (!info.configured) return offline(text, 'No Anthropic API key is set, so the offline reader was used.');

    const res = await fetch(apiUrl('/api/parse'), {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(await apiKeyHeaders()) },
      body: JSON.stringify({ text }),
    });
    if (res.ok) {
      const data = (await res.json()) as { protocol?: unknown };
      const checked = validateAiProtocol(data.protocol, text);
      if (checked.ok) return mapAiProtocol(checked.protocol, text);
    }
    return offline(text, 'The AI reader could not read this text, so the offline reader was used.');
  } catch {
    return offline(text, 'The AI reader is unreachable, so the offline reader was used.');
  }
}
