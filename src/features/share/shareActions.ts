import { benchflowFileName, serializeBenchflow, type BenchflowPayload } from './benchflowFile';

export type ShareOutcome = 'shared' | 'copied' | 'downloaded' | 'cancelled' | 'failed';

/** Downloads text as a file. Uses an object URL so nothing leaves the device. */
export function downloadText(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Saves the protocol as a .benchflow.json file. Comments are included. */
export function downloadBenchflowFile(payload: BenchflowPayload): void {
  downloadText(benchflowFileName(payload.metadata.title), serializeBenchflow(payload), 'application/json');
}

/**
 * Shares a link with the native share sheet when the device has one, otherwise copies it.
 * A cancelled share sheet is reported as cancelled, not as a failure.
 */
export async function shareLink(url: string, title: string): Promise<ShareOutcome> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text: `Bench Flow protocol: ${title}`, url });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Other share errors fall through to copying the link.
    }
  }
  return (await copyText(url)) ? 'copied' : 'failed';
}

/** Shares the .benchflow.json file with the native sheet when files can be shared, otherwise downloads it. */
export async function shareFile(payload: BenchflowPayload): Promise<ShareOutcome> {
  const name = benchflowFileName(payload.metadata.title);
  const file = new File([serializeBenchflow(payload)], name, { type: 'application/json' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: payload.metadata.title });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBenchflowFile(payload);
  return 'downloaded';
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
