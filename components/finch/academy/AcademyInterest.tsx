"use client";

import { useCallback, useState } from "react";

import ContactForm from "@/components/ContactForm";
import { track } from "@/lib/analytics";
import { SeatGrid } from "./SeatGrid";

/* Owns the one piece of state the seat grid and the form share: how many
   seats this session has filled. `ContactForm`'s `onSuccess` fires once,
   after a real 200 from `/api/contact` — so the fill is tied to an actual
   successful submit, not to opening the form or typing into it. */
export function AcademyInterest() {
  const [filled, setFilled] = useState(0);

  const handleSuccess = useCallback(() => {
    setFilled((n) => n + 1);
    track("academy_interest", {});
  }, []);

  return (
    <div className="grid grid-cols-1 gap-[40px] lg:grid-cols-[1fr_1fr] lg:gap-[64px]">
      <div>
        <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
          SEATS
        </p>
        <SeatGrid filled={filled} />
      </div>
      <div>
        <p className="mb-[14px] font-fn-mono text-[11px] tracking-[0.14em] text-fn-muted">
          REGISTER INTEREST
        </p>
        <ContactForm variant="academy" onSuccess={handleSuccess} />
      </div>
    </div>
  );
}

export default AcademyInterest;
