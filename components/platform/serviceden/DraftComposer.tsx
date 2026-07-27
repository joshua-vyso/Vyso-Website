'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/platform/module-ui';
import { createClient } from '@/lib/platform/supabase-browser';
import {
  LEAD_STAGE_META,
  connectionHasSendScope,
  type SdEmailDraft,
  type SdGmailConnection,
  type SdLead,
} from '@/lib/platform/serviceden';
import { Field, Modal, SdPrimary, inputClass } from './ui';

interface TemplateOption { id: string; name: string }

function Warning({ children }: { children: React.ReactNode }) {
  return <p className="rounded-[10px] bg-[#FBEEDA] px-3.5 py-2.5 text-[13px] text-[#854F0B]">{children}</p>;
}

function Secondary({ onClick, children, disabled = false }: { onClick: () => void; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-[42px] items-center rounded-[11px] border border-[#E2E6EC] bg-white px-[18px] text-[14px] font-medium text-[#3E4A57] transition-all hover:border-[#C9DEF7] hover:bg-[#EAF2FC] hover:text-[#174C87] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/**
 * Writes, edits, approves and sends one email to one lead. Approval and sending
 * are two server calls behind one click, and every edit made here revokes the
 * approval server-side — the button never sends what you have not just seen.
 */
export function DraftComposer({
  open,
  lead,
  threadId,
  connection,
  orgId,
  onClose,
  onSent,
  show,
}: {
  open: boolean;
  lead: SdLead;
  threadId: string | null;
  connection: SdGmailConnection | null;
  orgId: string;
  onClose: () => void;
  onSent: () => void;
  show: (message: string) => void;
}) {
  const [draft, setDraft] = useState<SdEmailDraft | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [followUpDays, setFollowUpDays] = useState('');
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [exampleTemplateId, setExampleTemplateId] = useState('');

  const dirty = Boolean(
    draft &&
      (subject !== draft.subject ||
        body !== draft.body ||
        (Number(followUpDays) || null) !== draft.suggestedFollowUpDays),
  );

  const generate = useCallback(async (regenerateId?: string) => {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/serviceden/leads/${encodeURIComponent(lead.id)}/drafts`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          threadId,
          draftIdToRegenerate: regenerateId,
          force: lead.stage === 'lost',
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { draft?: SdEmailDraft; error?: string };
      if (!response.ok || !result.draft) throw new Error(result.error || 'Could not write this draft.');
      setDraft(result.draft);
      setSubject(result.draft.subject);
      setBody(result.draft.body);
      setFollowUpDays(result.draft.suggestedFollowUpDays ? String(result.draft.suggestedFollowUpDays) : '');
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Could not write this draft.');
    } finally {
      setGenerating(false);
    }
  }, [lead.id, lead.stage, threadId]);

  // Generate exactly once per opening. Sending changes the lead's stage and
  // attaches a thread, which would otherwise re-run this effect and quietly
  // write (and pay for) a second draft over the one just sent.
  const generatedForThisOpen = useRef(false);
  useEffect(() => {
    if (!open) { generatedForThisOpen.current = false; return; }
    if (generatedForThisOpen.current) return;
    generatedForThisOpen.current = true;
    setDraft(null);
    setSent(false);
    setError(null);
    void generate();
  }, [open, generate]);

  async function saveDraft(): Promise<SdEmailDraft | null> {
    if (!draft) return null;
    const response = await fetch(`/api/serviceden/drafts/${encodeURIComponent(draft.id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ subject, body, suggestedFollowUpDays: Number(followUpDays) || null }),
    });
    const result = (await response.json().catch(() => ({}))) as { draft?: SdEmailDraft; error?: string };
    if (!response.ok || !result.draft) throw new Error(result.error || 'Could not save this draft.');
    setDraft(result.draft);
    return result.draft;
  }

  async function onSaveDraft() {
    setBusy(true);
    setError(null);
    try {
      await saveDraft();
      show('Draft saved');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this draft.');
    } finally {
      setBusy(false);
    }
  }

  async function approveAndSend() {
    if (!draft) return;
    if (!confirm(`Send this email to ${lead.email} now?`)) return;
    setBusy(true);
    setError(null);
    try {
      const saved = dirty ? await saveDraft() : draft;
      if (!saved) throw new Error('Could not save this draft.');

      // The server rejects approval of a draft whose research went stale (409).
      // Only waive that gate on an explicit, separate user decision — never
      // auto-forward the stale flag, or the gate would waive itself.
      let acceptStale = false;
      if (saved.staleResearch) {
        if (!confirm('The company research changed since this draft was generated. Send it anyway?')) return;
        acceptStale = true;
      }

      const approveResponse = await fetch(`/api/serviceden/drafts/${encodeURIComponent(saved.id)}/approve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ acceptStale }),
      });
      const approved = (await approveResponse.json().catch(() => ({}))) as { draft?: SdEmailDraft; error?: string };
      if (!approveResponse.ok || !approved.draft) throw new Error(approved.error || 'Could not approve this draft.');
      setDraft(approved.draft);

      const sendResponse = await fetch(`/api/serviceden/drafts/${encodeURIComponent(saved.id)}/send`, { method: 'POST' });
      const result = (await sendResponse.json().catch(() => ({}))) as { draft?: SdEmailDraft; error?: string };
      if (!sendResponse.ok) throw new Error(result.error || 'Gmail could not send this email.');
      if (result.draft) setDraft(result.draft);
      setSent(true);
      show(`Email sent to ${lead.email}`);
      onSent();
      await loadTemplates();
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Gmail could not send this email.');
    } finally {
      setBusy(false);
    }
  }

  const loadTemplates = useCallback(async () => {
    const supabase = createClient();
    if (!supabase) return;
    const { data } = await supabase
      .from('sd_email_templates')
      .select('id,name,stages')
      .eq('org_id', orgId)
      .eq('active', true);
    const options = ((data as { id: string; name: string; stages: string[] }[] | null) ?? [])
      .filter((row) => (row.stages ?? []).includes(lead.stage))
      .map((row) => ({ id: String(row.id), name: row.name }));
    setTemplates(options);
    setExampleTemplateId(options[0]?.id ?? '');
  }, [lead.stage, orgId]);

  async function saveAsExample() {
    const supabase = createClient();
    if (!supabase || !exampleTemplateId) return;
    setBusy(true);
    const { error: insertError } = await supabase.from('sd_email_template_examples').insert({
      org_id: orgId,
      template_id: exampleTemplateId,
      subject_example: subject,
      body_example: body,
      source: 'sent_email',
    });
    setBusy(false);
    show(insertError ? insertError.message : 'Saved as a writing example');
    if (!insertError) setTemplates([]);
  }

  const noSendScope = Boolean(connection && !connectionHasSendScope(connection.scopes));
  const stage = LEAD_STAGE_META[draft?.pipelineStageSnapshot ?? lead.stage];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={sent ? 'Email sent' : 'Draft email'}
      subtitle={`${lead.contactName} · ${lead.email}`}
      width={720}
      busy={busy || generating}
      footer={
        sent ? (
          <Secondary onClick={onClose}>Close</Secondary>
        ) : (
          <>
            <Secondary onClick={() => void generate(draft?.id)} disabled={busy || generating || !draft}>Regenerate</Secondary>
            <Secondary onClick={() => void onSaveDraft()} disabled={busy || generating || !draft}>Save draft</Secondary>
            <SdPrimary onClick={() => void approveAndSend()} disabled={busy || generating || !draft || !lead.email || !connection || noSendScope}>
              {busy ? 'Sending…' : 'Approve & send'}
            </SdPrimary>
          </>
        )
      }
    >
      {generating ? (
        <p className="py-10 text-center text-[13px] text-[#A0A49C]">Writing a draft from the conversation, your notes and the research…</p>
      ) : !draft ? (
        <div className="space-y-3 py-6 text-center">
          <p className="text-[13px] text-[#6B6F68]">{error ?? 'No draft yet.'}</p>
          <div className="flex justify-center"><Secondary onClick={() => void generate()}>Try again</Secondary></div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge label={stage.label} tone={stage.tone} />
            {draft.sourceThreadId ? <Badge label="Reply" tone="info" /> : <Badge label="New email" />}
            {draft.templateIds.length ? <Badge label={`${draft.templateIds.length} example${draft.templateIds.length === 1 ? '' : 's'} used`} /> : null}
            <Badge label={draft.researchId ? `${draft.usedSourceIds.length} research source${draft.usedSourceIds.length === 1 ? '' : 's'} cited` : 'No website context available'} />
          </div>

          {!lead.email ? <Warning>This lead has no email address.</Warning> : null}
          {!draft.researchId ? <Warning>No company research was available, so this draft is written from the conversation and your notes only.</Warning> : null}
          {draft.staleResearch ? <Warning>The company research changed after this draft was written. Regenerate it, or send it as it stands.</Warning> : null}
          {!connection ? <Warning>Connect Gmail before sending.</Warning> : null}
          {connection?.status === 'reauth_required' ? <Warning>Gmail needs reconnecting before anything can be sent.</Warning> : null}
          {noSendScope ? <Warning>Sending requires reconnecting Gmail to grant the new send permission.</Warning> : null}
          {dirty && draft.approvedAt ? <Warning>You edited this draft after approving it, so the approval was withdrawn. Approve &amp; send again to send it.</Warning> : null}

          <Field label="To"><input value={lead.email} readOnly className={`${inputClass} bg-[#F6F7F9] text-[#6B6F68]`} /></Field>
          <Field label="Subject"><input value={subject} onChange={(event) => setSubject(event.target.value)} className={inputClass} /></Field>
          <Field label="Message">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className={`${inputClass} min-h-[280px] py-2.5 leading-relaxed`}
            />
          </Field>
          <Field label="Follow up in" hint="(business days)">
            <input
              type="number"
              min={1}
              max={30}
              value={followUpDays}
              onChange={(event) => setFollowUpDays(event.target.value)}
              className={`${inputClass} w-[120px]`}
            />
          </Field>

          {draft.reasoningSummary ? (
            <div className="rounded-[14px] border border-[#DCE9F8] bg-[#F5F9FE] p-4">
              <p className="text-[12px] font-semibold uppercase tracking-[0.05em] text-[#1F5FA8]">Agent readout</p>
              <p className="mt-2 text-[13px] leading-relaxed text-[#171A17]">{draft.reasoningSummary}</p>
            </div>
          ) : null}

          {sent && templates.length ? (
            <div className="rounded-[14px] border border-[#EEF1F5] bg-white p-4">
              <p className="text-[13px] font-medium text-[#171A17]">Save this email as a writing example?</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select value={exampleTemplateId} onChange={(event) => setExampleTemplateId(event.target.value)} className={`${inputClass} w-[260px]`}>
                  {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
                </select>
                <Secondary onClick={() => void saveAsExample()} disabled={busy}>Save example</Secondary>
              </div>
            </div>
          ) : null}

          {error ? <p className="rounded-[10px] bg-[#FCEBEB] px-3.5 py-2.5 text-[13px] text-[#A32D2D]">{error}</p> : null}
        </>
      )}
    </Modal>
  );
}
