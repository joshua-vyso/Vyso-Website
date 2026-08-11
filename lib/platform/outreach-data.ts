import { cache } from 'react';
import { getCampaigns, getEmailTemplates, getOutreachLeads } from '@/lib/platform/notion-outreach';

/**
 * Request-scoped memoisation, so the Outreach layout can label its tabs with
 * live counts without every page paying a second Notion round trip. React's
 * cache is per request, so two renders never share stale data.
 *
 * Kept out of notion-outreach.ts on purpose: that module is imported by client
 * components for its types and select options, and `react`'s cache has no
 * business in the browser bundle.
 */
export const cachedOutreachLeads = cache(getOutreachLeads);
export const cachedEmailTemplates = cache(getEmailTemplates);
export const cachedCampaigns = cache(getCampaigns);
