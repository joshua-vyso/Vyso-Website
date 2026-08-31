/**
 * The email body's HTML, turned into evidence Vyso can read — and nothing else.
 *
 * WHY THIS EXISTS AT ALL. Until now the Graph fetch asked Exchange for
 * `outlook.body-content-type="text"`, so a customer's order arrived already
 * flattened by the server: the Belair email carried ONE pristine Outlook
 * `MsoNormalTable` of exactly 100 rows × 4 cells (Item | UNIT | stock | order),
 * and what Vyso stored was 2.4KB of text with every cell on its own line and no
 * row or column delimiter anywhere. Eight of those hundred rows had an order
 * quantity; the reader, handed a column-less list, produced 97 lines, 92 of them
 * with no quantity at all, and dropped the three gram quantities entirely. The
 * table was never unreadable — it was destroyed in transit. This module is the
 * other half of that fix: Graph now returns the original HTML (see
 * `fetchMicrosoftGraphMessage`), and this turns it back into rows and columns.
 *
 * WHAT IT IS NOT. It is not a browser, not a sanitiser for rendering, and not a
 * fetcher. It executes nothing, requests nothing, and follows no link: a
 * `<script>` body is dropped rather than flattened, an `<img>` tracking pixel is
 * simply not a thing this module can act on, and the SendGrid click-wrapper on
 * the Four Seasons notification is recorded as an href string and never
 * dereferenced. Its output is text and arrays of strings, which is exactly what
 * the rest of the pipeline is allowed to see. Nothing downstream renders any of
 * this as HTML.
 *
 * PURE and dependency-free (no cheerio, no htmlparser2, no `server-only`) so a
 * plain `node --test` can drive it over the real forensic shapes, and so the one
 * place email markup is interpreted has no supply chain of its own.
 *
 * NEVER THROWS. Malformed markup — an unterminated `<td>`, a `<table>` with no
 * `</table>`, a truncated tag — degrades to plain-text extraction, because an
 * exception here would turn a readable order into a failed ingest.
 */

/**
 * 1MB in, matching `MAX_EMAIL_BODY_SOURCE_BYTES` on the storage side. The Belair
 * body — the largest real one seen — is 132KB, so this is roughly eight times
 * the worst observed case and still small enough that the scan below is bounded
 * work on a serverless worker.
 */
export const MAX_HTML_INPUT_CHARS = 1_000_000;

/** Caps that keep one hostile body from producing an unbounded structure. */
const MAX_TABLES = 40;
const MAX_TABLE_DEPTH = 8;
/** Belair is 100 rows; a five-fold margin without letting a generated page run away. */
const MAX_ROWS_PER_TABLE = 500;
const MAX_CELLS_PER_ROW = 40;
const MAX_CELL_CHARS = 2_000;
const MAX_LINKS = 50;
const MAX_HREF_CHARS = 2_000;
const MAX_LINK_TEXT_CHARS = 300;
const MAX_TEXT_CHARS = 200_000;

export interface NormalizedTable {
  /** Column headings when the table states them; null when it does not. */
  headers: string[] | null;
  /** Every non-header row, cell text in document order. */
  rows: string[][];
}

export interface NormalizedLink {
  /** The href verbatim (http/https only). Stored as evidence; never fetched. */
  href: string;
  /** The anchor's visible text — on the Four Seasons body this is the clean
   *  `http://…birchstreet.net` the sender showed, not the tracking wrapper. */
  text: string | null;
  /** Lowercased hostname, parsed locally with `URL`. Never resolved. */
  host: string | null;
}

export interface NormalizedEmailHtml {
  /** The whole body as plain text, table cells included, one cell per line. */
  text: string;
  /**
   * The same text with table cell content REMOVED.
   *
   * Additive to the shape the plan named, and it earns its place: `text` has to
   * keep the cells, because message classification counts quantity/UOM lines and
   * on the Belair body every quantity lives inside the table — strip them and an
   * order stops looking like an order. But the ORDER READER must not be handed
   * the same hundred rows twice (once flattened, once as `ROW:` lines): that is
   * how a reader invents a second copy of a line. So the reader gets this plus
   * the serialized tables, and classification gets `text`.
   */
  textOutsideTables: string;
  tables: NormalizedTable[];
  links: NormalizedLink[];
}

const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  '#39': "'",
};

/**
 * Entity decoding, deliberately small.
 *
 * NBSP becomes an ORDINARY SPACE rather than U+00A0: Outlook fills empty order
 * cells with `&nbsp;`, and a cell holding one non-breaking space must read as
 * empty — that single character is the difference between "this row was not
 * ordered" and "this row was ordered, quantity unknown", which is the exact
 * mistake that produced 92 quantity-less lines. Numeric forms are decoded only
 * in the printable range; a decoded `<` cannot re-enter the parser because
 * decoding happens after the markup scan, never before it.
 */
function decodeEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]{1,9});/g, (match, entity: string) => {
    const key = entity.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, key)) return NAMED_ENTITIES[key];
    if (key.startsWith('#x')) {
      const code = Number.parseInt(key.slice(2), 16);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? safeCodePoint(code) : ' ';
    }
    if (key.startsWith('#')) {
      const code = Number.parseInt(key.slice(1), 10);
      return Number.isFinite(code) && code >= 32 && code <= 0x10ffff ? safeCodePoint(code) : ' ';
    }
    return match;
  });
}

function safeCodePoint(code: number): string {
  try {
    const char = String.fromCodePoint(code);
    // A decoded NBSP is a space for the same reason as `&nbsp;` above.
    return char === ' ' ? ' ' : char;
  } catch {
    return ' ';
  }
}

/** Collapse runs of whitespace (NBSP included) to single spaces and trim. */
function collapse(value: string): string {
  return value.replace(/[\s ]+/g, ' ').trim();
}

/** Tags whose CONTENT is not body text and is dropped whole, not flattened. */
const DROPPED_CONTENT_TAGS = new Set([
  'script', 'style', 'title', 'noscript', 'template', 'iframe', 'object', 'svg', 'math',
]);

/** Tags that end a line of text when they open or close. */
const BLOCK_TAGS = new Set([
  'p', 'div', 'tr', 'li', 'ul', 'ol', 'table', 'thead', 'tbody', 'tfoot', 'blockquote',
  'section', 'article', 'header', 'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'hr', 'pre',
]);

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param',
  'source', 'track', 'wbr',
]);

/**
 * Invisible-by-CSS containers, dropped subtree and all.
 *
 * Hidden preheader text is standard furniture in HTML email, and `mso-hide` is
 * Outlook's own variant of it. Text a human reading the message cannot see must
 * not become an order line or a classification signal — that asymmetry is how
 * content that exists ONLY for the machine would get in.
 */
// The `(?:^|[;\s])` guard is not decoration: without it `line-height:0` reads as
// `height:0` and a perfectly visible Outlook cell disappears from the order.
const HIDDEN_STYLE_RE = /(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all|(?:^|[;\s])(?:max-)?height\s*:\s*0(?:[^0-9.]|$)|(?:^|[;\s])font-size\s*:\s*0(?:[^0-9.]|$)|(?:^|[;\s])opacity\s*:\s*0(?:[^0-9.]|$))/i;

function attributeValue(attrs: string, name: string): string | null {
  const re = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, 'i');
  const match = re.exec(attrs);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? null;
}

function isHidden(attrs: string): boolean {
  if (/\bhidden\b(?:\s*=|\s|$)/i.test(attrs)) return true;
  const style = attributeValue(attrs, 'style');
  return Boolean(style && HIDDEN_STYLE_RE.test(style));
}

/**
 * http/https ONLY, and the string is kept exactly as written.
 *
 * `javascript:`, `data:`, `mailto:` and relative hrefs are not order evidence and
 * two of them are hostile the moment anything ever renders them, so they never
 * enter the output at all. `new URL` here is a PARSE, not a request.
 */
function normalizeHref(raw: string | null): { href: string; host: string | null } | null {
  const value = (raw ?? '').trim();
  if (!value || value.length > MAX_HREF_CHARS) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return { href: value, host: url.hostname.toLowerCase() || null };
  } catch {
    return null;
  }
}

interface TableState {
  table: NormalizedTable;
  rows: string[][];
  row: string[] | null;
  rowIsHeader: boolean;
  firstRowAllHeaderCells: boolean | null;
}

const TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9:_-]*)((?:"[^"]*"|'[^']*'|[^>"'])*)>/g;

/**
 * Read one email body's HTML into text, tables and links.
 *
 * Written as a single forward scan with an explicit stack rather than as a pile
 * of regexes: the BirchStreet purchase-order attachment nests tables inside
 * tables (a layout table wrapping the line grid), and a non-greedy
 * `<table>.*?</table>` closes the OUTER table on the INNER table's end tag —
 * which silently shreds precisely the grid we are here to recover.
 */
export function normalizeEmailHtml(input: string | null | undefined): NormalizedEmailHtml {
  const source = (input ?? '').slice(0, MAX_HTML_INPUT_CHARS);
  if (!source.trim()) return { text: '', textOutsideTables: '', tables: [], links: [] };
  try {
    return scan(source);
  } catch {
    // A parser fault must cost structure, never the message. Falling back to a
    // tag-strip keeps a body order readable as prose instead of failing the
    // whole ingest over one malformed cell.
    const text = collapseLines(decodeEntities(stripTags(source)));
    return { text, textOutsideTables: text, tables: [], links: [] };
  }
}

function stripTags(source: string): string {
  return source
    .replace(/<(script|style)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|td|th|li|h[1-6]|table)\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ');
}

function collapseLines(value: string): string {
  return value
    .split('\n')
    .map((line) => collapse(line))
    .filter((line, index, lines) => line !== '' || (index > 0 && lines[index - 1] !== ''))
    .join('\n')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
}

function scan(source: string): NormalizedEmailHtml {
  // `<head>` is stripped with a bounded regex and NO end-of-input fallback: a
  // mangled, unterminated `<head>` must not swallow the message body. A missing
  // `</head>` degrades to "the body survives", which is the safe direction.
  const cleaned = source
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, ' ')
    // Doctype, Word conditional comments (`<![if !supportLists]>`) and CDATA are
    // markup, not text: left alone they would land in the body as literal prose.
    .replace(/<![^>]*>/g, ' ');

  const textParts: string[] = [];
  const outsideParts: string[] = [];
  const tables: NormalizedTable[] = [];
  const links: NormalizedLink[] = [];
  const tableStack: TableState[] = [];
  const linkStack: { href: string; host: string | null; parts: string[] }[] = [];
  let cellParts: string[] | null = null;
  let skipTag: string | null = null;
  let skipDepth = 0;

  const emitText = (raw: string) => {
    if (!raw) return;
    const decoded = decodeEntities(raw);
    // Whitespace-only markup gaps become ONE space rather than nothing: the gap
    // between `<b>Item</b> <span>code</span>` is the only thing separating two
    // words, and dropping it silently welds them into "Itemcode".
    const text = collapse(decoded) ? decoded : ' ';
    textParts.push(text);
    if (tableStack.length === 0) outsideParts.push(text);
    if (cellParts) cellParts.push(text);
    if (linkStack.length) linkStack[linkStack.length - 1].parts.push(text);
  };
  const newline = () => {
    textParts.push('\n');
    if (tableStack.length === 0) outsideParts.push('\n');
  };
  const closeCell = () => {
    if (!cellParts) return;
    const state = tableStack[tableStack.length - 1];
    const value = collapse(decodeEntities(cellParts.join(''))).slice(0, MAX_CELL_CHARS);
    cellParts = null;
    if (!state) return;
    if (!state.row) state.row = [];
    if (state.row.length < MAX_CELLS_PER_ROW) state.row.push(value);
  };
  const closeRow = () => {
    closeCell();
    const state = tableStack[tableStack.length - 1];
    if (!state?.row) return;
    const row = state.row;
    state.row = null;
    if (row.length === 0) return;
    if (state.firstRowAllHeaderCells === null) state.firstRowAllHeaderCells = state.rowIsHeader;
    state.rowIsHeader = false;
    if (state.rows.length < MAX_ROWS_PER_TABLE) state.rows.push(row);
  };

  TAG_RE.lastIndex = 0;
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = TAG_RE.exec(cleaned)) !== null) {
    const [full, closing, rawName, attrs] = match;
    const name = rawName.toLowerCase();
    if (match.index > cursor) {
      const chunk = cleaned.slice(cursor, match.index);
      if (!skipTag) emitText(chunk);
    }
    cursor = match.index + full.length;

    if (skipTag) {
      // Inside a dropped subtree: count nesting so an inner `<div>` inside a
      // hidden `<div>` cannot end the skip early.
      if (name === skipTag) {
        if (closing) {
          skipDepth -= 1;
          if (skipDepth <= 0) { skipTag = null; skipDepth = 0; }
        } else if (!VOID_TAGS.has(name) && !full.endsWith('/>')) {
          skipDepth += 1;
        }
      }
      continue;
    }

    if (!closing && (DROPPED_CONTENT_TAGS.has(name) || isHidden(attrs))) {
      // A self-closing or void hidden element has no subtree to skip.
      if (!VOID_TAGS.has(name) && !full.endsWith('/>')) {
        skipTag = name;
        skipDepth = 1;
      }
      continue;
    }

    if (name === 'br') { newline(); if (cellParts) cellParts.push('\n'); continue; }
    if (VOID_TAGS.has(name)) continue;

    if (name === 'table') {
      if (!closing) {
        newline();
        if (tableStack.length >= MAX_TABLE_DEPTH) continue;
        const table: NormalizedTable = { headers: null, rows: [] };
        const state: TableState = { table, rows: table.rows, row: null, rowIsHeader: false, firstRowAllHeaderCells: null };
        tableStack.push(state);
        // Recorded at OPEN time so nested tables keep document order rather than
        // the order their end tags happen to arrive in.
        if (tables.length < MAX_TABLES) tables.push(table);
        continue;
      }
      closeRow();
      const state = tableStack.pop();
      if (state) finalizeTable(state);
      newline();
      continue;
    }

    if (name === 'tr') {
      // An unterminated `<tr>` closes the previous one rather than merging two
      // rows into one — merged rows are how a quantity lands on the wrong item.
      closeRow();
      newline();
      continue;
    }

    if (name === 'td' || name === 'th') {
      if (closing) { closeCell(); newline(); continue; }
      closeCell();
      const state = tableStack[tableStack.length - 1];
      if (state) {
        if (!state.row) { state.row = []; state.rowIsHeader = name === 'th'; }
        else if (name !== 'th') state.rowIsHeader = false;
        cellParts = [];
      }
      continue;
    }

    if (name === 'a') {
      if (closing) {
        const link = linkStack.pop();
        if (link && links.length < MAX_LINKS) {
          const text = collapse(decodeEntities(link.parts.join(''))).slice(0, MAX_LINK_TEXT_CHARS);
          links.push({ href: link.href, text: text || null, host: link.host });
        }
        continue;
      }
      const href = normalizeHref(attributeValue(attrs, 'href'));
      if (href) linkStack.push({ href: href.href, host: href.host, parts: [] });
      continue;
    }

    if (BLOCK_TAGS.has(name)) newline();
  }
  if (cursor < cleaned.length && !skipTag) emitText(cleaned.slice(cursor));
  // Unterminated `<table>`/`<tr>`/`<td>` still yield their rows.
  closeRow();
  while (tableStack.length) {
    const state = tableStack.pop();
    if (state) finalizeTable(state);
  }

  return {
    text: collapseLines(textParts.join('')),
    textOutsideTables: collapseLines(outsideParts.join('')),
    tables: tables.filter((table) => table.rows.length > 0 || (table.headers?.length ?? 0) > 0),
    links,
  };
}

/**
 * Decide whether the table STATED its columns, and lift that row out of the data.
 *
 * Two rules, both deterministic:
 *  1. A first row built entirely from `<th>` is a header row by the markup's own
 *     account. (The BirchStreet PO grid does this.)
 *  2. Outlook's exported tables carry no `<th>` at all — the Belair order form's
 *     heading row is four bold `<td>`s reading `Item | UNIT | stock | order`. So a
 *     first row is also a header when every one of its cells is filled, none of
 *     them is a bare number, and at least one row BELOW it looks like data (an
 *     empty cell or a numeric cell). That last clause is what stops a three-row
 *     table of prose from losing its first line: a header is only a header when
 *     there is data under it to head.
 *
 * The consequence matters more than the rule: `Item | UNIT | stock | order` must
 * not reach the reader as an orderable row whose "order" column reads "order".
 */
function finalizeTable(state: TableState): void {
  const rows = state.rows;
  // AN ALL-EMPTY ROW IS LAYOUT, NEVER A LINE. HTML purchase orders pad their
  // grids with spacer rows — the BirchStreet attachment opens its line-item
  // table with one — and a spacer sitting at row 0 would hide the real heading
  // row from the test below, which is how `# | Item SKU | Qty | …` would have
  // reached the reader as if it were an ordered product.
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    if (rows[i].every((cell) => cell === '')) rows.splice(i, 1);
  }
  if (rows.length < 2) return;
  const first = rows[0];
  if (first.length < 2) return;
  const looksLikeData = (row: string[]): boolean =>
    row.some((cell) => cell === '' || /^[\d.,]+$/.test(cell));
  const headerish =
    state.firstRowAllHeaderCells === true ||
    (first.every((cell) => cell !== '' && !/^[\d.,]+$/.test(cell)) && rows.slice(1).some(looksLikeData));
  if (!headerish) return;
  state.table.headers = first;
  rows.splice(0, 1);
}

/**
 * The tables, in the one shape the order reader is asked to read.
 *
 *     Table 1
 *     HEADERS: Item | UNIT | stock | order
 *     ROW: Baby Carrots | pkts |  | 1
 *
 * Pipe-delimited, one row per line, empty cells preserved as empty fields —
 * because an empty "order" cell is the load-bearing fact on an order form and a
 * serialization that dropped it would recreate the original bug in a new place.
 */
export function serializeNormalizedTables(tables: readonly NormalizedTable[]): string {
  return tables
    .map((table, index) => {
      const lines = [`Table ${index + 1}`];
      if (table.headers?.length) lines.push(`HEADERS: ${table.headers.join(' | ')}`);
      for (const row of table.rows) lines.push(`ROW: ${row.join(' | ')}`);
      return lines.join('\n');
    })
    .join('\n\n');
}

/**
 * What the ORDER READER is handed for an HTML source: the prose that sits
 * outside the tables, then the tables as rows. Never the raw markup, and never
 * the cells twice (see `textOutsideTables`).
 */
export function buildNormalizedReaderSource(normalized: NormalizedEmailHtml): string {
  const serialized = serializeNormalizedTables(normalized.tables);
  if (!serialized) return normalized.text;
  return [normalized.textOutsideTables, serialized].filter((part) => part.trim()).join('\n\n');
}
