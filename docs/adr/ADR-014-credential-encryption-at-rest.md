# ADR-014: Credential Encryption at Rest for `adapter_config`

**Status:** Accepted
**Date:** 2026-04-29
**Closes:** [#38](https://github.com/brownm09/lifting-logbook/issues/38)

---

## Context

[ADR-003](ADR-003-per-user-data-store-config.md) stores per-user adapter configuration in an
`adapter_config` JSONB column on the `user_data_source` table. For users on the Google Sheets
adapter, this column contains sensitive credentials — either a service account key (JSON) or
OAuth 2.0 refresh tokens. This data must be encrypted at rest.

ADR-003 names KMS-backed envelope encryption as the required approach but defers the design.
This ADR documents the encryption scheme, key hierarchy, rotation procedure, and the interaction
between key rotation and the in-memory cache maintained by `IRepositoryFactory`.

---

## Decision

Encrypt the `adapter_config` column using **Google Cloud KMS envelope encryption**.

The scope of encryption is the entire `adapter_config` value for all adapter types (Sheets and
Postgres). Encrypting unconditionally, regardless of whether the current adapter has credentials,
avoids conditional encryption logic in the factory and ensures future adapters with sensitive
config are automatically protected.

### Schema change

The original `adapter_config JSONB` column is replaced with three columns:

```sql
ALTER TABLE user_data_source
  DROP COLUMN adapter_config,
  ADD COLUMN config_ciphertext  BYTEA NOT NULL,
  ADD COLUMN config_dek_ciphertext BYTEA NOT NULL,
  ADD COLUMN config_nonce       BYTEA NOT NULL;
```

| Column | Purpose |
|---|---|
| `config_ciphertext` | The `adapter_config` JSON, encrypted with the row's DEK |
| `config_dek_ciphertext` | The DEK, encrypted by Cloud KMS using the project KEK |
| `config_nonce` | Random nonce (IV) for the symmetric cipher |

### Encryption algorithm

AES-256-GCM is used for data encryption. It provides authenticated encryption (AEAD), meaning
tampering with `config_ciphertext` is detected at decrypt time. The nonce is 12 bytes, generated
fresh for every write.

### Key hierarchy

```
Cloud KMS key ring: lifting-logbook (region: us-central1)
  └── Key: user-data-source-kek
        ├── Key version 1 (primary — encrypts new DEKs)
        └── Key version N (prior versions — kept for DEK decryption, not yet destroyed)

Per-row DEK: 32-byte random key, encrypted by user-data-source-kek
```

The Key Encryption Key (KEK) lives entirely in Cloud KMS and is never exported or held in
application memory. Only encrypted DEKs (ciphertext blobs) leave KMS. The Data Encryption
Keys (DEKs) exist in plaintext only transiently in application memory during a single
request.

### Encrypt/decrypt flow

**Write (`INSERT` or `UPDATE`):**
1. Generate a random 32-byte DEK and 12-byte nonce.
2. Encrypt the `adapter_config` JSON bytes using AES-256-GCM (DEK + nonce).
3. Call `projects/.../cryptoKeys/user-data-source-kek:encrypt` (Cloud KMS API) to encrypt
   the DEK, using the current primary key version.
4. Store `config_ciphertext`, `config_dek_ciphertext`, and `config_nonce`.
5. Discard the plaintext DEK from memory.

**Read:**
1. Fetch the row.
2. Call `projects/.../cryptoKeys/user-data-source-kek:decrypt` (Cloud KMS API) to recover
   the plaintext DEK. KMS uses the version embedded in the ciphertext automatically.
3. Decrypt `config_ciphertext` with AES-256-GCM (DEK + nonce). GCM authentication tag
   validates integrity.
4. Deserialize JSON → typed adapter config struct.
5. Discard the plaintext DEK from memory.

The factory caches the **decrypted** adapter config in memory (keyed by `user_id`, TTL ~5
minutes) so that repeat requests within the TTL window skip both the DB read and the KMS
decrypt call. See [Cache Interaction](#cache-interaction) below.

### IAM permissions

| Principal | Permission | Scope |
|---|---|---|
| API service account | `cloudkms.cryptoKeyVersions.useToDecrypt` | `user-data-source-kek` |
| API service account | `cloudkms.cryptoKeyVersions.useToEncrypt` | `user-data-source-kek` |
| Admin service account | `cloudkms.cryptoKeys.get` | `user-data-source-kek` |

No application principal holds `cloudkms.cryptoKeys.destroy` — key destruction is a manual
operations step (see Key Rotation below).

---

## Key Rotation

Cloud KMS supports automatic key rotation via a configurable rotation period. When a new
primary key version is created:

- **New writes** use the new primary version to encrypt DEKs.
- **Existing rows** remain encrypted with their original DEK and key version. KMS preserves
  all prior key versions in an enabled state until explicitly disabled/destroyed.
- **Reads** continue to work: the `decrypt` call includes the key version identifier embedded
  in `config_dek_ciphertext`, so KMS uses the correct version regardless of which version
  is currently primary.

### Re-encryption after rotation

For forward secrecy, rows written before a rotation should eventually be re-encrypted with a
DEK wrapped by the new primary key version. The procedure:

1. Query all rows from `user_data_source`.
2. For each row: decrypt DEK with old key version → generate new DEK → re-encrypt
   `adapter_config` → encrypt new DEK with current primary key version → `UPDATE` row.
3. Verify row count and spot-check a sample of decrypted configs.
4. Once all rows are re-encrypted, disable (do not immediately destroy) the old key version.
5. After a 30-day observation period with no decrypt calls to the old version (visible in
   Cloud KMS audit logs), destroy it.

This re-encryption job runs as a one-off migration script (`scripts/reencrypt-adapter-configs.ts`)
and is not required on every rotation — it is a post-rotation hardening step.

---

## Cache Interaction

`IRepositoryFactory` caches decrypted adapter configs in memory (TTL ~5 minutes, per
[ADR-003](ADR-003-per-user-data-store-config.md#cache-invalidation)).

The following properties hold:

**Key rotation does not invalidate cached plaintext.** Cached entries hold the already-decrypted
config. The KMS key version is only consulted during a DB read; a cached hit never calls KMS.
After key rotation, cached entries remain valid until TTL expiry. This is safe: the plaintext
was already authorized when it was fetched.

**Key version revocation has a bounded exposure window.** If a key version is compromised and
must be immediately disabled, cached plaintext derived from DEKs wrapped by that version will
remain in memory for up to the TTL (~5 minutes). To reduce this window:
- Use the admin cache invalidation endpoint (see
  [ADR-003 — Cache Invalidation](ADR-003-per-user-data-store-config.md#cache-invalidation)) to
  immediately evict all entries, forcing re-fetch after the version is disabled. New fetches
  will fail if the old version is disabled before re-encryption completes.
- As a result, emergency key revocation requires a coordinated sequence: disable key version →
  flush cache → complete re-encryption with new key version → validate.

**Factory never holds a plaintext DEK past a single request.** Plaintext DEKs are local
variables discarded at the end of the read path. Only the final typed config struct is cached.

---

## Rationale

**Why envelope encryption rather than Postgres column-level encryption?**
Postgres column-level encryption (e.g., `pgcrypto`) places the key management burden in the
database layer, complicates schema tooling (Prisma does not understand encrypted columns
natively), and does not provide the audit trail or IAM integration of Cloud KMS. Envelope
encryption keeps key management in a dedicated service with automatic versioning, audit logs,
and IAM-gated access.

**Why encrypt all adapter types, not just Sheets?**
Conditional encryption (encrypt only if `adapter_type = 'sheets'`) requires the factory to
branch on adapter type at every read and write. Any future adapter with credentials would
require a schema change and conditional update. Unconditional encryption is simpler and safer.

**Why per-row DEKs rather than a single application-level key?**
A single application key means all rows share a compromise surface. Per-row DEKs limit
the blast radius of any individual DEK exposure to one user row. The KMS cost difference
(one encrypt/decrypt call per request vs. one per application start) is acceptable given
the ~5-minute cache TTL reduces KMS calls to at most one per user per 5 minutes.

**Why AES-256-GCM?**
AEAD provides both confidentiality and integrity in one operation. GCM is hardware-accelerated
on modern CPUs. The 256-bit key size provides adequate security margin. This is the algorithm
used by the Google Tink library (the recommended implementation vehicle for envelope encryption
on GCP).

---

## Alternatives Considered

**Postgres `pgcrypto` (column-level):** Encrypt/decrypt happens inside Postgres using
`pgp_sym_encrypt` / `pgp_sym_decrypt`. Key management is manual; no native IAM integration.
Ruled out: Cloud KMS is already used for infrastructure secrets; consistent key management
is preferred.

**Whole-row encryption (application-level, single shared key):** Simpler — one key per
environment. No per-row DEK. Ruled out: single shared key means all rows share a compromise
surface; per-row DEKs are the standard envelope encryption pattern.

**Transparent Data Encryption (TDE) at the Cloud SQL level:** Cloud SQL for PostgreSQL supports
encryption at rest by default (at the disk level). This does not protect against a compromised
database principal that can read plaintext via SQL. Application-level envelope encryption is
additive to disk-level encryption. TDE alone does not satisfy the requirement.

---

## Consequences

- **Schema migration required.** The `adapter_config JSONB` column is replaced with three
  columns. All existing rows must be migrated. The migration script reads existing unencrypted
  data and writes the encrypted form in a single transaction per row.
- **KMS latency.** Each uncached factory lookup adds one Cloud KMS API round trip (~5–10 ms
  at GCP p50). The cache TTL absorbs this for repeat requests.
- **KMS cost.** Cloud KMS charges per cryptographic operation. At personal-use scale
  (single user, ~5-minute cache TTL), this is negligible (<$0.01/month).
- **Operational dependency.** If Cloud KMS is unavailable, the factory cannot decrypt
  `adapter_config` for cache-miss requests. Cached entries remain available for up to the
  TTL, providing a partial availability buffer. This is accepted for a non-production portfolio
  project.

---

## References

- [Google Cloud KMS — Envelope Encryption](https://cloud.google.com/kms/docs/envelope-encryption) — The definitive GCP guide to envelope encryption; documents the KEK/DEK hierarchy, encrypt/decrypt API calls, and the re-encryption pattern used in the key rotation procedure.
- [Google Cloud KMS — Key Rotation](https://cloud.google.com/kms/docs/key-rotation) — Documents automatic rotation scheduling, the behaviour of prior key versions after rotation (enabled until explicitly destroyed), and audit logging for version-level decrypt calls.
- [Google Tink — AES-GCM AEAD](https://developers.google.com/tink/aead) — The recommended implementation library for AEAD encryption on GCP; covers AES-256-GCM key generation, encrypt/decrypt API, and key rotation via keyset handles.
- [NIST SP 800-38D — AES-GCM Recommendation](https://csrc.nist.gov/publications/detail/sp/800-38d/final) — NIST's normative recommendation for GCM mode; documents the 12-byte nonce requirement and authentication tag validation.
- [ADR-003 — Per-User Data Store Configuration](ADR-003-per-user-data-store-config.md) — The parent ADR that introduced the `adapter_config` column and required KMS encryption at rest; ADR-003's cache TTL design is directly relevant to the Cache Interaction section above.
