import 'server-only';

import { createServerSupabase } from './supabase-server';
import type {
  SdCompanyResearch,
  SdDraftStatus,
  SdEmailDraft,
  SdEmailTemplate,
  SdEmailTemplateExample,
  SdLeadStage,
  SdResearchConfidence,
  SdResearchSignal,
  SdResearchSource,
  SdResearchStatus,
} from './serviceden';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Reads for the email agent's tables (research, writing templates, drafts).
 * Mirrors serviceden-leads-data.ts: RLS server client, snake_case → camelCase
 * mappers that are also reused by the API routes' service-role queries, and an
 * error-tolerant `schemaReady` flag so ServiceDen still renders before
 * supabase/serviceden-email-agent.sql has been pasted into the SQL editor.
 */

export interface SdTemplatePageData {
  templates: SdEmailTemplate[];
  schemaReady: boolean;
}

function textArray(value: any): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

export function mapSdCompanyResearch(r: any): SdCompanyResearch {
  const signals = Array.isArray(r.operational_signals) ? r.operational_signals : [];
  const sources = Array.isArray(r.sources) ? r.sources : [];
  const candidates = Array.isArray(r.candidates) ? r.candidates : [];
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    status: (r.status as SdResearchStatus) ?? 'pending',
    websiteUrl: r.website_url ?? null,
    domain: r.domain ?? null,
    candidates: candidates.map((c: any) => ({
      url: String(c?.url ?? ''),
      title: c?.title ?? null,
      reason: String(c?.reason ?? ''),
    })),
    companyName: r.company_name ?? null,
    industry: r.industry ?? null,
    location: r.location ?? null,
    productsServices: r.products_services ?? null,
    customerType: r.customer_type ?? null,
    operationalSignals: signals.map((s: any): SdResearchSignal => ({
      claim: String(s?.claim ?? ''),
      sourceId: String(s?.sourceId ?? ''),
      kind: s?.kind === 'hypothesis' ? 'hypothesis' : 'fact',
    })),
    summary: r.summary ?? null,
    sources: sources.map((s: any): SdResearchSource => ({
      id: String(s?.id ?? ''),
      url: String(s?.url ?? ''),
      title: s?.title ?? null,
      scrapedAt: String(s?.scrapedAt ?? ''),
    })),
    confidence: (r.confidence as SdResearchConfidence) ?? 'low',
    contentHash: r.content_hash ?? null,
    excludedSourceIds: textArray(r.excluded_source_ids),
    lastError: r.last_error ?? null,
    researchedAt: r.researched_at ?? null,
  };
}

export function mapSdEmailTemplateExample(r: any): SdEmailTemplateExample {
  return {
    id: String(r.id),
    templateId: String(r.template_id),
    subjectExample: r.subject_example ?? '',
    bodyExample: r.body_example ?? '',
    active: r.active !== false,
    source: r.source === 'sent_email' ? 'sent_email' : 'manual',
  };
}

export function mapSdEmailTemplate(r: any, examples: SdEmailTemplateExample[] = []): SdEmailTemplate {
  return {
    id: String(r.id),
    name: r.name ?? '',
    stages: textArray(r.stages) as SdLeadStage[],
    purpose: r.purpose ?? null,
    toneNotes: r.tone_notes ?? null,
    preferredCta: r.preferred_cta ?? null,
    industryTags: textArray(r.industry_tags),
    visibility: r.visibility === 'org' ? 'org' : 'personal',
    active: r.active !== false,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
    examples,
  };
}

export function mapSdEmailDraft(r: any): SdEmailDraft {
  return {
    id: String(r.id),
    leadId: String(r.lead_id),
    recipientEmail: r.recipient_email ?? '',
    subject: r.subject ?? '',
    body: r.body ?? '',
    pipelineStageSnapshot: (r.pipeline_stage_snapshot as SdLeadStage) ?? 'new',
    templateIds: textArray(r.template_ids),
    exampleIds: textArray(r.example_ids),
    researchId: r.research_id ?? null,
    researchRevision: r.research_revision ?? null,
    usedSourceIds: textArray(r.used_source_ids),
    reasoningSummary: r.reasoning_summary ?? null,
    suggestedFollowUpDays: r.suggested_follow_up_days == null ? null : Number(r.suggested_follow_up_days),
    sourceThreadId: r.source_thread_id ?? null,
    status: (r.status as SdDraftStatus) ?? 'draft',
    staleResearch: r.stale_research === true,
    model: r.model ?? null,
    approvedAt: r.approved_at ?? null,
    sentAt: r.sent_at ?? null,
    gmailMessageId: r.gmail_message_id ?? null,
    gmailThreadId: r.gmail_thread_id ?? null,
    lastError: r.last_error ?? null,
    createdAt: r.created_at ?? '',
    updatedAt: r.updated_at ?? '',
  };
}

/** Templates (with their examples) for the Templates tab. */
export async function getServiceDenTemplatePageData(orgId: string): Promise<SdTemplatePageData> {
  const sb = await createServerSupabase();
  const templateRes = await sb
    .from('sd_email_templates')
    .select('*')
    .eq('org_id', orgId)
    .order('updated_at', { ascending: false });
  if (templateRes.error) return { templates: [], schemaReady: false };

  const rows = (templateRes.data as any[]) ?? [];
  const templateIds = rows.map((r) => String(r.id));
  const exampleRes = templateIds.length
    ? await sb
        .from('sd_email_template_examples')
        .select('*')
        .eq('org_id', orgId)
        .in('template_id', templateIds)
        .order('created_at', { ascending: true })
    : { data: [] as any[], error: null };
  if (exampleRes.error) return { templates: rows.map((r) => mapSdEmailTemplate(r)), schemaReady: false };

  const byTemplate = new Map<string, SdEmailTemplateExample[]>();
  for (const r of ((exampleRes.data as any[]) ?? []).map(mapSdEmailTemplateExample)) {
    const list = byTemplate.get(r.templateId) ?? [];
    list.push(r);
    byTemplate.set(r.templateId, list);
  }

  return {
    templates: rows.map((r) => mapSdEmailTemplate(r, byTemplate.get(String(r.id)) ?? [])),
    schemaReady: true,
  };
}
