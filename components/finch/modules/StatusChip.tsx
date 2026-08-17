/* A quiet mono pill for a module's own availability (LIVE / LIMITED ROLLOUT —
   see `ModuleAvailability` in `lib/marketing/module-types.ts`). Styled after
   `FindingHeader`'s "IN PROGRESS"/"RESOLVED" chips in
   `components/finch/FindingCard.tsx`: neutral ink on a hairline border.
   Deliberately NOT orange or blue — colour discipline reserves orange for
   agent activity and the primary CTA, and blue for evidence, and a module's
   availability is neither. */
export function StatusChip({ status, className = "" }: { status: string; className?: string }) {
  return (
    <span
      className={
        "inline-block whitespace-nowrap rounded-[99px] border border-fn-line px-[9px] py-[3px] font-fn-mono text-[10px] tracking-[0.1em] text-fn-muted " +
        className
      }
    >
      {status}
    </span>
  );
}

export default StatusChip;
