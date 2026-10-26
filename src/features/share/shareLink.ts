import { parseBenchflowPayload, SHARE_LINK_WARN_BYTES, type BenchflowPayload } from './benchflowFile';

/**
 * Share links carry the protocol in the URL hash (#d=...). Browsers never send the hash to a server,
 * so no backend is needed. The payload is JSON, deflated, then base64url encoded.
 */
const HASH_KEY = 'd';

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(text.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Runs bytes through a (de)compression stream and collects the output. Avoids Blob.stream and Response, which jsdom lacks. */
async function transform(input: Uint8Array, stream: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const source = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(input);
      controller.close();
    },
  });
  const reader = source.pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

/** Compresses and encodes a payload into the text that goes after "#d=". */
export async function encodeSharePayload(payload: BenchflowPayload): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const compressed = await transform(bytes, new CompressionStream('deflate'));
  return toBase64Url(compressed);
}

/** Reverses encodeSharePayload. Throws a readable Error when the text is not a valid share payload. */
export async function decodeSharePayload(encoded: string): Promise<BenchflowPayload> {
  let json: string;
  try {
    const bytes = fromBase64Url(encoded.trim());
    const inflated = await transform(bytes, new DecompressionStream('deflate'));
    json = new TextDecoder().decode(inflated);
  } catch {
    throw new Error('This share link is damaged or incomplete. Ask for the .benchflow.json file instead.');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('This share link is damaged or incomplete. Ask for the .benchflow.json file instead.');
  }
  return parseBenchflowPayload(parsed);
}

/** Reads the payload from a URL hash such as "#d=...". Returns null when there is no payload in the hash. */
export function readShareHash(hash: string): string | null {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(text);
  const value = params.get(HASH_KEY);
  return value && value.length > 0 ? value : null;
}

export interface ShareLink {
  url: string;
  /** Length of the encoded payload in bytes (the part after "#d="). */
  bytes: number;
  /** True when the link is long enough that chat apps may truncate it. */
  tooLong: boolean;
}

/** Builds a /shared#d=... link for a payload. The origin is passed in so the function stays testable. */
export async function buildShareLink(origin: string, payload: BenchflowPayload): Promise<ShareLink> {
  const encoded = await encodeSharePayload(payload);
  return {
    url: `${origin.replace(/\/$/, '')}/shared#${HASH_KEY}=${encoded}`,
    bytes: encoded.length,
    tooLong: encoded.length > SHARE_LINK_WARN_BYTES,
  };
}
