# ─── Edge rate limiting for POST /api/client-errors (Cloud Armor) — #808 ──────
#
# apps/web's POST /api/client-errors is public/unauthenticated by necessity (the
# failure it reports may itself be an auth expiry, so Clerk must not gate it) and
# records ONE retained ERROR span per accepted request — the ADR-020 `errors`
# tail-sampling policy always keeps it. The #806 same-origin guard
# (apps/web/app/api/client-errors/route.ts) drops cross-origin *browser* beacons
# but cannot stop a scripted `curl` loop, which sends no truthful `Origin`. The
# robust fix for scripted volume is this infra-level rate limit — mitigation (3)
# in the ADR-020 #806 addendum. See ADR-034.
#
# Cloud Armor throttle / rate_based_ban only attaches to a backend service behind
# an external Application Load Balancer; Cloud Run's *.run.app URL (and a Cloud Run
# domain mapping) cannot carry a Cloud Armor policy. So this file provisions a full
# global external HTTPS ALB in front of the web Cloud Run service and attaches a
# Cloud Armor backend security policy whose rate-limit rule is scoped to the
# /api/client-errors path; all other paths fall through to the default allow rule.
#
# LATENT BY DEFAULT. Every resource here is gated on var.enable_edge_load_balancer
# (default false), so `terraform plan` is a no-op on the committed tfvars and the
# current run.app topology is unchanged. NOTE: #804 (PR #814, merged 2026-07-11) has
# landed, so apps/web already exports to the prod collector and the abuse surface is
# LIVE — the stack ships inert only because enabling needs a domain + DNS cutover.
# Enablement is tracked in #826 (prerequisite code: #830). The LB fronts the apex
# (var.web_domain) plus any aliases (var.web_domain_aliases, e.g. www) on ONE managed
# cert, provisioned via Certificate Manager DNS AUTHORIZATION so it reaches ACTIVE while
# the apex/www still serve via their existing Cloud Run domain mappings — enabling a
# zero-downtime DNS cutover of the already-live domain. Enabling is TWO phases: (1)
# var.enable_edge_load_balancer creates the LB + cert (run.app + the domain mappings keep
# serving); then, after the cert is ACTIVE, DNS is cut over to the LB IP, and the domain
# mappings are DELETED, (2) var.lock_web_ingress_to_lb locks web ingress to the LB. See the
# ADR-034 (amendment) / docs/deploy.md ("Edge rate limit") enable procedure.

locals {
  edge_lb_enabled = var.enable_edge_load_balancer ? 1 : 0

  # Every domain the LB serves and the managed cert covers: the apex (var.web_domain)
  # plus any aliases (var.web_domain_aliases, e.g. www). Empty when the LB is disabled,
  # so the per-domain DNS-authorization resources below create nothing. compact() drops
  # any empty string (the cert precondition only guards var.web_domain, not an empty entry
  # slipping into var.web_domain_aliases) so no invalid empty-domain auth/SAN is attempted.
  web_lb_domains = var.enable_edge_load_balancer ? compact(concat([var.web_domain], var.web_domain_aliases)) : []
}

# Serverless NEG → the web Cloud Run service. A regional resource, attached to the
# global backend service below.
resource "google_compute_region_network_endpoint_group" "web_serverless_neg" {
  count = local.edge_lb_enabled

  name                  = "${local.name_prefix}-web-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.web.name
  }
}

# Cloud Armor backend security policy — the #808 deliverable. A per-source-IP
# throttle scoped to /api/client-errors; every other path hits the default allow.
resource "google_compute_security_policy" "web" {
  count = local.edge_lb_enabled

  name        = "${local.name_prefix}-web-armor"
  type        = "CLOUD_ARMOR"
  description = "Rate limits the unauthenticated POST /api/client-errors telemetry sink (#808 / ADR-034)."

  # Path-scoped per-IP throttle. `throttle` (not rate_based_ban) so a legitimate
  # bursty IP — a single failing page emits several best-effort beacons — recovers
  # the instant it drops back under the threshold rather than serving a ban penalty.
  # Excess requests get 429 at the edge, BEFORE Cloud Run, so they never create a
  # retained ERROR span — which is the whole point of the rule.
  #
  # Cloud Armor matches request.path as received (no canonicalization), so this scope
  # relies on the origin (Next.js) serving the client-errors handler ONLY at the
  # canonical path: a non-canonical variant Cloud Armor wouldn't match (e.g.
  # //api/client-errors) also wouldn't reach the handler to create a span. Query
  # strings are excluded from request.path, so `?x=1` still matches the `==` arm.
  rule {
    priority    = 1000
    action      = "throttle"
    description = "Per-IP throttle on /api/client-errors (generous; default 120 req / 60s / IP)."

    match {
      expr {
        expression = "request.path == '/api/client-errors' || request.path.startsWith('/api/client-errors/')"
      }
    }

    rate_limit_options {
      enforce_on_key = "IP"
      conform_action = "allow"
      exceed_action  = "deny(429)"

      rate_limit_threshold {
        count        = var.client_error_rate_limit_count
        interval_sec = 60
      }
    }
  }

  # Required default rule — allow everything else (this policy fronts the whole app,
  # since enabling the LB routes ALL public traffic through it, not just the sink).
  rule {
    priority    = 2147483647
    action      = "allow"
    description = "Default allow."

    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
  }
}

# Backend service wrapping the serverless NEG, with the Cloud Armor policy attached.
# Serverless NEG backends use no health check.
resource "google_compute_backend_service" "web" {
  count = local.edge_lb_enabled

  name                  = "${local.name_prefix}-web-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTPS"
  security_policy       = google_compute_security_policy.web[0].id

  # External ALB request logging is OFF by default; enable it so the Cloud Armor
  # throttle verdict on /api/client-errors is actually visible in Cloud Logging —
  # the signal the ADR-034 / docs/deploy.md verification steps rely on. sample_rate=1.0
  # logs every request (a low-QPS telemetry endpoint, so the volume is negligible;
  # tune down if this LB ever fronts high-traffic paths).
  log_config {
    enable      = true
    sample_rate = 1.0
  }

  backend {
    group = google_compute_region_network_endpoint_group.web_serverless_neg[0].id
  }
}

resource "google_compute_url_map" "web" {
  count = local.edge_lb_enabled

  name            = "${local.name_prefix}-web-urlmap"
  default_service = google_compute_backend_service.web[0].id
}

# Managed SSL certificate via Certificate Manager with DNS AUTHORIZATION (not a classic
# google_compute_managed_ssl_certificate). DNS authorization validates each domain with a
# per-domain _acme-challenge CNAME that is independent of the domain's serving A record, so
# the cert reaches ACTIVE while the apex/www still serve via their existing Cloud Run domain
# mappings. That lets the operator flip DNS to the LB IP with a valid cert already in place —
# a zero-downtime cutover of the already-live domain (a classic managed cert would dark-window
# HTTPS between the DNS flip and provisioning). One cert covers the apex (var.web_domain) plus
# any aliases (var.web_domain_aliases, e.g. www). See ADR-034 (amendment) / docs/deploy.md.
#
# One DNS authorization per domain. for_each over the (possibly empty) domain set gates these
# on enablement without a count/for_each mismatch: disabled ⇒ empty set ⇒ nothing created.
resource "google_certificate_manager_dns_authorization" "web" {
  for_each = toset(local.web_lb_domains)

  name        = "${local.name_prefix}-web-dnsauth-${replace(each.value, ".", "-")}"
  domain      = each.value
  description = "DNS authorization for ${each.value} (edge LB zero-downtime managed cert; #808 / ADR-034)."
}

resource "google_certificate_manager_certificate" "web" {
  count = local.edge_lb_enabled

  name        = "${local.name_prefix}-web-cert"
  description = "Edge LB managed cert covering the apex + aliases via DNS authorization (#808 / ADR-034)."

  managed {
    domains            = local.web_lb_domains
    dns_authorizations = [for d in local.web_lb_domains : google_certificate_manager_dns_authorization.web[d].id]
  }

  lifecycle {
    precondition {
      condition     = var.web_domain != ""
      error_message = "web_domain must be set (the app's public apex domain) when enable_edge_load_balancer = true — a Google-managed certificate cannot be issued for a *.run.app URL."
    }
  }
}

# Certificate map + a single PRIMARY entry so the target HTTPS proxy can serve the cert above
# (a Certificate Manager cert is attached to a proxy through a map, not directly). The cert
# carries the apex and every alias as SANs, so one PRIMARY (default-SNI) entry serves them all;
# no per-hostname entries are needed.
resource "google_certificate_manager_certificate_map" "web" {
  count = local.edge_lb_enabled

  name = "${local.name_prefix}-web-certmap"
}

resource "google_certificate_manager_certificate_map_entry" "web" {
  count = local.edge_lb_enabled

  name         = "${local.name_prefix}-web-certmap-primary"
  map          = google_certificate_manager_certificate_map.web[0].name
  certificates = [google_certificate_manager_certificate.web[0].id]
  matcher      = "PRIMARY"
}

resource "google_compute_target_https_proxy" "web" {
  count = local.edge_lb_enabled

  name    = "${local.name_prefix}-web-https-proxy"
  url_map = google_compute_url_map.web[0].id

  # Certificate Manager cert map (not classic ssl_certificates) — required to serve a
  # DNS-authorization-provisioned cert. Format: //certificatemanager.googleapis.com/<map id>.
  certificate_map = "//certificatemanager.googleapis.com/${google_certificate_manager_certificate_map.web[0].id}"
}

resource "google_compute_global_address" "web_lb" {
  count = local.edge_lb_enabled

  name = "${local.name_prefix}-web-lb-ip"
}

resource "google_compute_global_forwarding_rule" "web_https" {
  count = local.edge_lb_enabled

  name                  = "${local.name_prefix}-web-https-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "443"
  target                = google_compute_target_https_proxy.web[0].id
  ip_address            = google_compute_global_address.web_lb[0].id
}

# ── HTTP → HTTPS redirect (shares the LB IP; :80 → 301 → :443) ────────────────
resource "google_compute_url_map" "web_https_redirect" {
  count = local.edge_lb_enabled

  name = "${local.name_prefix}-web-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "web_redirect" {
  count = local.edge_lb_enabled

  name    = "${local.name_prefix}-web-http-proxy"
  url_map = google_compute_url_map.web_https_redirect[0].id
}

resource "google_compute_global_forwarding_rule" "web_http" {
  count = local.edge_lb_enabled

  name                  = "${local.name_prefix}-web-http-fr"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  port_range            = "80"
  target                = google_compute_target_http_proxy.web_redirect[0].id
  ip_address            = google_compute_global_address.web_lb[0].id
}
