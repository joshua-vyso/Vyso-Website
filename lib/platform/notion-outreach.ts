/**
 * Notion is the system of record for the n8n outreach engine: Lead Hub holds every
 * lead, Template List holds one row per campaign, Email Templates holds the copy the
 * automation actually sends. ServiceDen reads all three here.
 *
 * Two pipelines live side by side and are deliberately NOT the same field:
 *   - outreach stage  (Contacted -> 1st/2nd/3rd Follow-Up -> Breakup) is where the
 *     email sequence has got to. n8n owns it.
 *   - sales stage     (discovery -> pilot -> won/lost) is where the deal stands.
 *     A human owns it, and it only starts once the lead replies.
 * A lead can be "2nd Follow-Up" in the sequence and "discovery" in sales at once, so
 * collapsing them into one column would lose information.
 *
 * Notion's REST API allows ~3 requests/second and returns at most 100 rows per page,
 * so every query here paginates and the whole module is cached per request.
 */

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

export const LEAD_HUB_DB = '3ab4c0ac-5f7c-8043-9932-cf257da25333';
export const CAMPAIGNS_DB = '3b24c0ac-5f7c-8055-9385-d0446bec7f86';
export const TEMPLATES_DB = '9086ff2b-43b0-489b-b878-335a6d965e0b';

export const notionOutreachConfigured = Boolean(process.env.NOTION_API_KEY);

/** Where the email sequence has got to. Mirrors Lead Hub's "Lead Status" select. */
export type OutreachStage =
  | 'Contacted'
  | '1st Follow-Up'
  | '2nd Follow-Up'
  | '3rd Follow-Up'
  | 'Breakup'
  | 'Meeting Booked';

/** Campaign names are data (rows in Template List), so this is an open string.
 *  'Unassigned' is the one synthetic value, for leads with no Campaign select. */
export type CampaignName = string;

export type OutreachLead = {
  id: string;
  url: string;
  company: string;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  icpScore: number | null;
  campaign: CampaignName;
  /** Reporting cohort, from the Campaign Record relation. Pre-experiment leads sit
   *  in "Original" here while their Campaign select still says Legacy, because the
   *  select drives which email sequence n8n sends. Metrics must use this. */
  cohortId: string | null;
  outreachStage: OutreachStage | null;
  firstContact: string | null;
  mostRecentContact: string | null;
  nextFollowUp: string | null;
  replied: boolean;
  repliedOn: string | null;
  reEngaged: boolean;
  signed: boolean;
  notes: string;
  /** Deliverability of the address — set by the bounce scan, not by humans. */
  emailStatus: string | null;
  /** Why the conversation ended. Orthogonal to Lead Status: "Too Expensive"
   *  after a warm reply is a different fact from a Breakup email going out. */
  outcome: string | null;
};

export type CampaignRow = {
  id: string;
  name: string;
  leadCount: number;
};

export type EmailTemplate = {
  id: string;
  url: string;
  name: string;
  campaign: string;
  stage: string;
  templateKey: string;
  subject: string;
  body: string;
  active: boolean;
  sequenceOrder: number | null;
  notes: string;
};

// ---------------------------------------------------------------------------
// Transport
// ---------------------------------------------------------------------------

class NotionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'NotionError';
  }
}

async function notionFetch(path: string, body: unknown): Promise<Record<string, unknown>> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new NotionError('NOTION_API_KEY is not set.', 503);

  const response = await fetch(`${NOTION_API}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body ?? {}),
    // Lead data changes every time the automation runs; never serve a stale list.
    cache: 'no-store',
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // 404 almost always means the database exists but was never shared with the
    // integration, which is the single most common setup mistake here.
    const hint =
      response.status === 404
        ? ' The database may not be shared with the Notion integration (open the database, Connections, add the integration).'
        : '';
    throw new NotionError(`Notion ${response.status}: ${detail.slice(0, 300)}${hint}`, response.status);
  }
  return (await response.json()) as Record<string, unknown>;
}

/** Notion caps a page at 100 rows, so every list read has to follow the cursor. */
async function queryAll(databaseId: string, body: Record<string, unknown> = {}): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let cursor: string | undefined;
  // Hard stop well above any realistic lead count so a cursor bug can't spin forever.
  for (let page = 0; page < 50; page++) {
    const payload = await notionFetch(`/databases/${databaseId}/query`, {
      ...body,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });
    const results = Array.isArray(payload.results) ? (payload.results as Record<string, unknown>[]) : [];
    out.push(...results);
    if (!payload.has_more || typeof payload.next_cursor !== 'string') break;
    cursor = payload.next_cursor;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Property readers — Notion nests every value differently by type
// ---------------------------------------------------------------------------

type Props = Record<string, Record<string, unknown> | undefined>;

function props(row: Record<string, unknown>): Props {
  return (row.properties ?? {}) as Props;
}

function plain(rich: unknown): string {
  if (!Array.isArray(rich)) return '';
  return rich
    .map((r) => (r && typeof r === 'object' ? String((r as Record<string, unknown>).plain_text ?? '') : ''))
    .join('')
    .trim();
}

function readTitle(p: Props, key: string): string {
  return plain(p[key]?.title);
}
function readText(p: Props, key: string): string {
  return plain(p[key]?.rich_text);
}
function readSelect(p: Props, key: string): string | null {
  const sel = p[key]?.select as Record<string, unknown> | null | undefined;
  const name = sel && typeof sel === 'object' ? sel.name : null;
  return typeof name === 'string' && name ? name : null;
}
function readCheckbox(p: Props, key: string): boolean {
  return p[key]?.checkbox === true;
}
function readNumber(p: Props, key: string): number | null {
  const n = p[key]?.number;
  return typeof n === 'number' ? n : null;
}
function readEmail(p: Props, key: string): string {
  const e = p[key]?.email;
  return typeof e === 'string' ? e : '';
}
function readPhone(p: Props, key: string): string | null {
  const v = p[key]?.phone_number;
  return typeof v === 'string' && v ? v : null;
}
function readUrl(p: Props, key: string): string | null {
  const v = p[key]?.url;
  return typeof v === 'string' && v ? v : null;
}
/** Returns the ISO date only — the automation writes date-only values. */
function readDate(p: Props, key: string): string | null {
  const d = p[key]?.date as Record<string, unknown> | null | undefined;
  const start = d && typeof d === 'object' ? d.start : null;
  return typeof start === 'string' && start ? start.slice(0, 10) : null;
}

function toLead(row: Record<string, unknown>): OutreachLead {
  const p = props(row);
  const campaign = readSelect(p, 'Campaign');
  const stage = readSelect(p, 'Lead Status');
  return {
    id: String(row.id ?? ''),
    url: String(row.url ?? ''),
    company: readTitle(p, 'Name'),
    email: readEmail(p, 'Email'),
    phone: readPhone(p, 'Phone'),
    website: readUrl(p, 'Website'),
    industry: readSelect(p, 'Industry'),
    icpScore: readNumber(p, 'ICP Score'),
    campaign: campaign ?? 'Unassigned',
    cohortId: (() => {
      const rel = p['Campaign Record']?.relation;
      const first = Array.isArray(rel) && rel.length ? (rel[0] as Record<string, unknown>) : null;
      return first && typeof first.id === 'string' ? first.id : null;
    })(),
    outreachStage: (stage as OutreachStage | null) ?? null,
    // "FIrst Contact" — the capital I is a typo in the live schema. Do not "fix" it.
    firstContact: readDate(p, 'FIrst Contact'),
    mostRecentContact: readDate(p, 'Most Recent Contact'),
    nextFollowUp: readDate(p, 'Next Follow-Up'),
    replied: readCheckbox(p, 'Replied'),
    repliedOn: readDate(p, 'Replied On'),
    reEngaged: readCheckbox(p, 'Re-engaged'),
    signed: readCheckbox(p, 'Signed'),
    notes: readText(p, 'Notes'),
    emailStatus: readSelect(p, 'Email Status'),
    outcome: readSelect(p, 'Outcome'),
  };
}

function toTemplate(row: Record<string, unknown>): EmailTemplate {
  const p = props(row);
  return {
    id: String(row.id ?? ''),
    url: String(row.url ?? ''),
    name: readTitle(p, 'Name'),
    campaign: readSelect(p, 'Campaign') ?? '',
    stage: readSelect(p, 'Stage') ?? '',
    templateKey: readText(p, 'Template Key'),
    subject: readText(p, 'Subject'),
    body: readText(p, 'Body'),
    active: readCheckbox(p, 'Active'),
    sequenceOrder: readNumber(p, 'Sequence Order'),
    notes: readText(p, 'Notes'),
  };
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getOutreachLeads(): Promise<OutreachLead[]> {
  const rows = await queryAll(LEAD_HUB_DB);
  return rows.map(toLead).filter((l) => l.company || l.email);
}

export async function getEmailTemplates(): Promise<EmailTemplate[]> {
  const rows = await queryAll(TEMPLATES_DB);
  return rows
    .map(toTemplate)
    .sort((a, b) => a.campaign.localeCompare(b.campaign) || (a.sequenceOrder ?? 0) - (b.sequenceOrder ?? 0));
}

export async function getCampaigns(): Promise<CampaignRow[]> {
  const rows = await queryAll(CAMPAIGNS_DB);
  return rows.map((row) => {
    const p = props(row);
    const rel = p['Leads']?.relation;
    return {
      id: String(row.id ?? ''),
      name: readTitle(p, 'Name'),
      leadCount: Array.isArray(rel) ? rel.length : 0,
    };
  });
}

// ---------------------------------------------------------------------------
// Metrics
// ---------------------------------------------------------------------------

export type CampaignMetrics = {
  campaign: CampaignName;
  leads: number;
  replied: number;
  replyRate: number;
  meetings: number;
  meetingRate: number;
  avgIcpScore: number | null;
  /** True until each arm has enough leads for the difference to mean anything. */
  underpowered: boolean;
};

/** Below this the arms are noise, not signal. Surfaced in the UI so nobody calls it early. */
export const MIN_SAMPLE_FOR_SIGNIFICANCE = 100;

export function campaignMetrics(leads: OutreachLead[], cohorts: CampaignRow[] = []): CampaignMetrics[] {
  // Group by the Campaign Record relation when we know it. Grouping by the
  // Campaign select would fold the 62 pre-experiment "Original" leads into
  // Legacy and quietly dilute its reply rate.
  const nameById = new Map(cohorts.map((c) => [c.id.replace(/-/g, ''), c.name]));
  const buckets = new Map<CampaignName, OutreachLead[]>();
  for (const lead of leads) {
    const cohort = lead.cohortId ? nameById.get(lead.cohortId.replace(/-/g, '')) : undefined;
    const key = (cohort ?? lead.campaign) as CampaignName;
    const list = buckets.get(key) ?? [];
    list.push(lead);
    buckets.set(key, list);
  }

  const rows: CampaignMetrics[] = [];
  for (const [campaign, list] of buckets) {
    const replied = list.filter((l) => l.replied).length;
    const meetings = list.filter((l) => l.outreachStage === 'Meeting Booked').length;
    const scored = list.map((l) => l.icpScore).filter((n): n is number => typeof n === 'number');
    rows.push({
      campaign,
      leads: list.length,
      replied,
      replyRate: list.length ? replied / list.length : 0,
      meetings,
      meetingRate: list.length ? meetings / list.length : 0,
      avgIcpScore: scored.length ? scored.reduce((a, b) => a + b, 0) / scored.length : null,
      underpowered: list.length < MIN_SAMPLE_FOR_SIGNIFICANCE,
    });
  }
  return rows.sort((a, b) => b.leads - a.leads);
}

export function industryBreakdown(leads: OutreachLead[]): { industry: string; leads: number; replied: number }[] {
  const map = new Map<string, { leads: number; replied: number }>();
  for (const lead of leads) {
    const key = lead.industry ?? 'Unclassified';
    const cur = map.get(key) ?? { leads: 0, replied: 0 };
    cur.leads++;
    if (lead.replied) cur.replied++;
    map.set(key, cur);
  }
  return [...map.entries()]
    .map(([industry, v]) => ({ industry, ...v }))
    .sort((a, b) => b.leads - a.leads);
}

/** Still being sequenced: no reply yet, not signed, not closed out. */
export function isInOutreach(lead: OutreachLead): boolean {
  return !lead.replied && !lead.signed;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

/**
 * Select options are fixed in Notion. Writing a value outside these lists creates
 * a new option silently, which would quietly break the n8n automation (it matches
 * Lead Status and Campaign by exact string), so edits are validated against them.
 */
export const OUTREACH_STAGES: OutreachStage[] = [
  'Contacted',
  '1st Follow-Up',
  '2nd Follow-Up',
  '3rd Follow-Up',
  'Breakup',
  'Meeting Booked',
];

/** Campaigns that may still be assigned to leads by hand. Legacy and Discovery
 *  First stay here so an existing lead can be corrected; new leads only ever get
 *  a campaign ticked "Active for New Leads", which the automation decides. */
export const CAMPAIGN_OPTIONS = ['Pricing Refined', 'Legacy', 'Discovery First'] as const;

export const EMAIL_STATUS_OPTIONS = ['Valid', 'Bounced', 'Catch-All', 'Do Not Contact'] as const;

/** Why it ended, not where the sequence got to. "Too Expensive" is the signal
 *  Josh is hunting for while finding his lane — a loved product at the wrong
 *  price point is a different lesson from "No Need". */
export const OUTCOME_OPTIONS = [
  'Won',
  'Too Expensive',
  'Not Ready Yet',
  'No Need',
  'Not ICP',
  'Wrong Contact',
  'Ghosted',
] as const;

export const INDUSTRY_OPTIONS = [
  'Catering',
  'Restaurant',
  'Coffee Shop / Roastery',
  'Bakery',
  'Deli',
  'Meal Prep / Frozen',
  'Food Manufacturer',
  'Wholesaler / Distributor',
  'Farm / Producer',
  'Butchery / Meat',
  'Dairy',
  'Beverage Producer',
  'Grocery / Food Retail',
  'Hospitality / Venue',
  'Other Food Business',
] as const;

/** The template stages n8n knows how to send. Key must match exactly. */
export const TEMPLATE_KEYS = [
  'initial',
  'firstFollowUp',
  'secondFollowUp',
  'thirdFollowUp',
  'breakup',
  'reEngagement',
] as const;

export const TEMPLATE_STAGE_BY_KEY: Record<string, string> = {
  initial: 'Initial',
  firstFollowUp: '1st Follow-Up',
  secondFollowUp: '2nd Follow-Up',
  thirdFollowUp: '3rd Follow-Up',
  breakup: 'Breakup',
  reEngagement: 'Re-engagement',
};

/** Notion caps a rich-text property at 2000 characters and truncates silently. */
export const TEMPLATE_BODY_LIMIT = 2000;

export type LeadEdit = Partial<{
  company: string;
  email: string;
  phone: string;
  website: string;
  notes: string;
  industry: string;
  campaign: string;
  outreachStage: string;
  icpScore: number | null;
  nextFollowUp: string | null;
  replied: boolean;
  signed: boolean;
  outcome: string;
  emailStatus: string;
}>;

function richText(value: string) {
  return { rich_text: [{ type: 'text', text: { content: value.slice(0, TEMPLATE_BODY_LIMIT) } }] };
}

async function notionPatch(path: string, body: unknown): Promise<Record<string, unknown>> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new NotionError('NOTION_API_KEY is not set.', 503);
  const response = await fetch(`${NOTION_API}${path}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new NotionError(`Notion ${response.status}: ${detail.slice(0, 300)}`, response.status);
  }
  return (await response.json()) as Record<string, unknown>;
}

export async function updateLead(pageId: string, edit: LeadEdit): Promise<void> {
  const properties: Record<string, unknown> = {};

  if (edit.company !== undefined) {
    properties.Name = { title: [{ type: 'text', text: { content: edit.company.slice(0, 200) } }] };
  }
  // Notion rejects a malformed email/url outright, so send null to clear rather than ''.
  if (edit.email !== undefined) properties.Email = { email: edit.email.trim() || null };
  if (edit.phone !== undefined) properties.Phone = { phone_number: edit.phone.trim() || null };
  if (edit.website !== undefined) properties.Website = { url: edit.website.trim() || null };
  if (edit.notes !== undefined) properties.Notes = richText(edit.notes);
  if (edit.icpScore !== undefined) properties['ICP Score'] = { number: edit.icpScore };
  if (edit.replied !== undefined) properties.Replied = { checkbox: edit.replied };
  if (edit.signed !== undefined) properties.Signed = { checkbox: edit.signed };

  if (edit.industry !== undefined) {
    // Not validated against a fixed list any more: segments define their own
    // industry labels and Notion creates select options on first write, exactly
    // as the automation does. Commas are the one thing Notion rejects.
    const industry = edit.industry.trim().slice(0, 100).replace(/,/g, '');
    properties.Industry = { select: industry ? { name: industry } : null };
  }
  if (edit.outcome !== undefined) {
    if (edit.outcome && !(OUTCOME_OPTIONS as readonly string[]).includes(edit.outcome)) {
      throw new NotionError(`Unknown outcome "${edit.outcome}".`, 400);
    }
    properties.Outcome = { select: edit.outcome ? { name: edit.outcome } : null };
  }
  if (edit.emailStatus !== undefined) {
    if (edit.emailStatus && !(EMAIL_STATUS_OPTIONS as readonly string[]).includes(edit.emailStatus)) {
      throw new NotionError(`Unknown email status "${edit.emailStatus}".`, 400);
    }
    properties['Email Status'] = { select: edit.emailStatus ? { name: edit.emailStatus } : null };
  }
  if (edit.campaign !== undefined) {
    if (edit.campaign && !(CAMPAIGN_OPTIONS as readonly string[]).includes(edit.campaign)) {
      throw new NotionError(`Unknown campaign "${edit.campaign}".`, 400);
    }
    properties.Campaign = { select: edit.campaign ? { name: edit.campaign } : null };
  }
  if (edit.outreachStage !== undefined) {
    if (edit.outreachStage && !(OUTREACH_STAGES as readonly string[]).includes(edit.outreachStage)) {
      throw new NotionError(`Unknown lead status "${edit.outreachStage}".`, 400);
    }
    properties['Lead Status'] = { select: edit.outreachStage ? { name: edit.outreachStage } : null };
  }
  if (edit.nextFollowUp !== undefined) {
    // Dates are date-only on purpose; the automation compares them as plain days.
    properties['Next Follow-Up'] = edit.nextFollowUp ? { date: { start: edit.nextFollowUp } } : { date: null };
  }

  if (Object.keys(properties).length === 0) return;
  await notionPatch(`/pages/${pageId}`, { properties });
}

export type TemplateEdit = {
  name: string;
  campaign: string;
  templateKey: string;
  subject: string;
  body: string;
  active: boolean;
  notes?: string;
};

function templateProperties(edit: TemplateEdit): Record<string, unknown> {
  if (!(TEMPLATE_KEYS as readonly string[]).includes(edit.templateKey)) {
    throw new NotionError(`Unknown template key "${edit.templateKey}".`, 400);
  }
  if (!(CAMPAIGN_OPTIONS as readonly string[]).includes(edit.campaign)) {
    throw new NotionError(`Unknown campaign "${edit.campaign}".`, 400);
  }
  if (!edit.subject.trim() || !edit.body.trim()) {
    // n8n throws on an empty template rather than sending a blank email, so this
    // would halt the next run. Better to refuse the save here.
    throw new NotionError('Subject and body are both required.', 400);
  }
  if (edit.body.length > TEMPLATE_BODY_LIMIT) {
    throw new NotionError(`Body is ${edit.body.length} characters; Notion caps it at ${TEMPLATE_BODY_LIMIT}.`, 400);
  }
  const stage = TEMPLATE_STAGE_BY_KEY[edit.templateKey];
  return {
    Name: { title: [{ type: 'text', text: { content: edit.name.slice(0, 200) } }] },
    Campaign: { select: { name: edit.campaign } },
    Stage: { select: { name: stage } },
    'Template Key': richText(edit.templateKey),
    Subject: richText(edit.subject),
    Body: richText(edit.body),
    Active: { checkbox: edit.active },
    'Sequence Order': { number: TEMPLATE_KEYS.indexOf(edit.templateKey as (typeof TEMPLATE_KEYS)[number]) + 1 },
    ...(edit.notes !== undefined ? { Notes: richText(edit.notes) } : {}),
  };
}

export async function updateTemplate(pageId: string, edit: TemplateEdit): Promise<void> {
  await notionPatch(`/pages/${pageId}`, { properties: templateProperties(edit) });
}

export async function createTemplate(edit: TemplateEdit): Promise<string> {
  const key = process.env.NOTION_API_KEY;
  if (!key) throw new NotionError('NOTION_API_KEY is not set.', 503);
  const response = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      parent: { database_id: TEMPLATES_DB },
      properties: templateProperties(edit),
    }),
    cache: 'no-store',
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new NotionError(`Notion ${response.status}: ${detail.slice(0, 300)}`, response.status);
  }
  const created = (await response.json()) as Record<string, unknown>;
  return String(created.id ?? '');
}

export function notionErrorStatus(error: unknown): number {
  return error instanceof NotionError ? error.status : 500;
}

/** Replied, so a human owns it now. This is the hand-off into the sales pipeline. */
export function isInSales(lead: OutreachLead): boolean {
  return lead.replied || lead.outreachStage === 'Meeting Booked';
}

// ---------------------------------------------------------------------------
// Segments — the knobs n8n obeys
// ---------------------------------------------------------------------------

export const SEGMENTS_DB = '3bb4c0ac-5f7c-81d1-b170-ef127c479544';

/**
 * One row per market the engine hunts in. n8n reads this database at the start
 * of every run: the quota is how many leads that segment gets per day, the
 * brief is pasted into the finder and qualifier prompts verbatim, and the
 * industry labels are the classification values the qualifier may emit.
 * Editing here IS editing the automation — there is no second copy in n8n.
 */
export type OutreachSegment = {
  id: string;
  name: string;
  dailyQuota: number;
  searchBrief: string;
  industryLabels: string;
  active: boolean;
  priority: number;
};

function toSegment(row: Record<string, unknown>): OutreachSegment {
  const p = props(row);
  return {
    id: String(row.id ?? ''),
    name: readTitle(p, 'Segment'),
    dailyQuota: readNumber(p, 'Daily Quota') ?? 0,
    searchBrief: readText(p, 'Search Brief'),
    industryLabels: readText(p, 'Industry Labels'),
    active: readCheckbox(p, 'Active'),
    priority: readNumber(p, 'Priority') ?? 999,
  };
}

export async function getSegments(): Promise<OutreachSegment[]> {
  const rows = await queryAll(SEGMENTS_DB);
  return rows
    .map(toSegment)
    .filter((s) => s.name)
    .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
}

export type SegmentEdit = {
  name: string;
  dailyQuota: number;
  searchBrief: string;
  industryLabels: string;
  active: boolean;
  priority: number;
};

/** Long briefs must be split: Notion rejects a single rich-text item over 2000 chars. */
function longRichText(value: string) {
  const chunks: { type: 'text'; text: { content: string } }[] = [];
  for (let i = 0; i < value.length && chunks.length < 20; i += 1900) {
    chunks.push({ type: 'text', text: { content: value.slice(i, i + 1900) } });
  }
  return { rich_text: chunks };
}

function segmentProperties(edit: SegmentEdit): Record<string, unknown> {
  if (!edit.name.trim()) throw new NotionError('Segment needs a name.', 400);
  const quota = Math.round(Number(edit.dailyQuota));
  if (!Number.isFinite(quota) || quota < 0 || quota > 100) {
    throw new NotionError('Daily quota must be between 0 and 100.', 400);
  }
  if (edit.active && quota > 0 && !edit.searchBrief.trim()) {
    throw new NotionError('An active segment needs a search brief — it is the text the lead finder works from.', 400);
  }
  return {
    Segment: { title: [{ type: 'text', text: { content: edit.name.trim().slice(0, 120) } }] },
    'Daily Quota': { number: quota },
    'Search Brief': longRichText(edit.searchBrief.trim()),
    'Industry Labels': longRichText(edit.industryLabels.trim()),
    Active: { checkbox: edit.active },
    Priority: { number: Math.round(Number(edit.priority)) || 999 },
  };
}

export async function updateSegment(pageId: string, edit: SegmentEdit): Promise<void> {
  await notionPatch(`/pages/${pageId}`, { properties: segmentProperties(edit) });
}

export async function createSegment(edit: SegmentEdit): Promise<string> {
  const page = await notionFetch('/pages', {
    parent: { database_id: SEGMENTS_DB },
    properties: segmentProperties(edit),
  });
  return String(page.id ?? '');
}

/** How conversations end, per campaign and overall — the "finding my lane" view. */
export function outcomeBreakdown(leads: OutreachLead[]): { outcome: string; count: number; industries: string[] }[] {
  const byOutcome = new Map<string, OutreachLead[]>();
  for (const lead of leads) {
    if (!lead.outcome) continue;
    const list = byOutcome.get(lead.outcome) ?? [];
    list.push(lead);
    byOutcome.set(lead.outcome, list);
  }
  return [...byOutcome.entries()]
    .map(([outcome, rows]) => ({
      outcome,
      count: rows.length,
      industries: [...new Set(rows.map((r) => r.industry).filter((i): i is string => Boolean(i)))],
    }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Today
// ---------------------------------------------------------------------------

export type TodaySnapshot = {
  date: string;
  /** First contacted today — what the discovery branch turned up this run. */
  newLeads: OutreachLead[];
  /** Due today, so the follow-up branch has drafted for them. */
  followUps: OutreachLead[];
  /** Replied today or yesterday. A reply is the only event worth interrupting for. */
  replies: OutreachLead[];
};

/** SAST, because the automation schedules in SAST — reading "today" in UTC puts
 *  the follow-up list a day out for the first two hours of every morning. */
export function outreachToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Johannesburg' }).format(new Date());
}

function daysBefore(iso: string, n: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/**
 * The day's three questions: who did we just find, who are we chasing, and who
 * answered. Takes every lead rather than the outreach subset, because repliers
 * are filtered out of that subset by definition and they are the point.
 */
export function todaySnapshot(leads: OutreachLead[], date = outreachToday()): TodaySnapshot {
  const since = daysBefore(date, 1);
  const byName = (a: OutreachLead, b: OutreachLead) => a.company.localeCompare(b.company);
  return {
    date,
    newLeads: leads.filter((l) => l.firstContact === date).sort(byName),
    followUps: leads
      .filter((l) => l.nextFollowUp === date && isInOutreach(l))
      .sort((a, b) => (b.icpScore ?? 0) - (a.icpScore ?? 0) || byName(a, b)),
    replies: leads
      .filter((l) => l.repliedOn != null && l.repliedOn >= since)
      .sort((a, b) => (b.repliedOn ?? '').localeCompare(a.repliedOn ?? '')),
  };
}
