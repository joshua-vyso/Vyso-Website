import { OG_CONTENT_TYPE, OG_SIZE, renderOrbitOgImage } from "@/lib/og/orbit";

export const runtime = "nodejs";
export const alt = "How Orbit works — a job, recorded and invoiced from a chat.";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return renderOrbitOgImage({
    eyebrow: "ORBIT · HOW IT WORKS",
    title: "How Orbit works.",
    lead: "You send a message. Orbit makes the record, keeps the money straight and hands you a draft invoice. Orbit drafts, you send.",
  });
}
