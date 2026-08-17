/* Title card for the scroll sequence. Sits in its own wrapper (not a <section>)
   because it belongs to the sequence block that follows it. */
export function SequenceIntro() {
  return (
    <div className="mx-auto max-w-[1160px] px-[20px] pb-[8px] lg:px-[40px]">
      <div className="border-t border-fn-line pt-[40px] lg:pt-[64px]">
        <div className="mb-[14px] font-fn-mono text-[10px] tracking-[0.14em] text-fn-muted lg:text-[11px]">
          WHAT HAPPENS TO AN INVOICE INSIDE FINCH
        </div>
        <h2 className="m-0 max-w-[620px] font-fn-serif text-[28px] font-medium leading-[1.15] tracking-[-0.02em] lg:text-[38px]">
          From paper to a decision, while you serve customers.
        </h2>
      </div>
    </div>
  );
}

export default SequenceIntro;
