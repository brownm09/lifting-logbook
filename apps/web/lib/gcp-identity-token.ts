import 'server-only';

// Fetches a GCP identity token from the metadata service for service-to-service auth.
// The staging API Cloud Run service requires Cloud Run IAM authentication — only the
// web workload service account has roles/run.invoker on the API service (see
// infra/terraform/cloud-run.tf: web_invoker_on_api). Unauthenticated requests to the
// API are rejected with 403 by Cloud Run infrastructure before reaching NestJS.
//
// Returns null outside GCP environments (local dev, CI without the metadata service).
// The audience must be the fully-qualified Cloud Run service URL.
export async function getGcpIdentityToken(audience: string): Promise<string | null> {
  const url = `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity?audience=${encodeURIComponent(audience)}`;
  try {
    const res = await fetch(url, {
      headers: { 'Metadata-Flavor': 'Google' },
      signal: AbortSignal.timeout(2000),
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}
