'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/platform/supabase-browser';
import { Badge } from '@/components/platform/module-ui';
import { RowActionsMenu, useToast } from '@/components/platform/orderflow/ui';
import {
  LEAD_STAGES,
  LEAD_STAGE_META,
  type SdEmailTemplate,
  type SdLeadStage,
} from '@/lib/platform/serviceden';
import type { SdTemplatePageData } from '@/lib/platform/serviceden-email-data';
import { Field, Modal, ModalButtons, SdPrimary, inputClass } from './ui';

interface ExampleForm {
  id: string | null;
  subjectExample: string;
  bodyExample: string;
  active: boolean;
  source: 'manual' | 'sent_email';
  deleted: boolean;
}

interface TemplateForm {
  id: string | null;
  name: string;
  stages: SdLeadStage[];
  purpose: string;
  toneNotes: string;
  preferredCta: string;
  industryTags: string;
  visibility: 'personal' | 'org';
  active: boolean;
  examples: ExampleForm[];
}

const BLANK_EXAMPLE: ExampleForm = {
  id: null,
  subjectExample: '',
  bodyExample: '',
  active: true,
  source: 'manual',
  deleted: false,
};

const BLANK_TEMPLATE: TemplateForm = {
  id: null,
  name: '',
  stages: [],
  purpose: '',
  toneNotes: '',
  preferredCta: '',
  industryTags: '',
  visibility: 'personal',
  active: true,
  examples: [{ ...BLANK_EXAMPLE }],
};

function toForm(template: SdEmailTemplate): TemplateForm {
  return {
    id: template.id,
    name: template.name,
    stages: template.stages,
    purpose: template.purpose ?? '',
    toneNotes: template.toneNotes ?? '',
    preferredCta: template.preferredCta ?? '',
    industryTags: template.industryTags.join(', '),
    visibility: template.visibility,
    active: template.active,
    examples: template.examples.map((example) => ({
      id: example.id,
      subjectExample: example.subjectExample,
      bodyExample: example.bodyExample,
      active: example.active,
      source: example.source,
      deleted: false,
    })),
  };
}

function tagList(value: string): string[] {
  return [...new Set(value.split(',').map((tag) => tag.trim()).filter(Boolean))];
}

/**
 * Stage playbooks. A template is instructions plus real emails you have
 * actually sent; the composer picks the three most stage-specific examples and
 * writes in their voice rather than filling in a form letter.
 */
export function TemplatesView({ initialData, orgId, userId }: { initialData: SdTemplatePageData; orgId: string; userId: string }) {
  const router = useRouter();
  const { node, show } = useToast();
  const [stageFilter, setStageFilter] = useState<SdLeadStage | 'all'>('all');
  const [form, setForm] = useState<TemplateForm | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = useMemo(
    () => initialData.templates.filter((template) => stageFilter === 'all' || template.stages.includes(stageFilter)),
    [initialData.templates, stageFilter],
  );

  async function saveTemplate() {
    if (!form) return;
    const name = form.name.trim();
    if (!name) { setError('Give this template a name.'); return; }
    if (!form.stages.length) { setError('Choose at least one pipeline stage.'); return; }
    const supabase = createClient();
    if (!supabase) return;

    setBusy(true);
    setError(null);
    const values = {
      name,
      stages: form.stages,
      purpose: form.purpose.trim() || null,
      tone_notes: form.toneNotes.trim() || null,
      preferred_cta: form.preferredCta.trim() || null,
      industry_tags: tagList(form.industryTags),
      visibility: form.visibility,
      active: form.active,
      updated_at: new Date().toISOString(),
    };

    let templateId = form.id;
    if (templateId) {
      const { error: updateError } = await supabase
        .from('sd_email_templates')
        .update(values)
        .eq('id', templateId)
        .eq('org_id', orgId);
      if (updateError) { setBusy(false); setError(updateError.message); return; }
    } else {
      const { data, error: insertError } = await supabase
        .from('sd_email_templates')
        .insert({ ...values, org_id: orgId, owner_user_id: userId })
        .select('id')
        .single();
      if (insertError || !data) { setBusy(false); setError(insertError?.message || 'Could not save this template.'); return; }
      templateId = String(data.id);
    }

    let exampleError: string | null = null;
    for (const example of form.examples) {
      const body = example.bodyExample.trim();
      if (example.deleted && example.id) {
        const { error: deleteError } = await supabase
          .from('sd_email_template_examples')
          .delete()
          .eq('id', example.id)
          .eq('org_id', orgId);
        if (deleteError && !exampleError) exampleError = deleteError.message;
        continue;
      }
      if (example.deleted || !body) continue;
      const exampleValues = {
        subject_example: example.subjectExample.trim(),
        body_example: body,
        active: example.active,
        source: example.source,
        updated_at: new Date().toISOString(),
      };
      if (example.id) {
        const { error: updateExampleError } = await supabase
          .from('sd_email_template_examples')
          .update(exampleValues)
          .eq('id', example.id)
          .eq('org_id', orgId);
        if (updateExampleError && !exampleError) exampleError = updateExampleError.message;
      } else {
        const { error: insertExampleError } = await supabase
          .from('sd_email_template_examples')
          .insert({ ...exampleValues, org_id: orgId, template_id: templateId });
        if (insertExampleError && !exampleError) exampleError = insertExampleError.message;
      }
    }

    setBusy(false);
    if (exampleError) {
      setError(exampleError);
      return;
    }
    setForm(null);
    show(form.id ? 'Template updated' : 'Template added');
    router.refresh();
  }

  async function duplicate(template: SdEmailTemplate) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const { data, error: insertError } = await supabase
      .from('sd_email_templates')
      .insert({
        org_id: orgId,
        owner_user_id: userId,
        name: `${template.name} (copy)`,
        stages: template.stages,
        purpose: template.purpose,
        tone_notes: template.toneNotes,
        preferred_cta: template.preferredCta,
        industry_tags: template.industryTags,
        visibility: template.visibility,
        active: template.active,
      })
      .select('id')
      .single();
    if (!insertError && data && template.examples.length) {
      await supabase.from('sd_email_template_examples').insert(
        template.examples.map((example) => ({
          org_id: orgId,
          template_id: String(data.id),
          subject_example: example.subjectExample,
          body_example: example.bodyExample,
          active: example.active,
          source: example.source,
        })),
      );
    }
    setBusy(false);
    show(insertError ? insertError.message : 'Template duplicated');
    router.refresh();
  }

  async function setActive(template: SdEmailTemplate, active: boolean) {
    const supabase = createClient();
    if (!supabase) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from('sd_email_templates')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', template.id)
      .eq('org_id', orgId);
    setBusy(false);
    show(updateError ? updateError.message : active ? 'Template activated' : 'Template deactivated');
    router.refresh();
  }

  function patchExample(index: number, patch: Partial<ExampleForm>) {
    setForm((current) => current
      ? { ...current, examples: current.examples.map((example, i) => (i === index ? { ...example, ...patch } : example)) }
      : current);
  }

  return (
    <div className="space-y-5">
      {node}

      {!initialData.schemaReady ? (
        <div className="rounded-2xl border border-[#F2C9C9] bg-[#FFF8F8] p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          <p className="of-display text-[16px] font-semibold text-[#A32D2D]">Email agent tables are not installed yet</p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-[#6B6F68]">
            Run <code className="rounded-[6px] bg-white px-1.5 py-0.5 text-[12px] text-[#3E4A57]">supabase/serviceden-email-agent.sql</code> in the Supabase SQL editor before writing templates.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-[14px] border border-[#EAEDF2] bg-white p-1 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
          {([['all', 'All'], ...LEAD_STAGES.map((stage) => [stage.value, stage.label] as const)] as Array<[SdLeadStage | 'all', string]>).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStageFilter(value)}
              className={`rounded-[10px] px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                stageFilter === value ? 'bg-[#EAF2FC] text-[#174C87]' : 'text-[#6B6F68] hover:bg-[#F5F9FE] hover:text-[#171A17]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <SdPrimary onClick={() => { setError(null); setForm({ ...BLANK_TEMPLATE, examples: [{ ...BLANK_EXAMPLE }] }); }}>+ New template</SdPrimary>
      </div>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#D8DFE8] bg-white px-6 py-12 text-center">
          <p className="of-display text-[18px] font-semibold text-[#171A17]">No templates here yet</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] text-[#6B6F68]">
            A template is a playbook for one stage: what the email is for, the tone, and a few real emails you have already sent.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((template) => (
            <div key={template.id} className="rounded-2xl border border-[#EAEDF2] bg-white p-5 shadow-[0_1px_2px_rgba(20,24,20,0.03)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="of-display text-[16px] font-semibold text-[#171A17]">{template.name}</p>
                    {template.active ? null : <Badge label="Inactive" />}
                    {template.visibility === 'org' ? <Badge label="Shared" tone="info" /> : null}
                  </div>
                  {template.purpose ? <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[#6B6F68]">{template.purpose}</p> : null}
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {template.stages.map((stage) => (
                      <Badge key={stage} label={LEAD_STAGE_META[stage]?.label ?? stage} tone={LEAD_STAGE_META[stage]?.tone ?? 'neutral'} />
                    ))}
                    <span className="text-[12px] text-[#A0A49C]">
                      {template.examples.filter((example) => example.active).length} example{template.examples.filter((example) => example.active).length === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
                <RowActionsMenu actions={[
                  { label: 'Edit', onClick: () => { setError(null); setForm(toForm(template)); } },
                  { label: 'Duplicate', onClick: () => void duplicate(template) },
                  template.active
                    ? { label: 'Deactivate', onClick: () => void setActive(template, false), danger: true }
                    : { label: 'Activate', onClick: () => void setActive(template, true) },
                ]} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        title={form?.id ? 'Edit template' : 'New template'}
        subtitle="Instructions plus real examples the writer should sound like."
        width={640}
        busy={busy}
        footer={<ModalButtons onCancel={() => setForm(null)} onSave={() => void saveTemplate()} busy={busy} saveLabel="Save template" />}
      >
        {form ? (
          <>
            <Field label="Name"><input autoFocus value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. First outreach — food producers" className={inputClass} /></Field>

            <Field label="Pipeline stages">
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STAGES.map((stage) => {
                  const on = form.stages.includes(stage.value);
                  return (
                    <button
                      key={stage.value}
                      type="button"
                      onClick={() => setForm({
                        ...form,
                        stages: on ? form.stages.filter((value) => value !== stage.value) : [...form.stages, stage.value],
                      })}
                      className={`rounded-[10px] border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                        on ? 'border-[#C9DEF7] bg-[#EAF2FC] text-[#174C87]' : 'border-[#E2E6EC] bg-white text-[#6B6F68] hover:bg-[#F5F9FE]'
                      }`}
                    >
                      {stage.label}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Purpose" hint="(optional)"><textarea value={form.purpose} onChange={(event) => setForm({ ...form, purpose: event.target.value })} className={`${inputClass} h-16 py-2`} /></Field>
            <Field label="Tone notes" hint="(optional)"><textarea value={form.toneNotes} onChange={(event) => setForm({ ...form, toneNotes: event.target.value })} className={`${inputClass} h-16 py-2`} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Preferred call to action" hint="(optional)"><input value={form.preferredCta} onChange={(event) => setForm({ ...form, preferredCta: event.target.value })} className={inputClass} /></Field>
              <Field label="Industry tags" hint="(comma separated)"><input value={form.industryTags} onChange={(event) => setForm({ ...form, industryTags: event.target.value })} className={inputClass} /></Field>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field label="Visibility">
                <select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value as 'personal' | 'org' })} className={inputClass}>
                  <option value="personal">Only me</option>
                  <option value="org">Shared with the organisation</option>
                </select>
              </Field>
              <Field label="Active">
                <select value={form.active ? 'yes' : 'no'} onChange={(event) => setForm({ ...form, active: event.target.value === 'yes' })} className={inputClass}>
                  <option value="yes">Active</option>
                  <option value="no">Inactive</option>
                </select>
              </Field>
            </div>

            <div className="space-y-3 border-t border-[#EEF1F5] pt-4">
              <p className="text-[13px] font-medium text-[#3E4A57]">Examples</p>
              {form.examples.map((example, index) => example.deleted ? null : (
                <div key={example.id ?? `new-${index}`} className="space-y-2 rounded-[12px] border border-[#EEF1F5] p-3">
                  <div className="flex items-center gap-2">
                    <input
                      value={example.subjectExample}
                      onChange={(event) => patchExample(index, { subjectExample: event.target.value })}
                      placeholder="Subject line"
                      className={`${inputClass} h-10`}
                    />
                    <button
                      type="button"
                      onClick={() => patchExample(index, { deleted: true })}
                      className="shrink-0 rounded-[9px] px-2.5 py-1.5 text-[12px] font-medium text-[#A32D2D] transition-colors hover:bg-[#FCEBEB]"
                    >
                      Delete
                    </button>
                  </div>
                  <textarea
                    value={example.bodyExample}
                    onChange={(event) => patchExample(index, { bodyExample: event.target.value })}
                    placeholder="Paste a real email you sent…"
                    className={`${inputClass} h-32 py-2`}
                  />
                  <label className="flex items-center gap-2 text-[12px] text-[#6B6F68]">
                    <input type="checkbox" checked={example.active} onChange={(event) => patchExample(index, { active: event.target.checked })} />
                    Use this example when drafting
                  </label>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setForm({ ...form, examples: [...form.examples, { ...BLANK_EXAMPLE }] })}
                className="text-[13px] font-medium text-[#1F5FA8] transition-colors hover:text-[#174C87]"
              >
                + Add example
              </button>
            </div>

            {error ? <p className="text-[13px] text-[#A32D2D]">{error}</p> : null}
          </>
        ) : null}
      </Modal>
    </div>
  );
}
