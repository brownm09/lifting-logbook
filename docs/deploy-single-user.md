# Single-User Production Deploy

This guide walks one person through standing up lifting-logbook on their own GCP
project for personal use. It is a slimmed-down counterpart to the canonical
[`docs/deploy.md`](deploy.md) — same building blocks (Terraform, Cloud Run, Cloud SQL,
GitHub Actions), but **GKE Autopilot is skipped** via the `enable_gke = false`
Terraform variable, removing the ~\$30/mo cluster cost and the entire Helm /
kubectl pipeline. Cloud Run also runs at `min_instance_count = 0` so the API and
web services scale to zero when idle.

> The default deploy in `docs/deploy.md` provisions both GKE and Cloud Run to
> satisfy the 90/10 A/B comparison in [ADR-009](adr/ADR-009-infrastructure.md).
> Single-user mode is an opt-out, not a replacement: the same Terraform module
> and the same workflow run, with the GKE-only resources gated off.

Target cost: **~\$15–30/mo** (Cloud SQL + small Cloud Run usage + Artifact
Registry). New GCP accounts get \$300 in free credit, which covers ~10 months.

---

## Step 0 — Get a GCP account and billing account (one-time, ~15 min)

If you have never used GCP:

1. Sign in to https://console.cloud.google.com with the Google account you want
   to own the project. Accept terms.
2. **Free credit:** new users get \$300 / 90 days. Google will not auto-charge
   when the credit runs out — you have to opt in to a paid account first.
3. **Create a billing account:**
   - https://console.cloud.google.com/billing → **Create account**
   - Enter a credit card (required even for the free credit; Google will not
     charge until you opt in to a paid account)
   - Pick **Individual** account type
4. **Find your billing account ID:**
   - https://console.cloud.google.com/billing → click the billing account →
     **Account management** — the ID is at the top, formatted
     `XXXXXX-XXXXXX-XXXXXX`
   - Or from CLI after installing `gcloud`: `gcloud billing accounts list`
5. **Install the `gcloud` CLI:**
   - Windows installer: https://cloud.google.com/sdk/docs/install#windows
   - macOS / Linux: see the same install page for your platform
6. **Authenticate (two separate logins are required):**
   ```bash
   gcloud auth login                       # for gcloud CLI itself
   gcloud auth application-default login   # for Terraform / SDKs
   ```
7. **Verify:**
   ```bash
   gcloud auth list                        # shows the logged-in account
   gcloud projects list                    # confirms API access
   ```

### Git Bash on Windows — gotchas

- The installer puts `gcloud` on the Windows `PATH`, but **Git Bash needs a
  restart** to pick it up. Close all Git Bash windows and reopen.
- Verify with `which gcloud`. If empty, add this to `~/.bashrc`:
  ```bash
  export PATH="$PATH:/c/Users/$USER/AppData/Local/Google/Cloud SDK/google-cloud-sdk/bin"
  ```
  then `source ~/.bashrc`.
- `gcloud` on Windows is `gcloud.cmd` under the hood. If a command parses its
  arguments oddly in Git Bash, prefix it with `winpty`:
  ```bash
  winpty gcloud auth login
  ```

### Cost guardrail

Set a budget alert before running the bootstrap:

- https://console.cloud.google.com/billing → **Budgets & alerts** → **Create
  budget** → threshold \$50/mo → alert at 50%, 90%, 100%. You'll get email
  before any surprise bill.

---

## Step 1 — Run the bootstrap script (~5 min)

[`scripts/bootstrap-gcp.sh`](../scripts/bootstrap-gcp.sh) creates the
project, links your billing account, enables the two APIs Terraform itself
needs, and creates the Terraform state bucket. Every step is idempotent — re-run
it if anything fails partway.

```bash
./scripts/bootstrap-gcp.sh XXXXXX-XXXXXX-XXXXXX
```

To use a different project ID or region:

```bash
./scripts/bootstrap-gcp.sh XXXXXX-XXXXXX-XXXXXX \
  --project-id my-lifting-prod \
  --region us-east1
```

The script's `--help` flag prints the full header documentation.

---

## Step 2 — Create and configure a Clerk production instance (~10 min)

[Clerk](https://clerk.com) handles authentication. The free tier covers a single user.

1. Sign up / log in at https://clerk.com and create an application named `lifting-logbook-production`.
2. Choose auth methods (email + password is simplest for a single user).
3. **Switch to Production mode:** click the **Development** badge at the top of the dashboard → **Switch to Production**.
4. **Set the application domain:** enter your domain (e.g. `liftinglogbook.com`). Clerk uses it to scope cookies, generate auth redirect URLs, and configure CORS.
5. **Add Clerk DNS records at your registrar:** Clerk shows five CNAME records to add. These are separate from the Cloud Run A/AAAA records. Once DNS propagates, click **Verify** (or **Check DNS**) in Clerk. The records are found under **Configure → DNS Records** in the sidebar if the overlay is dismissed.
6. **Copy your production API keys:** go to **API Keys** → copy:
   - Publishable key (`pk_live_…`)
   - Secret key (`sk_live_…`)
7. **Configure paths:** under **Settings → Paths**, set:

   | Path | Value |
   |---|---|
   | Home URL | `https://your-domain.com` |
   | Sign-in URL | `https://your-domain.com/sign-in` |
   | Sign-up URL | `https://your-domain.com/sign-up` |
   | After sign-in URL | `https://your-domain.com` |
   | After sign-up URL | `https://your-domain.com` |

You'll load the API keys into Secret Manager in Step 7.

---

## Step 3 — Configure Terraform for single-user mode

Open [`infra/terraform/terraform.tfvars.production`](../infra/terraform/terraform.tfvars.production)
and set, at minimum:

```hcl
project_id              = "lifting-logbook-prod"   # or whatever you passed to bootstrap
environment             = "production"
enable_gke              = false                    # skips the GKE Autopilot cluster
cloud_run_min_instances = 0                        # scale Cloud Run to zero when idle
# db_tier               = "db-f1-micro"            # optional: cheapest Cloud SQL tier
```

The `billing_account` variable is supplied on the command line (Step 5), not
written to a file — billing IDs are sensitive.

---

## Step 4 — Add GitHub Actions secrets

In the repo → **Settings → Secrets and variables → Actions**:

**Repository secrets** (not the **Environments** tab):

| Secret | Value |
|---|---|
| `TF_STATE_BUCKET` | `lifting-logbook-prod-tfstate` |
| `GCP_BILLING_ACCOUNT` | your billing account ID |
| `GCP_PROD_WORKLOAD_IDENTITY_PROVIDER` | filled in **after** Step 5 |
| `GCP_PROD_SERVICE_ACCOUNT` | filled in **after** Step 5 |

**Repository variables** (same page → **Variables** tab):

| Variable | Value |
|---|---|
| `GCP_PROD_PROJECT_ID` | `lifting-logbook-prod` |

> **Why a variable, not a secret?** GCP project IDs are not sensitive — they appear in
> Cloud Console URLs, API responses, and `gcloud` output. Storing them as secrets causes
> GitHub Actions to mask any workflow output that contains the value, which silently breaks
> job-to-job data passing (the `ar_repo` output used to resolve the Artifact Registry URL).

If you also intend to deploy a staging environment later, also add the
`GCP_STAGING_*` secrets per [`docs/deploy.md`](deploy.md#step-5--add-github-repository-secrets).

> **Hardening (optional, for later):** move `GCP_PROD_*` into a GitHub
> `production` environment so they're only readable from the production job
> (which is already gated behind the required-reviewer rule). Not required for
> a working single-user deploy. See
> [Using secrets in GitHub Actions — Creating secrets for an environment](https://docs.github.com/en/actions/security-guides/using-secrets-in-github-actions#creating-secrets-for-an-environment).

---

## Step 5 — First Terraform apply (local, not CI)

CI needs the Workload Identity outputs as secrets before it can authenticate,
so the very first apply runs from your laptop:

```bash
cd infra/terraform
terraform init -backend-config="bucket=lifting-logbook-prod-tfstate"
terraform workspace new production
terraform apply \
  -var-file=terraform.tfvars.production \
  -var="billing_account=XXXXXX-XXXXXX-XXXXXX"

# Capture the values for the two GitHub secrets above
terraform output workload_identity_provider
terraform output cicd_service_account_email
```

This creates: VPC, Cloud SQL, Artifact Registry, Secret Manager (empty
placeholder secrets), KMS keyring, IAM, and the Cloud Run service shells. With
`enable_gke = false`, the GKE cluster and its Workload Identity binding are
skipped; the `api_workload` service account itself is still created because
Cloud Run reuses it as the API service identity.

The CI/CD service account is created with `roles/owner` on the project plus
`roles/iam.serviceAccountTokenCreator` (for workload identity token issuance).
Owner is the pragmatic choice for a single-user production project: it covers
every `setIamPolicy` permission across Secret Manager, KMS, Storage, and
other resources where Editor + projectIamAdmin still fall short. For
multi-tenant environments, replace Owner with a narrower combination —
see the comments in `infra/terraform/main.tf` for the trade-off.

The state bucket also gets an explicit `storage.objectAdmin` binding so
that revoking Owner later (when narrowing for multi-tenant) does not
silently break CI access to Terraform state.

> **Recovery for pre-existing setups.** If you ran the first `terraform apply`
> before the cicd SA was granted Owner — i.e., you set up using an older
> version of this guide — CI cannot grant the missing permissions to
> itself (chicken-and-egg: terraform needs the perms to manage the perms).
> Run the recovery script once from your laptop as a project owner, then
> push to main:
>
> ```bash
> ./scripts/fix-cicd-sa-iam.sh
> ```
>
> It grants `roles/owner` on the project and `roles/storage.objectAdmin`
> on the tfstate bucket. Bindings are idempotent and will be taken over
> by Terraform on the next CI apply so they persist across re-applies.

---

## Step 6 — Map a custom domain (optional)

Skip this step if you're happy using the Cloud Run URL directly.

### 6a — Verify domain ownership

Google requires one-time domain ownership verification before a Cloud Run domain mapping will be accepted.

```bash
gcloud domains verify your-domain.com
```

This opens Google Search Console in your browser. Add the TXT record it shows at your registrar:

| Field | Value |
|---|---|
| Type | TXT |
| Name / Host | `@` |
| Value | the string Google provides |

> **Important:** the Name field must be exactly `@`. Other values (blank, the full domain name, etc.) fail silently.

Click **Verify** in Search Console once the record is live. DNS propagation can take a few minutes.

### 6b — Create the domain mappings

```bash
gcloud beta run domain-mappings create \
  --service lifting-logbook-prod-web \
  --domain your-domain.com \
  --region us-central1 \
  --project lifting-logbook-prod

gcloud beta run domain-mappings create \
  --service lifting-logbook-prod-web \
  --domain www.your-domain.com \
  --region us-central1 \
  --project lifting-logbook-prod
```

### 6c — Add DNS records

```bash
gcloud beta run domain-mappings describe \
  --domain your-domain.com \
  --region us-central1 \
  --project lifting-logbook-prod \
  --format="table(status.resourceRecords[].type, status.resourceRecords[].name, status.resourceRecords[].rrdata)"
```

At your registrar, add:
- Four `A` records pointing `@` to the IPs shown
- Four `AAAA` records pointing `@` to the IPv6 addresses shown
- One `CNAME` record pointing `www` to `ghs.googlehosted.com.`

Replace any existing `A`/`AAAA` records for the apex; keep existing `MX` and `TXT` records.

SSL is provisioned automatically once DNS propagates. Check status with:

```bash
gcloud beta run domain-mappings describe \
  --domain your-domain.com \
  --region us-central1 \
  --project lifting-logbook-prod \
  --format="value(status.conditions[0].reason)"
```

`CertificateProvisioned` means the cert is active. Provisioning typically completes within 15–60 minutes.

---

## Step 7 — Populate Clerk secrets

Terraform created empty secret containers with
`lifecycle.ignore_changes = [secret_data]`. Add the actual values now:

```bash
echo -n "sk_live_..." | gcloud secrets versions add \
  lifting-logbook-prod-clerk-secret-key --data-file=-

echo -n "pk_live_..." | gcloud secrets versions add \
  lifting-logbook-prod-clerk-publishable-key --data-file=-
```

---

## Step 8 — Apply database migrations (one-time)

The API container does **not** run `prisma migrate deploy` on startup. Run the migration script from the repo root:

```bash
./scripts/migrate-prod-db.sh
```

The script:
1. Downloads the Cloud SQL Auth Proxy automatically if not present
2. Temporarily enables a public IP on the Cloud SQL instance (required to connect from a local machine; removed when done)
3. Retrieves `DATABASE_URL` from Secret Manager
4. Applies all 14 Prisma migrations via `prisma migrate deploy`
5. Runs `infra/migrations/001_create_user_data_source.sql` (managed outside Prisma)
6. Removes the temporary public IP

**Prerequisites:** `gcloud` authenticated, `npm install` run from repo root.

> **Subsequent migrations** (adding new migrations to a live database): run the same script — `prisma migrate deploy` is idempotent and only applies pending migrations.

---

## Step 9 — Trigger the first deploy

Merge any branch to `main` (or push directly if you have the workflow set up
that way). The [Deploy workflow](../.github/workflows/deploy.yml):

1. Builds the api and web Docker images, pushes to Artifact Registry.
2. Runs `terraform apply` (idempotent — no-op since you just applied locally).
3. Runs `gcloud run deploy` for both services.
4. **Skips** all GKE / Helm / kubectl steps because `enable_gke=false`
   propagates from the Terraform output `gke_enabled` into a step-level
   `if:` condition.

The `production` GitHub environment has a required-reviewer protection rule
(set up in [`docs/deploy.md` Step 6](deploy.md#step-6--configure-github-environment-protection-rules)),
so the production job will pause until you approve it.

---

## Step 10 — Create your Clerk user, log in, verify

Self-serve signup is disabled by default — there is no public "Sign Up" flow. You
provision yourself directly through the Clerk dashboard:

1. Go to https://dashboard.clerk.com → your `lifting-logbook-production` app.
2. Sidebar → **Users** → **Create user**.
3. Enter your email and password. Clerk creates the account server-side.
4. Get the web URL:
   ```bash
   gcloud run services describe lifting-logbook-prod-web \
     --region=us-central1 --format='value(status.url)'
   ```
5. Open the URL, click **Sign In**, use the credentials from step 3.
6. Complete onboarding, generate a cycle, log a workout.

---

## Optional — Enable Google OAuth

If you prefer signing in with Google instead of email + password:

### 1. Configure OAuth consent screen (one-time)

1. https://console.cloud.google.com/apis/credentials/consent — choose your `lifting-logbook-prod` project.
2. User type: **External** (required even for a single user).
3. Fill in the required fields (app name, support email).
4. Under **Test users**, add your Google account. In Testing mode Clerk's
   callback domain is also on the allowlist automatically.
5. Save — no need to submit for Google verification for a single-user app.

### 2. Create an OAuth client ID

1. https://console.cloud.google.com/apis/credentials → **Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. Name it anything (e.g., `lifting-logbook-clerk`).
4. Under **Authorized redirect URIs**, paste the callback URL from Clerk:
   - Clerk dashboard → **Configure → Social connections → Google → Settings**.
   - The URI looks like `https://accounts.<your-clerk-frontend-api>.clerk.accounts.dev/v1/oauth_callback`.
5. Click **Create** — Google shows you the **Client ID** and **Client Secret**.

### 3. Add credentials to Clerk

1. Clerk dashboard → **Configure → Social connections → Google**.
2. Toggle Google on, paste the **Client ID** and **Client Secret**.
3. Save.

Users (including you) can now sign in with Google. You still need to provision the
account via **Users → Create user** first, or enable self-serve signup if you want
Google sign-in to create the account automatically.

---

## Flipping `enable_gke` on an existing environment

You can move between modes after the initial deploy, but **uninstall Helm
releases before disabling GKE** so any cluster-managed cloud resources (load
balancer IPs, attached disks, etc.) get torn down cleanly. Terraform will
destroy the cluster but does not know about the in-cluster Helm state.

**To go from GKE-enabled → Cloud-Run-only:**

```bash
# 1. Remove Helm releases first (run for each namespace you deployed to)
helm uninstall api -n production
helm uninstall web -n production

# 2. Set enable_gke = false in terraform.tfvars.production, then apply
cd infra/terraform
terraform apply \
  -var-file=terraform.tfvars.production \
  -var="billing_account=XXXXXX-XXXXXX-XXXXXX"
```

The apply will destroy `google_container_cluster.main[0]` and its Workload
Identity binding; the `api_workload` service account and its IAM roles stay
because Cloud Run still uses them.

**To go from Cloud-Run-only → GKE-enabled:**

```bash
# 1. Set enable_gke = true in terraform.tfvars.production
# 2. Apply
terraform apply -var-file=terraform.tfvars.production \
  -var="billing_account=XXXXXX-XXXXXX-XXXXXX"

# 3. Push to main; GitHub Actions will deploy via Helm on the next run.
```

No Helm cleanup needed in this direction — the cluster comes up empty and the
workflow deploys to it.

---

## What's intentionally not in this guide

These come from [`docs/deploy.md`](deploy.md). Skip them for single-user; add
them later if you ever invite a second person:

- A separate `lifting-logbook-staging` project and the full A/B `90/10` split.
- Self-serve signup / open registration.
- Rate limiting beyond what Cloud Run gives you by default.
- On-call runbook / alert routing.
