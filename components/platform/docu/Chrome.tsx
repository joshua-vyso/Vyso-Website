'use client';

import { ModuleHeader } from '@/components/platform/module-ui';
import { MODULE_META } from '@/lib/platform/module-meta';
import { DocuNav } from './DocuNav';

const M = MODULE_META.docu;

/**
 * Doc-U chrome: the module identity header (icon + name + description) sitting
 * ABOVE the Doc-U tab bar, matching the SupplySync/InsightGen Chrome pattern
 * (ModuleHeader → SubNav → page body).
 *
 * Doc-U has no module layout of its own — the detail (`/app/docu/[id]`) and
 * upload screens deliberately render WITHOUT tabs, and the detail view owns its
 * own full-height scroll container. So the chrome is a component mounted
 * exactly where `DocuNav` used to be, rather than a `layout.tsx`: every screen
 * keeps precisely the tabs it shows today, now with the header above them.
 */
export function DocuChrome({ reviewCount = 0 }: { reviewCount?: number }) {
  return (
    <>
      <ModuleHeader icon={M.icon} title={M.name} description={M.description} />
      <div className="mt-5">
        <DocuNav reviewCount={reviewCount} />
      </div>
    </>
  );
}
