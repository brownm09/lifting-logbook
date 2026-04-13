# docs/proposals/

Lightweight feature proposal documents for Lifting Logbook.

## How proposals are created

Run `/propose <one-line idea>` from the repo root. The skill will:

1. Ask a few clarifying questions
2. Draft a proposal doc using the master template
3. Write the file here as `YYYY-MM-DD-<slug>.md`
4. Create the linked GitHub issue (with project, milestone, and epic assignment)
5. Add the item to `ROADMAP.md` under the chosen milestone
6. Open a PR

**Master template:** [`dev-env/claude/templates/proposal.md`](https://github.com/brownm09/dev-env/blob/main/claude/templates/proposal.md)

This directory holds output files only. The template lives in `dev-env`.

## Proposal lifecycle

| Status | Meaning |
|---|---|
| `draft` | Written; not yet reviewed or committed to |
| `accepted` | Approved; linked issue is active or scheduled |
| `shipped` | Implemented and merged |
| `declined` | Explicitly ruled out; file kept for reference |
