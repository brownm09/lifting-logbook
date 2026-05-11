# Proposal: Historical Lift Data Backfill via CSV Upload

**Status:** `draft`
**Date:** 2026-05-11
**Issue:** [#225](https://github.com/brownm09/lifting-logbook/issues/225)

---

## Problem

Intermediate lifters migrating from Google Sheets / Apps Script implementations arrive with months or years of historical lift records they want to carry over. Without a backfill path, the app's progression logic (RPT top-set targeting, 5/3/1 cycle planning) starts from zero on day one, breaking continuity with the program the lifter is mid-cycle on. This blocks the primary persona's adoption: the Consistent Intermediate Lifter will not switch tools if doing so erases their training history.

## Proposed Solution

Add a CSV upload path that ingests historical `LiftRecord` rows for a given program in a single transactional batch. A new `POST /programs/:program/lift-records/import` endpoint accepts a CSV file, parses it via the existing `parseLiftRecords()` utility, resolves lift abbreviations through `DEFAULT_SLOT_MAP`, and persists rows via the existing `appendLiftRecords()` repository method. A complementary file-upload component in `apps/web` calls the endpoint and surfaces validation errors. Validation is all-or-nothing: if any row fails parsing, lift resolution, or schema checks, the request returns the complete list of errors and writes nothing.

## Acceptance Criteria

- [ ] `POST /programs/:program/lift-records/import` accepts a `multipart/form-data` CSV upload and returns `201` with a count of records written and a list of skipped duplicate rows (by row number and natural key) on success.
- [ ] On any validation failure (unparseable row, unknown lift abbreviation, invalid date, non-numeric weight/reps), the endpoint returns `400` with a structured list of all errors including row numbers, and writes zero records to the database.
- [ ] The endpoint resolves lift abbreviations via `DEFAULT_SLOT_MAP` and rejects rows whose abbreviation is not mapped.
- [ ] Successful imports use `appendLiftRecords()` so duplicate rows (matching on natural key) are silently skipped via Prisma `skipDuplicates`.
- [ ] `apps/web` exposes a file-upload component on the program detail page that calls the import endpoint and renders the validation error list when the upload is rejected, and the skipped-duplicates list when the upload succeeds.
- [ ] Integration test covers a happy-path import of the ~900-row fixture already used by `parseLiftRecords()` tests.
- [ ] Integration test covers a rejected file with at least two distinct error types and asserts the database state is unchanged.

## Out of Scope

- Partial imports or per-row error tolerance — the all-or-nothing contract is intentional.
- Mapping UI for unknown lift abbreviations — unmapped abbreviations are an error, not a prompt.
- Automatic detection of program type (RPT vs 5/3/1) from CSV contents — the program is specified by the route parameter.
- Importing program definitions, training maxes, or cycle state — only `LiftRecord` rows are in scope.
- Export (the reverse direction) — separate proposal.
- Mobile client upload UI — `apps/mobile` is v0.3.

## Open Questions

- Should the endpoint enforce a maximum file size or row count, and if so what limits? (Suggested: 5 MB / 10,000 rows for v0.2.)

## References

- [Prisma `createMany` documentation](https://www.prisma.io/docs/orm/reference/prisma-client-reference#createmany) — semantics of `skipDuplicates` used by `appendLiftRecords()`.
- [RFC 7578 — Returning Values from Forms: `multipart/form-data`](https://www.rfc-editor.org/rfc/rfc7578) — wire format for the file upload.
- [`docs/proposals/2026-04-30-initial-training-max-discovery.md`](2026-04-30-initial-training-max-discovery.md) — prior proposal that explicitly deferred historical import to a separate proposal.
