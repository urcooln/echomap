# ChildLed privacy readiness

Status: **not certified or cleared for identifiable student data by this document**.
This is an engineering inventory for school administrators and qualified privacy
counsel, not a legal opinion. Do not treat an SLP checkbox or a Clerk invitation
as school approval, FERPA authorization, or verifiable COPPA consent.

## Immediate release blockers

| Item | Repository evidence | Decision or evidence needed |
| --- | --- | --- |
| Reviewed privacy notice and terms | `artifacts/childled/src/content/legal.ts` contains explicit placeholders; onboarding links to this text | Privacy counsel must approve a factual notice covering data categories, purposes, processors, retention, deletion, contact information, and rights, then replace and version the published text. |
| School authority for each deployment | `artifacts/api-server/src/lib/child-profile-consent.ts` records a user's self-attestation, not a school authorization | Identify the school or district decision-maker and document its legal basis for disclosure, direct control, authorized users, and any written agreement. FERPA does not always require a written agreement, but one is recommended and local rules may require it. |
| COPPA applicability and consent | ChildLed accepts child voice recordings; the current checkbox does not verify parental identity or school authority | Counsel must decide whether COPPA applies to each use, then approve the required notice and consent mechanism. School consent is limited to school-authorized educational purposes, not other commercial uses. |
| Processor and AI review | Clerk authentication, private object storage, and `@workspace/integrations-openai-ai-server` are in the data path (`artifacts/api-server/src/lib/session-transcription.ts`, `ai-session-note.ts`) | Inventory actual deployed vendors, subprocessors, regions, data use, training/retention terms, access, incident terms, and school-required agreements. Verify staging separately. |
| Retention and deletion | `artifacts/api-server/src/routes/childled.ts` runs cleanup for audio and observation videos; session-note and archived-storage retention settings are stored but not enforced by cleanup jobs | Agree on record schedules, legal holds, backups, and deletion behavior with schools before implementing any automatic deletion of education records. Test object and database cleanup plus restore/backup expiry. |
| Parent/school rights | The app has child-scoped deletion request handlers in `artifacts/api-server/src/routes/childled.ts`, but this is not evidence of a complete access, correction, or export procedure | Define verified requester handling, response ownership, deadlines, exceptions, and an auditable process for access, correction, export, and deletion. |
| Security operations | Code has child-scoped access checks, audit events, and encryption helpers; deployed configuration and operating procedures are not established by source code | Review production IAM, encryption keys, backup restore, MFA/session settings, vulnerability management, incident response, monitoring, access reviews, and independent security testing. |

## Engineering controls already visible

- `artifacts/api-server/src/lib/clerk-auth-middleware.ts` resolves a verified Clerk identity and active organization/care-team memberships.
- `artifacts/api-server/src/lib/auth-authorization.ts` checks assigned-child access; route-level authorization still needs endpoint-by-endpoint testing.
- `artifacts/api-server/src/lib/security-governance.ts` records security audit events and classifies sensitive data.
- `artifacts/api-server/src/routes/childled.ts` includes child-scoped deletion requests and cleanup for certain media objects.

These are useful controls, **not** proof that deployed ChildLed complies with FERPA or COPPA.

## Evidence to collect before a compliance claim

1. Counsel-approved applicability analysis, privacy notice, consent language, and version history.
2. School/district authorization records and agreements for every organization using real student data.
3. Current data-flow map and signed/approved terms for Clerk, hosting, database, object storage, AI/transcription, email, logging, and backup providers.
4. Written security, retention/deletion, and incident-response procedures with named owners and test evidence.
5. SLP, Teacher, Parent, and Dev negative-access tests in the deployed environment, including cross-organization and cross-child requests.
6. Verified parent/school access, correction, export, deletion, and consent-withdrawal workflows.

Use synthetic records in staging until the organization approves its use for real student data. Do not call the product "FERPA compliant" or "COPPA compliant" solely because these controls exist.

## Official guidance

- U.S. Department of Education, [online educational services and FERPA](https://studentprivacy.ed.gov/faq/i-want-use-online-tool-or-application-part-my-course-however-i-am-worried-it-violation-ferpa).
- U.S. Department of Education, [written agreements under the school official exception](https://studentprivacy.ed.gov/faq/must-school-have-written-agreement-or-contract-community-based-organization-which-it-non).
- FTC, [COPPA and schools FAQ](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions).
- FTC, [COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business).
