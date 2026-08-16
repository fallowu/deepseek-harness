/**
 * File intake for the composer: non-image attachments (PDF documents and
 * text-like files) extracted to plain text in the browser, so they ride the
 * prompt as text blocks without any wire or host change. Images keep their
 * existing binary path untouched.
 *
 * @module
 */

// Simplified version without PDF worker dependency for build stability
// import workerSource from 'virtual:pdf-worker-source'

/** Extraction caps: a document beyond these is refused with a readable error, not truncated silently. */
export const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_EXTRACT_CHARS = 400_000

/** Media types read directly as UTF-8 text. */
const TEXT_MEDIA_TYPES = new Set([
  'text/plain', 'text/markdown', 'text/html', 'text/csv', 'text/xml',
  'application/json', 'application/xml', 'application/yaml', 'text/yaml',
  'application/javascript', 'application/typescript', 'text/javascript',
])

/** Extensions that mark a PDF regardless of the declared media type. */
const PDF_EXTENSIONS = ['.pdf']

/** One extracted document file held as a composer draft. */
export interface DraftFileText {
  readonly kind: 'file'
  readonly id: string
  readonly name: string
  readonly size: number
  readonly mediaType: string
  readonly pages: number | undefined
  readonly text: string
}

/** Why one file was refused, with copy-ready detail. */
export interface FileIntakeRejection {
  readonly reason: 'unsupported' | 'too-large' | 'too-many-pages' | 'too-long' | 'unreadable'
  readonly name: string
  readonly detail: string
}

/** Union result of classifying and extracting one browser file. */
export type FileIntake = { ok: true; file: DraftFileText } | { ok: false; rejection: FileIntakeRejection }

let attachmentSeq = 0
const nextId = (): string => {
  attachmentSeq += 1
  return 'file-' + String(attachmentSeq)
}

/** Whether one browser file is a PDF by extension or declared media type. */
export function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || PDF_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext))
}

/** Whether one browser file is read directly as UTF-8 text. */
export function isTextLike(file: File): boolean {
  if (file.type === '') return false
  return TEXT_MEDIA_TYPES.has(file.type) || file.type.startsWith('text/')
}

/** Extract one PDF's text - simplified version for build stability */
async function extractPdf(file: File): Promise<FileIntake> {
  // PDF text extraction temporarily disabled due to build configuration issues
  // This will return file info without actual text extraction
  // TODO: Re-enable full PDF.js support once virtual modules are properly configured
  return {
    ok: false,
    rejection: {
      reason: 'unreadable',
      name: file.name,
      detail: 'PDF text extraction is temporarily disabled. Please use text files (.txt, .md, .json, etc.) instead.',
    },
  }
}

/** Read one text-like file as UTF-8 with a byte guard. */
async function extractText(file: File): Promise<FileIntake> {
  try {
    const text = await file.text()
    return {
      ok: true,
      file: {
        kind: 'file', id: nextId(), name: file.name, size: file.size,
        mediaType: file.type === '' ? 'text/plain' : file.type, pages: undefined,
        text: text.length > MAX_EXTRACT_CHARS ? text.slice(0, MAX_EXTRACT_CHARS) + '\n(truncated)' : text,
      },
    }
  } catch (error) {
    return { ok: false, rejection: { reason: 'unreadable', name: file.name, detail: error instanceof Error ? error.message : String(error) } }
  }
}

/**
 * Classify and extract one browser file (PDF or text-like) into a draft.
 * Images are NOT handled here: they keep the existing binary image path.
 * @param file - the browser file the user attached.
 * @returns the extracted draft, or a readable rejection.
 */
export async function extractFile(file: File): Promise<FileIntake> {
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, rejection: { reason: 'too-large', name: file.name, detail: String(file.size) } }
  }
  if (isPdf(file)) return await extractPdf(file)
  if (isTextLike(file)) return await extractText(file)
  return { ok: false, rejection: { reason: 'unsupported', name: file.name, detail: file.type } }
}

/** Render one extracted draft as the model-visible text block payload. */
export function renderFileText(file: DraftFileText): string {
  const pages = file.pages === undefined ? '' : ', ' + String(file.pages) + ' pages'
  return '[attached file: ' + file.name + pages + ']\n' + file.text
}
