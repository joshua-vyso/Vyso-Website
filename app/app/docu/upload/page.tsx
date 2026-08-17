'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/platform/supabase-browser';
import { usePlatform } from '@/lib/platform/session';
import { startExtraction, uploadDocument, UPLOAD_ACCEPT } from '@/lib/platform/docu/upload-client';

export default function UploadPage() {
  const router = useRouter();
  const { org, userId } = usePlatform();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!org?.id) {
      setError('No organisation on your profile.');
      return;
    }
    const supabase = createClient();
    if (!supabase) {
      setError('Supabase is not configured.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Storage object → `pending` row → extraction, shared with the inbox's
      // upload bubble and the chat's drop zone (lib/platform/docu/upload-client).
      // `keepalive` inside startExtraction is what lets the request outlive the
      // router.push below — without it the navigation cancels the in-flight
      // fetch and the document is stranded on "pending".
      const { documentId } = await uploadDocument(file, { orgId: org.id, userId, supabase });
      startExtraction(documentId);

      router.push('/app/docu');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-8 py-7">
      <Link href="/app/docu" className="text-[13px] font-medium text-[#6B6F68] transition-colors hover:text-[#174C87]">
        ← Documents
      </Link>
      <h1 className="of-display mt-3 text-[28px] font-semibold leading-tight tracking-[-0.015em] text-[#171A17]">Upload documents</h1>
      <p className="mt-1.5 text-[14px] text-[#8A8E86]">
        PDF, JPG or PNG. Doc-U will extract the details automatically.
      </p>

      <label className="mt-6 flex max-w-xl cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#E2E6EC] bg-[#FBFCFE] px-6 py-14 text-center transition-colors hover:border-[#3E7BC4]/40 hover:bg-[#F5F9FE]">
        <span className="of-display text-[16px] font-semibold text-[#171A17]">
          {busy ? 'Uploading…' : 'Choose a file to upload'}
        </span>
        <span className="mt-1 text-[13px] text-[#A0A49C]">PDF, JPG or PNG · up to 20MB</span>
        <input
          type="file"
          accept={UPLOAD_ACCEPT}
          className="hidden"
          disabled={busy}
          onChange={handleFile}
        />
      </label>

      {error ? (
        <div className="mt-4 max-w-xl rounded-[14px] bg-[#FCEBEB] px-3.5 py-2.5 text-[13px] font-medium text-[#A32D2D]">
          {error}
        </div>
      ) : null}
    </div>
  );
}
