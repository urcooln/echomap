# ChildLed portable production architecture

ChildLed is designed to run as an ordinary HTTP API and static web client on any
host that provides PostgreSQL, Replit-managed Clerk, and
private S3-compatible object storage. The browser never receives database,
storage, encryption, or identity-provider credentials.

## Required production configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URL. |
| `PUBLIC_APP_ORIGIN` | The single canonical browser origin, such as `https://app.example.com`. |
| `ALLOWED_APP_ORIGINS` | Optional comma-separated additional trusted browser origins. |
| `CHILDLED_DATA_ENCRYPTION_KEY` | Base64 32-byte key used for application-level encryption at rest. Rotate through a deliberate key-version migration. |
| `CHILDLED_AUTH_MODE=clerk` | Enables the Replit-managed Clerk authentication boundary (the default). |
| `CHILDLED_AUDIO_STORAGE_DRIVER=s3` | Selects private S3-compatible audio storage. |
| `CHILDLED_S3_BUCKET` | Private bucket name for therapy audio. |
| `CHILDLED_S3_REGION` | S3 region. |
| `CHILDLED_S3_ENDPOINT` | Optional custom endpoint for MinIO, Cloudflare R2, or another compatible service. |
| `CHILDLED_S3_FORCE_PATH_STYLE=true` | Optional setting for compatible services that require path-style addressing. |
| `CHILDLED_S3_ACCESS_KEY_ID` | Scoped S3-compatible access key ID. |
| `CHILDLED_S3_SECRET_ACCESS_KEY` | Scoped S3-compatible secret access key. |
| `CHILDLED_S3_SESSION_TOKEN` | Optional temporary credential session token. |

Access keys, workload identity, or instance roles are configured by the chosen
S3 provider and must never be committed or placed in browser configuration.

## Authentication and authorization

Clerk owns email/password sign-up, email verification, password recovery, and
session renewal. The API verifies Clerk's session cookie on every private
request, confirms a verified email through Clerk, then maps the Clerk user ID
to a local `users` record. It resolves an active organization membership and an
explicit child care-team membership; roles and child IDs are never browser
input. A user with more than one organization supplies the authorized
organization ID in `X-ChildLed-Organization-ID`.

The server enforces the following application roles:

- **Clinician**: explicitly assigned children and clinical session workflow.
- **Parent**: explicitly assigned children; private clinical routes still
  enforce their narrower operation permissions.
- **Teacher**: explicitly assigned children.
- **Admin**: organization administration; child data still requires an
  explicit child membership.

There is no ChildLed password store or demo-session cookie. Configure Clerk
session maximum lifetime and inactivity timeout in the managed Clerk Dashboard:
Configure → Sessions. ChildLed warns after 13 minutes and clears local private
state at 15 minutes of browser inactivity; set the provider controls to an
equal or stricter policy in both Development and Production.

## Storage and data boundaries

Clinical audio uses a narrow `AudioObjectStore` interface. The local encrypted
adapter exists only for development and automated tests. Production composition
must inject an S3-compatible client that supports `PutObject`, `GetObject`, and
`DeleteObject`; objects use private, organization-scoped keys and are accessed
only through authorized API handlers.

PostgreSQL tables model organizations, provider-backed users, organization and
care-team memberships, child profiles, clinical gestalts and observations,
reviewed sessions, session gestalts, and audio metadata. Foreign keys,
organization/child indexes, archival timestamps, and uniqueness constraints
enforce the core tenancy boundaries.

## Migration and deployment order

1. Back up the existing database and export legacy JSON session metadata and
   local encrypted recording objects.
2. Apply the additive schema through the normal development-to-publish database
   workflow. Do not run handwritten production DDL at application startup.
3. Have the initial administrator complete Clerk sign-up and email verification,
   then map that Clerk user ID to a local user, organization membership, and
   explicit child-care-team memberships. Repeat the local invitation step for
   every additional care-team account before granting child access.
4. Provision a private S3-compatible bucket with no public read/list policy and
   grant the API only scoped object permissions.
5. Configure the required environment variables, then verify `/api/healthz`
   and `/api/readyz`. The first confirms process liveness; the latter verifies
   PostgreSQL reachability.
6. Import legacy data with an explicit, idempotent migration tool before
   disabling the legacy development adapter. Verify counts and sample encrypted
   audio retrieval before decommissioning local data.

## Operations

- Take regular PostgreSQL backups and test restore procedures.
- Retain immutable deletion-request audit history even when the associated child
  profile is removed.
- Monitor failed OIDC actor resolution, storage access errors, and `/api/readyz`
  failures without logging raw transcript, note, or audio content.
- Production readiness also requires provider configuration, backups, least
  privilege storage policy, monitoring, and deployment review; this code does
  not itself claim a regulatory certification.