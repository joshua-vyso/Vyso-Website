import type { DocumentSourceType, MessageOrderEvidence } from '@/lib/platform/types';

function sourceLabel(sourceType: DocumentSourceType | null | undefined, evidence: MessageOrderEvidence | null | undefined): string | null {
  if (evidence?.primary_source === 'combined') return 'Email + attachment';
  if (evidence?.primary_source === 'email_body' || sourceType === 'email_body') return 'Email body';
  if (evidence?.primary_source === 'attachment') return 'Attachment';
  return null;
}

export function MessageOrderEvidenceNotice({
  sourceType,
  evidence,
  compact = false,
}: {
  sourceType?: DocumentSourceType | null;
  evidence?: MessageOrderEvidence | null;
  compact?: boolean;
}) {
  const label = sourceLabel(sourceType, evidence);
  const conflicts = evidence?.conflicts ?? [];
  if (!label && conflicts.length === 0) return null;

  if (compact) {
    return (
      <span className={conflicts.length ? 'text-[#854F0B]' : 'text-[#6B6F68]'}>
        {label ?? 'Message evidence'}
        {conflicts.length ? ` · ${conflicts.length} conflict${conflicts.length === 1 ? '' : 's'}` : ''}
      </span>
    );
  }

  return (
    <div className={`rounded-xl border px-4 py-3 ${conflicts.length ? 'border-[#F3E2C4] bg-[#FFF9EF]' : 'border-[#CFE0F3] bg-[#F5F9FE]'}`}>
      <p className={`text-[13px] font-semibold ${conflicts.length ? 'text-[#854F0B]' : 'text-[#174C87]'}`}>
        Source · {label ?? 'Message evidence'}
      </p>
      {conflicts.length ? (
        <div className="mt-2 space-y-1.5 text-[12px] text-[#6B4B20]">
          <p>Body and attachment disagree. Confirm these values before saving:</p>
          {conflicts.slice(0, 20).map((conflict, index) => (
            <p key={`${conflict.field}-${conflict.line_index ?? 'field'}-${index}`}>
              <span className="font-medium">{conflict.field.replaceAll('_', ' ')}</span>
              {conflict.line_index != null ? ` · line ${conflict.line_index + 1}` : ''}
              {' — attachment: '}
              <span className="font-medium">{conflict.attachment_value || 'blank'}</span>
              {' · email: '}
              <span className="font-medium">{conflict.email_body_value || 'blank'}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-[12px] text-[#4C6682]">Source values were preserved with field-level provenance.</p>
      )}
    </div>
  );
}
