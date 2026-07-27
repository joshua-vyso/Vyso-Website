# AI development workflow

## Roles
- Fable is the architect: it plans, identifies affected files, defines interfaces,
  edge cases, acceptance criteria, and verification steps. It does not edit code.
- Codex is the implementer: it follows the approved plan, edits only necessary files,
  runs verification, and reports deviations.

## Workflow
1. For every feature or non-trivial bug, create `.ai/plan.md` before editing.
2. Do not start implementation until the plan is present and approved by the user.
3. Follow the plan exactly. If it lacks a material decision, stop and ask instead
   of inventing architecture.
4. Keep changes scoped to the task.
5. Run relevant tests, linting, and type-checking before declaring completion.
6. Write outcomes and any deviations to `.ai/implementation.md`.

## Planning contract
Every plan must include:
- Goal and acceptance criteria
- Files to create or modify
- Constraints and files not to touch
- Data/API/interface changes
- Ordered implementation steps
- Edge cases
- Exact verification commands