---
name: childled-auth-security
description: Use when ChildLed authentication, Clerk, invitations, roles, permissions, student access, messaging recipients, or account access are involved.
---

# ChildLed Auth & Security

- Inspect both client routing (`artifacts/childled/src/lib/role-routing.ts` and the affected UI) and server enforcement (`artifacts/api-server/src/lib/clerk-auth-middleware.ts`, `api-authorization-middleware.ts`, `auth-authorization.ts`, and the affected route). Hidden navigation is not authorization.
- Resolve role and workspace from verified server-side identity and active membership. Check onboarding/access status and explicit child care-team membership before reading or changing child data. Reject swapped child IDs, organization IDs, and direct API/URL access across care circles.
- For invitations, inspect the Clerk provisioning and invitation-validation path. Bind role, organization, child, and inviter to trusted server-side invitation data; enforce expiry/use rules and existing-account role checks. Never let a client-supplied role or a known ChildLed ID confer access.
- Test allowed and denied behavior for SLP, Teacher, Parent, and Dev/demo personas where applicable, including messaging recipient selection. Dev preview privileges must remain testing-only and must not be grantable to production users or persist as production roles.
- Add or run negative authorization tests as well as happy-path tests. Do not weaken server checks to make a UI flow pass.
