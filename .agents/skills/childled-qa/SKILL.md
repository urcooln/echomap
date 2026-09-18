---
name: childled-qa
description: Use when implementing, testing, reviewing, or fixing a ChildLed feature to verify workflows, states, roles, and regressions.
---

# ChildLed QA

- Trace the feature through its UI, API, persistence, and existing tests before deciding what to verify. Test the complete user workflow where practical, not just a helper function.
- Exercise SLP, Teacher, and Parent perspectives where relevant; include Dev persona testing only when the feature uses it. Check authorized and unauthorized paths.
- Cover loading, empty, error, and populated states; desktop and mobile; and adjacent workflows that could regress. Prefer synthetic test data and verify the target environment before database-backed tests.
- Run relevant package tests, type checks, configured lint, and a production build for affected packages before calling implementation complete. Consult `package.json` and package scripts; do not claim a check ran if no script exists or it was blocked. Database-backed API tests may need `tools/run-with-env.mjs` after confirming a local database target.
- Report findings with reproduction steps, expected behavior, actual behavior, likely cause (mark hypotheses as such), and a recommended fix. State what was tested, what passed, and any unverified manual or external-service steps.
