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
# current run.app topology is unchanged. The abuse surface stays latent until #804
# wires apps/web server spans to the prod collector — enable this stack before/with
# #804. Enable procedure: ADR-034 and docs/deploy.md ("Edge rate limit").

locals {
  edge_lb_enabled = var.enable_edge_load_balancer ? 1 : 0
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

  backend {
    group = google_compute_region_network_endpoint_group.web_serverless_neg[0].id
  }
}

resource "google_compute_url_map" "web" {
  count = local.edge_lb_enabled

  name            = "${local.name_prefix}-web-urlmap"
  default_service = google_compute_backend_service.web[0].id
}

# Google-managed SSL certificate. A managed cert cannot be issued for a *.run.app
# URL, so var.web_domain is required whenever the LB is enabled (enforced by the
# precondition — checked only when this resource is actually created).
resource "google_compute_managed_ssl_certificate" "web" {
  count = local.edge_lb_enabled

  name = "${local.name_prefix}-web-cert"

  managed {
    domains = [var.web_domain]
  }

  lifecycle {
    precondition {
      condition     = var.web_domain != ""
      error_message = "web_domain must be set (the app's public domain) when enable_edge_load_balancer = true — a Google-managed certificate cannot be issued for a *.run.app URL."
    }
  }
}

resource "google_compute_target_https_proxy" "web" {
  count = local.edge_lb_enabled

  name             = "${local.name_prefix}-web-https-proxy"
  url_map          = google_compute_url_map.web[0].id
  ssl_certificates = [google_compute_managed_ssl_certificate.web[0].id]
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
