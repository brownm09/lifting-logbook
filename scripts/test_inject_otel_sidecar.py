#!/usr/bin/env python3
"""Tests for scripts/inject-otel-sidecar.py (#786).

The injector rewrites the LIVE production Cloud Run api manifest at deploy time
(`gcloud run services describe --format=export` | inject | `gcloud run services replace`) —
a path that cannot be dry-run tested. These tests are the only automated gate on it: a
regression that mis-identifies the ingress container, drops a Terraform-managed field, or
re-runs non-idempotently would otherwise ship a broken production manifest unnoticed.

Design: stdlib ``unittest`` (no new dependency — PyYAML is already required by the injector
itself) and the script is run as a *subprocess* so the real CLI contract is exercised end to
end — stdout manifest, stderr guard messages, and exit codes, exactly as deploy.yml invokes
it (``python3 scripts/inject-otel-sidecar.py <path>`` with env vars).

Run locally:  ``python scripts/test_inject_otel_sidecar.py -v``   (needs ``pip install pyyaml``)
CI:           ``.github/workflows/ci.yml`` -> ``lint-and-test`` job.
"""
import os
import subprocess
import sys
import tempfile
import unittest

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(HERE, "inject-otel-sidecar.py")
FIXTURE = os.path.join(HERE, "testdata", "cloud-run-api-export.yaml")

# Every env var the injector reads (required + optional). Stripped from the inherited
# environment before each run so a value set in the caller's shell cannot mask a test that
# deliberately omits one (e.g. the missing-required-var guard below).
INJECTOR_VARS = (
    "API_IMAGE", "OTEL_CONFIG_SECRET", "OTEL_OTLP_ENDPOINT", "OTEL_LOKI_ENDPOINT",
    "OTEL_OTLP_SECRET", "OTEL_LOKI_SECRET", "COLLECTOR_IMAGE", "COLLECTOR_CPU",
    "COLLECTOR_MEMORY", "OTEL_TAIL_SAMPLE_RATE", "OTEL_DECISION_WAIT",
)

API_IMAGE = "us-central1-docker.pkg.dev/example-project/lifting-logbook/api:newsha1234567"

# The six required env vars, with representative (synthetic) values.
REQUIRED_ENV = {
    "API_IMAGE": API_IMAGE,
    "OTEL_CONFIG_SECRET": "lifting-logbook-prod-otel-collector-config",
    "OTEL_OTLP_ENDPOINT": "https://otlp-gateway.example.grafana.net/otlp",
    "OTEL_LOKI_ENDPOINT": "https://logs.example.grafana.net/otlp",
    "OTEL_OTLP_SECRET": "lifting-logbook-prod-otel-otlp-auth-header",
    "OTEL_LOKI_SECRET": "lifting-logbook-prod-otel-loki-auth-header",
}


def clean_env(**overrides):
    """The inherited environment minus every injector var, plus ``overrides``."""
    env = {k: v for k, v in os.environ.items() if k not in INJECTOR_VARS}
    env.update(overrides)
    return env


def run_injector(manifest_path=None, stdin_text=None, env=None):
    """Run the injector as a subprocess; return the CompletedProcess (text mode).

    ``manifest_path`` is passed as the argv path argument; when None the manifest is fed on
    stdin via ``stdin_text`` (the injector's other input mode). ``env`` defaults to a clean
    environment with all six required vars set.
    """
    if env is None:
        env = clean_env(**REQUIRED_ENV)
    args = [sys.executable, SCRIPT]
    if manifest_path is not None:
        args.append(manifest_path)
    return subprocess.run(
        args, input=stdin_text, env=env, capture_output=True, text=True,
    )


def containers_by_name(doc):
    return {c["name"]: c for c in doc["spec"]["template"]["spec"]["containers"]}


class InjectSuccessTest(unittest.TestCase):
    """A single-container export becomes a valid two-container manifest."""

    @classmethod
    def setUpClass(cls):
        proc = run_injector(FIXTURE)
        if proc.returncode != 0:
            raise AssertionError(f"injector exited {proc.returncode}: {proc.stderr}")
        cls.proc = proc
        cls.doc = yaml.safe_load(proc.stdout)
        cls.containers = containers_by_name(cls.doc)

    def test_exit_zero(self):
        self.assertEqual(self.proc.returncode, 0, self.proc.stderr)

    def test_two_containers_api_then_collector(self):
        names = [c["name"] for c in self.doc["spec"]["template"]["spec"]["containers"]]
        self.assertEqual(names, ["api", "otel-collector"])

    def test_api_image_replaced(self):
        self.assertEqual(self.containers["api"]["image"], API_IMAGE)

    def test_system_database_url_dropped(self):
        env_names = [e["name"] for e in self.containers["api"]["env"]]
        self.assertNotIn("SYSTEM_DATABASE_URL", env_names)

    def test_otel_endpoint_set_once_on_api(self):
        otel = [e for e in self.containers["api"]["env"]
                if e["name"] == "OTEL_EXPORTER_OTLP_ENDPOINT"]
        self.assertEqual(
            len(otel), 1,
            "OTEL_EXPORTER_OTLP_ENDPOINT must appear exactly once — the stale fixture value "
            "should be replaced, not duplicated",
        )
        self.assertEqual(otel[0]["value"], "http://localhost:4318")

    def test_ports_only_on_api_container(self):
        # Ingress-detection correctness: exactly the api container carries `ports`.
        self.assertIn("ports", self.containers["api"])
        self.assertNotIn("ports", self.containers["otel-collector"])

    def test_terraform_managed_base_config_preserved(self):
        # The injector must pass Terraform-owned base config through verbatim; dropping any of
        # it is one of the named regression classes in #786.
        spec = self.doc["spec"]["template"]["spec"]
        self.assertEqual(spec["containerConcurrency"], 80)
        self.assertTrue(spec["serviceAccountName"].startswith("lifting-logbook-prod-api-wi@"))
        tmpl_ann = self.doc["spec"]["template"]["metadata"]["annotations"]
        self.assertIn("run.googleapis.com/vpc-access-connector", tmpl_ann)
        api_env = {e["name"] for e in self.containers["api"]["env"]}
        self.assertIn("DATABASE_URL", api_env)   # unrelated secret env untouched
        self.assertIn("CLERK_SECRET_KEY", api_env)
        self.assertIn("NODE_ENV", api_env)

    def test_collector_and_config_volume_wired(self):
        col = self.containers["otel-collector"]
        col_env = {e["name"]: e for e in col["env"]}
        self.assertEqual(col_env["OTEL_COLLECTOR_OTLP_ENDPOINT"]["value"],
                         REQUIRED_ENV["OTEL_OTLP_ENDPOINT"])
        self.assertEqual(col_env["OTEL_COLLECTOR_LOKI_ENDPOINT"]["value"],
                         REQUIRED_ENV["OTEL_LOKI_ENDPOINT"])
        self.assertEqual(col_env["OTEL_COLLECTOR_OTLP_AUTH_HEADER"]["valueFrom"]["secretKeyRef"]["name"],
                         REQUIRED_ENV["OTEL_OTLP_SECRET"])
        vol_names = [v["name"] for v in self.doc["spec"]["template"]["spec"]["volumes"]]
        self.assertIn("otelconfig", vol_names)               # config-secret volume added
        self.assertIn("existing-unrelated-volume", vol_names)  # pre-existing volume preserved
        self.assertIn("otelconfig", [m["name"] for m in col["volumeMounts"]])

    def test_server_assigned_fields_stripped(self):
        ann = self.doc["metadata"].get("annotations", {})
        self.assertNotIn("run.googleapis.com/urls", ann)
        self.assertNotIn("run.googleapis.com/ingress-status", ann)
        self.assertIn("run.googleapis.com/ingress", ann)   # real ingress config preserved
        tmpl_meta = self.doc["spec"]["template"]["metadata"]
        self.assertNotIn("name", tmpl_meta)   # cleared so Cloud Run assigns a fresh revision name
        self.assertNotIn("client.knative.dev/nonce", tmpl_meta.get("labels", {}))


class IdempotencyTest(unittest.TestCase):
    """Re-running on an already-injected two-container manifest reproduces it exactly."""

    def test_running_twice_equals_once(self):
        first = run_injector(FIXTURE)
        self.assertEqual(first.returncode, 0, first.stderr)
        with tempfile.TemporaryDirectory() as d:
            once_path = os.path.join(d, "once.yaml")
            with open(once_path, "w", encoding="utf-8") as f:
                f.write(first.stdout)
            second = run_injector(once_path)
        self.assertEqual(second.returncode, 0, second.stderr)
        # Compare parsed structures — robust to any incidental serialization differences.
        self.assertEqual(yaml.safe_load(first.stdout), yaml.safe_load(second.stdout))
        # And no stacked second collector: still exactly api + one otel-collector.
        names = [c["name"]
                 for c in yaml.safe_load(second.stdout)["spec"]["template"]["spec"]["containers"]]
        self.assertEqual(names, ["api", "otel-collector"])


class GuardTest(unittest.TestCase):
    """On malformed input or missing config the script must fail loudly, not emit a manifest."""

    def test_missing_spec_template_spec_exits_nonzero(self):
        proc = run_injector(stdin_text="metadata:\n  name: not-a-cloud-run-service\n")
        self.assertNotEqual(proc.returncode, 0)
        self.assertEqual(proc.stdout, "", "no manifest should be emitted on the error path")
        self.assertIn("spec.template.spec", proc.stderr)

    def test_no_ingress_ports_container_exits_nonzero(self):
        manifest = yaml.safe_dump({
            "spec": {"template": {"spec": {"containers": [
                {"name": "api", "image": "x", "env": []},  # no `ports` block anywhere
            ]}}},
        })
        proc = run_injector(stdin_text=manifest)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("ports", proc.stderr)

    def test_missing_required_env_var_exits_nonzero(self):
        env = clean_env(**{k: v for k, v in REQUIRED_ENV.items() if k != "API_IMAGE"})
        proc = run_injector(FIXTURE, env=env)
        self.assertNotEqual(proc.returncode, 0)
        self.assertIn("API_IMAGE", proc.stderr)


if __name__ == "__main__":
    unittest.main()
