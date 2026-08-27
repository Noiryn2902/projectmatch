import 'server-only';

/**
 * Getting text out of whatever someone uploads.
 *
 * Three formats, because those are the three a real CV arrives as: a PDF
 * (including the one LinkedIn's own "Save to PDF" button produces on any
 * profile — that is a person exporting their own data, not us scraping
 * theirs), a Word document, or plain text.
 *
 * Both parsers are imported lazily. They are large, only run on the handful
 * of requests that carry a file, and pulling them into the module graph of
 * every server component that happens to import a sibling would be a real
 * cost for nothing.
 *
 * Nothing is stored. The bytes are read into text, the text is read for
 * skills, and both are discarded when the request ends — there is no bucket
 * holding anyone's résumé.
 */

/** Anything larger is not a CV, and is refused before it is parsed. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

export const ACCEPTED = '.pdf,.docx,.txt,.md,application/pdf,text/plain';

export class DocumentError extends Error {}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i === -1 ? '' : name.slice(i).toLowerCase();
}

export async function readDocument(file: File): Promise<string> {
  if (file.size === 0) throw new DocumentError('That file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new DocumentError('That file is larger than 8MB — a résumé should be well under it.');
  }

  const ext = extensionOf(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    if (ext === '.pdf' || file.type === 'application/pdf') {
      const { extractText, getDocumentProxy } = await import('unpdf');
      const pdf = await getDocumentProxy(bytes);
      // mergePages narrows the return to a single string; the array form is
      // what you get without it.
      const { text } = await extractText(pdf, { mergePages: true });
      return text;
    }

    if (ext === '.docx') {
      const mammoth = await import('mammoth');
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      return value;
    }

    if (ext === '.txt' || ext === '.md' || file.type.startsWith('text/')) {
      return new TextDecoder().decode(bytes);
    }
  } catch (err) {
    // A corrupt or password-protected file is the caller's problem to
    // explain, not a stack trace to leak.
    console.error('[upload] could not read', file.name, err);
    throw new DocumentError('That file could not be read. A PDF, Word file, or plain text works.');
  }

  if (ext === '.doc') {
    throw new DocumentError('Old .doc files are not supported — save it as .docx or PDF first.');
  }
  throw new DocumentError('Upload a PDF, a Word .docx, or a plain text file.');
}
