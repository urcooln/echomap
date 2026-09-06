# EchoMap Staging Deployment

This setup is the first production-shaped step for EchoMap:

1. Private GitHub repo.
2. GitHub Actions CI.
3. One Cloud Run service for the API and compiled Vite frontend.
4. PostgreSQL connection through `DATABASE_URL`.
5. Google Cloud Storage for private uploads.
6. Google Secret Manager for runtime secrets.
7. Optional custom domain pointed at Cloud Run.

GitHub Pages is not enough for this app because EchoMap is not a static-only
site. It has an Express API, private file uploads, Clerk auth middleware,
database writes, PDF processing, and AI integrations.

## Current Local Limitation

This machine currently has `git`, `node`, and `pnpm`, but not `gh`, `gcloud`, or
`docker`. The repo can be prepared locally, but creating the GitHub repo,
creating cloud resources, and triggering deployment require either:

- installing and signing in to the GitHub and Google Cloud CLIs, or
- connecting GitHub/Google Cloud through an approved plugin or account workflow.

## GitHub Repository Variables

Create a GitHub environment named `staging`, then add these repository or
environment variables:

| Variable                            | Staging value                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------ |
| `GCP_PROJECT_ID`                    | `crested-timer-507620-r1`                                                            |
| `GCP_REGION`                        | `us-central1`                                                                        |
| `GCP_WORKLOAD_IDENTITY_PROVIDER`    | `projects/118320805216/locations/global/workloadIdentityPools/github/providers/echomap` |
| `GCP_DEPLOY_SERVICE_ACCOUNT`        | `github-deploy@crested-timer-507620-r1.iam.gserviceaccount.com`                      |
| `CLOUD_RUN_RUNTIME_SERVICE_ACCOUNT` | `echomap-runtime@crested-timer-507620-r1.iam.gserviceaccount.com`                    |
| `CLOUD_RUN_SERVICE`                 | `echomap-staging`                                                                    |
| `ARTIFACT_REGISTRY_REPOSITORY`      | `echomap`                                                                            |
| `PUBLIC_APP_ORIGIN`                 | `https://staging.childledapp.com`                                                    |
| `ALLOWED_APP_ORIGINS`               | `https://staging.childledapp.com`                                                    |
| `GCS_PRIVATE_BUCKET`                | `echomap-staging-private-crested-timer-507620-r1`                                    |
| `GCS_PRIVATE_OBJECT_PREFIX`         | `staging`                                                                            |
| `VITE_CLERK_PUBLISHABLE_KEY`        | `pk_test_...`                                                                        |
| `SECRET_DATABASE_URL`               | `echomap-staging-database-url`                                                       |
| `SECRET_DATABASE_MIGRATION_URL`     | `echomap-staging-database-direct-url`                                                |
| `SECRET_SESSION_SECRET`             | `echomap-staging-session-secret`                                                     |
| `SECRET_DATA_ENCRYPTION_KEY`        | `echomap-staging-data-encryption-key`                                                |
| `SECRET_CLERK_SECRET_KEY`           | `echomap-staging-clerk-secret-key`                                                   |
| `SECRET_OPENAI_BASE_URL`            | `echomap-staging-openai-base-url`                                                    |
| `SECRET_OPENAI_API_KEY`             | `echomap-staging-openai-api-key`                                                     |

For early public testing, use fake/synthetic data and keep
`ECHOMAP_ENABLE_DEMO_LOGIN=true` only in staging. Do not enable it for a real
production environment with live children or clinical data.

## Google Cloud Resources

Enable these APIs in the staging Google Cloud project:

- Cloud Run
- Artifact Registry
- Cloud Storage
- Secret Manager
- IAM Credentials

Create these service accounts:

- `github-deploy`: used by GitHub Actions through Workload Identity Federation.
- `echomap-runtime`: used by the running Cloud Run service.

Recommended IAM:

- `github-deploy`: `roles/run.admin`, `roles/artifactregistry.writer`, and
  `roles/iam.serviceAccountUser` on `echomap-runtime`.
- `echomap-runtime`: `roles/secretmanager.secretAccessor` on the listed
  secrets, `roles/storage.objectAdmin` on the private bucket, and permission to
  sign blobs for GCS signed upload URLs.

If using Cloud SQL later, also grant `echomap-runtime` `roles/cloudsql.client`
and add the Cloud SQL connection flag to the Cloud Run deploy flags.

## Secrets

Store secret values in Google Secret Manager using the names from the GitHub
variables above. Generate fresh values for:

```bash
openssl rand -base64 48 # SESSION_SECRET
openssl rand -base64 32 # ECHOMAP_DATA_ENCRYPTION_KEY
```

For the first staging database, the lowest-friction option is a managed
PostgreSQL database that GitHub Actions can reach over TLS. Use a pooled URL for
the running Cloud Run service and a direct URL for schema changes. Later
production can move to Cloud SQL private connectivity once the infrastructure
is managed more formally.

## Bucket CORS

Browser uploads use signed `PUT` URLs. Configure CORS on the private GCS bucket
for the staging origin:

```json
[
  {
    "origin": ["https://staging.childledapp.com"],
    "method": ["PUT"],
    "responseHeader": ["Content-Type"],
    "maxAgeSeconds": 3600
  }
]
```

Apply it with:

```bash
gcloud storage buckets update \
  gs://echomap-staging-private-crested-timer-507620-r1 \
  --cors-file=cors.json
```

## First Deploy

1. Push the repo to GitHub.
2. Confirm the `CI` workflow passes.
3. Run `DB Push Staging` to apply pending versioned migrations.
4. Run `Deploy Staging`, or push to `main`.
5. Open the Cloud Run URL printed by the workflow.
6. Map the custom domain in Cloud Run after the service is healthy.

The staging workflow sets Cloud Run to `--min-instances=0` and
`--max-instances=5`. That keeps idle cost low and lets usage grow during early
testing.

## Production Upgrade Path

Before real production data:

- move the database to a production-grade PostgreSQL plan,
- keep staging and production in separate projects or at least separate
  service accounts, databases, buckets, and Clerk instances,
- disable `ECHOMAP_ENABLE_DEMO_LOGIN`,
- add backups, monitoring, error tracking, audit review, and uptime alerts,
- review HIPAA/BAA requirements for every vendor before storing protected
  health information.
