'use client';

import { reviewItemKey } from '@/lib/platform/review-actions-shared';
import type {
  ReviewModuleGroup,
  ReviewModuleKey,
  ReviewTaskId,
} from '@/lib/platform/review-queue-shared';
import { ApproveAllButton } from './ApproveAllButton';
import { ReviewItemRow } from './ReviewItemRow';

/**
 * One module's pile, and the tasks inside it
 * (`.ai/plan_review_v2.md` §1.1 — "groups by module → task").
 *
 * TWO HEADINGS, TWO BATCH BUTTONS, AND SOMETIMES NEITHER. A module header shows
 * "Approve all in Doc-U" only when something under it is approvable, and a task
 * header shows "Approve all N" on the same condition. That is not a styling
 * choice: `docu:flagged` and `orderflow:quotes` have no module function behind
 * an approval (see `REVIEW_TASKS`), so a button there could only lie about what
 * it was going to do. Their headings carry the count alone.
 *
 * THE MODULE BUTTON IS HIDDEN WHEN IT WOULD DUPLICATE THE ONLY TASK BUTTON
 * UNDER IT. A module with one approvable task drawn two rows apart would offer
 * the same fourteen items twice, under two different names, and the owner would
 * reasonably wonder what the difference was. There is none, so only the task's
 * is drawn.
 */
export function ReviewGroup({
  group,
  openKey,
  errors,
  busyScope,
  onOpenItem,
  onApproveTask,
  onApproveModule,
}: {
  group: ReviewModuleGroup;
  openKey: string | null;
  errors: Record<string, string>;
  /** Which batch is in flight, as a scope string ('all', 'module:docu',
   *  'task:docu:invoices'), or null. One at a time: a second batch launched over
   *  a running one would approve against a list that is already moving. */
  busyScope: string | null;
  onOpenItem: (key: string) => void;
  onApproveTask: (taskId: ReviewTaskId) => void;
  onApproveModule: (moduleKey: ReviewModuleKey) => void;
}) {
  const approvableTasks = group.tasks.filter((t) => t.approvable > 0);
  const showModuleButton = group.approvable > 0 && approvableTasks.length > 1;

  return (
    <section aria-label={group.label} className="mt-6 first:mt-0">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[var(--pf-border-warm)] pb-2">
        <h2 className="of-display text-[14px] font-semibold tracking-[-0.01em] text-[var(--pf-text)]">
          {group.label}
        </h2>
        <span className="of-num text-[12.5px] text-[var(--pf-text-faint)]">{group.count}</span>
        <span className="ml-auto">
          {showModuleButton ? (
            <ApproveAllButton
              label={`Approve all in ${group.label} (${group.approvable})`}
              count={group.approvable}
              busy={busyScope === `module:${group.key}`}
              onApprove={() => onApproveModule(group.key)}
            />
          ) : null}
        </span>
      </div>

      {group.tasks.map((task) => (
        <div key={task.task.id} className="mt-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pb-2">
            <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-[var(--pf-text-faint)]">
              {task.task.label}
              <span className="of-num ml-2 font-normal tracking-normal">{task.items.length}</span>
            </h3>
            <span className="ml-auto">
              <ApproveAllButton
                label={`Approve all ${task.approvable}`}
                count={task.approvable}
                busy={busyScope === `task:${task.task.id}`}
                onApprove={() => onApproveTask(task.task.id)}
              />
            </span>
          </div>

          <ul className="flex flex-col gap-1.5">
            {task.items.map((item) => {
              const key = reviewItemKey(item);
              return (
                <ReviewItemRow
                  key={key}
                  item={item}
                  open={openKey === key}
                  error={errors[key]}
                  busy={busyScope !== null}
                  onOpen={() => onOpenItem(key)}
                />
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
