/* One-off: vendor third-party marks for the integrations logo wall from the
   Simple Icons CDN (icons are CC0; the marks remain their owners' property,
   used nominatively — see public/integrations/README.md). Each file gets a
   source comment. Usage: node scripts/fetch-logos.mjs */
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = new URL("../public/integrations/wall/", import.meta.url);
mkdirSync(OUT, { recursive: true });

const SLUGS = [
  ["slack", "Slack"], ["zoom", "Zoom"], ["googledrive", "Google Drive"], ["dropbox", "Dropbox"],
  ["googlesheets", "Google Sheets"], ["trello", "Trello"], ["asana", "Asana"], ["clickup", "ClickUp"],
  ["jira", "Jira"], ["hubspot", "HubSpot"], ["salesforce", "Salesforce"], ["zapier", "Zapier"],
  ["make", "Make"], ["airtable", "Airtable"], ["stripe", "Stripe"], ["paypal", "PayPal"],
  ["shopify", "Shopify"], ["woocommerce", "WooCommerce"], ["mailchimp", "Mailchimp"], ["twilio", "Twilio"],
  ["docusign", "DocuSign"], ["zendesk", "Zendesk"], ["intercom", "Intercom"], ["freshdesk", "Freshdesk"],
  ["pipedrive", "Pipedrive"], ["zoho", "Zoho"], ["sap", "SAP"], ["oracle", "Oracle"],
  ["googlegemini", "Gemini"], ["perplexity", "Perplexity"], ["mistralai", "Mistral"], ["huggingface", "Hugging Face"],
  ["github", "GitHub"], ["gitlab", "GitLab"], ["supabase", "Supabase"], ["postgresql", "PostgreSQL"],
  ["mysql", "MySQL"], ["amazonwebservices", "AWS"], ["googlecloud", "Google Cloud"], ["vercel", "Vercel"],
  ["cloudflare", "Cloudflare"], ["telegram", "Telegram"], ["discord", "Discord"], ["calendly", "Calendly"],
  ["typeform", "Typeform"], ["canva", "Canva"], ["figma", "Figma"], ["evernote", "Evernote"],
  ["box", "Box"], ["googlecalendar", "Google Calendar"], ["gmail", "Gmail"], ["googlemaps", "Google Maps"],
  ["monday", "monday.com"], ["basecamp", "Basecamp"], ["miro", "Miro"], ["linear", "Linear"],
  ["odoo", "Odoo"], ["square", "Square"], ["wise", "Wise"], ["revolut", "Revolut"],
  ["n8n", "n8n"], ["openai", "OpenAI"], ["anthropic", "Anthropic"], ["meta", "Meta"],
  ["whatsapp", "WhatsApp"], ["xero", "Xero"], ["quickbooks", "QuickBooks"], ["sage", "Sage"],
  ["notion", "Notion"], ["mongodb", "MongoDB"], ["snowflake", "Snowflake"], ["tableau", "Tableau"],
  ["powerbi", "Power BI"], ["looker", "Looker"], ["metabase", "Metabase"], ["retool", "Retool"],
];

const kept = [];
for (const [slug, name] of SLUGS) {
  const url = `https://cdn.simpleicons.org/${slug}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(String(res.status));
    const svg = await res.text();
    if (!svg.includes("<svg")) throw new Error("not svg");
    const stamped = `<!-- ${name} mark. Source: ${url} (Simple Icons, CC0). Trademark of its owner; nominative use only, see public/integrations/README.md -->\n${svg}`;
    writeFileSync(new URL(`${slug}.svg`, OUT), stamped);
    kept.push({ slug, name });
    console.log("ok  ", slug);
  } catch (err) {
    console.log("skip", slug, String(err).slice(0, 40));
  }
}
writeFileSync(new URL("index.json", OUT), JSON.stringify(kept, null, 2));
console.log(`kept ${kept.length}`);
