import { errorBody, json, type ApiRequest, type ApiResponse } from './types';

/** Reads and parses a JSON body, or returns the error response to send. */
export async function readJson(
  req: ApiRequest,
  maxBytes: number,
): Promise<{ ok: true; value: unknown } | { ok: false; response: ApiResponse }> {
  let raw: string;
  try {
    raw = await req.readBody(maxBytes);
  } catch {
    return { ok: false, response: json(413, errorBody('body_too_large')) };
  }
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false, response: json(400, errorBody('invalid_json')) };
  }
}
