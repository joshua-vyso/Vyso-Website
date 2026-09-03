import type { DocuExtractedData } from '@/lib/platform/docu/types';

/** A one-line note whenever the lines were read after rotating the page —
 *  the stored preview still shows the ORIGINAL scan, not the rotated copy the
 *  model actually read, so a reviewer comparing rows against the preview
 *  needs to know to mentally rotate it first. Shown independently of the
 *  structural audit: a rotation-adopted read can still carry a clean
 *  structure_audit (it is capped in confidence for exactly this reason — see
 *  finalizeExtractionConfidence in extraction-quality.ts — but that cap
 *  doesn't explain itself on screen without this line). */
function RotationNotice({
  orientation,
  className = '',
}: {
  orientation: DocuExtractedData['orientation_normalization'];
  className?: string;
}) {
  if (!orientation?.applied) return null;
  return (
    <div className={`rounded-[12px] border border-[#F0E4C8] bg-[#FDFAF0] px-4 py-3 ${className}`}>
      <p className="text-[13px] font-medium text-[#8A6D1F]">Read after rotating the page</p>
      <p className="mt-0.5 text-[12px] leading-[1.55] text-[#8A7A4A]">
        The lines were read after the page was rotated to make them legible. The stored preview below shows the
        original scan, not the rotated copy the model read — compare rows with that in mind.
      </p>
    </div>
  );
}

export function StructureAuditNotice({
  audit,
  orientation,
  className = '',
}: {
  audit: DocuExtractedData['structure_audit'];
  orientation?: DocuExtractedData['orientation_normalization'];
  className?: string;
}) {
  const rotationNotice = orientation ? <RotationNotice orientation={orientation} className={className} /> : null;
  if (!audit || audit.status === 'ok') return rotationNotice;

  const issues: string[] = [];
  if (audit.suspicious_description_rows > 0) {
    issues.push(`${audit.suspicious_description_rows} suspiciously short description row(s)`);
  }
  if (audit.missing_unit_price_rows > 0) {
    issues.push(`${audit.missing_unit_price_rows} row(s) without unit price`);
  }
  if (audit.missing_amount_rows > 0) issues.push(`${audit.missing_amount_rows} row(s) without amount`);
  if (audit.unsupported_box_default_rows > 0) {
    issues.push(`${audit.unsupported_box_default_rows} unsupported box unit(s)`);
  }
  if (audit.repeated_description_rows > 0) {
    issues.push(`${audit.repeated_description_rows} repeated description row(s)`);
  }
  if ((audit.repeated_reference_rows ?? 0) > 0) {
    issues.push(
      `${audit.repeated_reference_rows} row(s) listed twice under the same invoice number (exact repeats were dropped)`,
    );
  }

  return (
    <>
      {rotationNotice}
      <div className={`rounded-[12px] border border-[#F3D6D6] bg-[#FDF6F6] px-4 py-3 ${className}`}>
        <p className="text-[13px] font-medium text-[#A32D2D]">Table extraction needs review</p>
        <p className="mt-0.5 text-[12px] leading-[1.55] text-[#8A5A5A]">
          The document read lost part of the table structure. Compare every row with the original before approving
          {issues.length ? `: ${issues.join('; ')}.` : '.'}
        </p>
      </div>
    </>
  );
}
