# Project workflow

This folder is the canonical source repository for Web Sampler (web-sampler).

## Required version history

- During the current hardware-calibration work, keep changes local and batch commits at the user's request. This replaces the earlier per-modification commit preference.
- A request to commit/push one checkpoint authorizes that checkpoint; it does not authorize automatic pushes for later changes.
- Inspect `git status` before editing. Preserve unrelated user changes.
- After implementing a change, run appropriate checks and inspect the diff.
- Update affected tests and documentation when behavior changes.
- When a checkpoint is requested, commit its reviewed files with a concise message describing the outcome.
- Do not claim checks passed if they failed or were not run. Report material limitations.
- Include the commit hash and a brief validation summary in the final response.
- Do not silently amend, squash, reset or rewrite existing commits.
- Commit/push requested checkpoints to the existing repository. Remote repository creation and other deployments require user instructions.

## Releases

- Keep `index.html` and runtime assets in sync when preparing a release.
- Never include local recordings, credentials, backups or test output in a release.
- Preserve icon updates, multilingual documents and third-party license notices.
- Do not modify existing sample storage keys or erase user data without explicit instructions.


## Layout

- Web-first entry: `index.html`. Keep `creation.html` as the optional host compatibility loader.
- Runtime sources stay at root; drawings in `assets/`, protocol in `src/codec/` and `decoder/`.
- Documentation in `docs/`, tests in `tests/`, optional host metadata in `compat/rabbit-r1/`.
- Build with `node scripts/build.mjs`; do not generate dated application snapshots.
