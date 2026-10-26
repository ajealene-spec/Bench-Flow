import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/** Extracts plain text from a PDF in the browser. Nothing is uploaded. */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str;
      text += item.hasEOL ? '\n' : ' ';
    }
    pages.push(text.replace(/[ \t]+\n/g, '\n').trim());
  }

  await doc.destroy();
  return pages.filter(Boolean).join('\n\n');
}
