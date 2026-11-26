# Project workflow

This folder is the canonical source repository for Web Sampler (web-sampler).

## Required version history

- The user requires a Git commit after every completed logical modification.
- Inspect `git status` before editing. Preserve unrelated user changes.
- After implementing a change, run appropriate checks and inspect the diff.
- Update affected tests and documentation when behavior changes.
- Commit the files for that change with a concise message describing the outcome.
- Do not claim checks passed if they failed or were not run. Report material limitations.
- Include the commit hash and a brief validation summary in the final response.
- Do not silently amend, squash, reset or rewrite existing commits.
- Local commits are authorized. Pushes, remote repository creation and deployment require user instructions.

## Releases

- Keep `index.html` and runtime assets in sync when preparing a release.
- Never include local recordings, credentials, backups or test output in a release.
- Preserve icon updates, multilingual documents and third-party license notices.
- Do not modify existing sample storage keys or erase user data without explicit instructions.

The earliest historical commit was reconstructed from the saved pre-LCD app.js backup;
its other files represent the repository initialization state, not a complete historical snapshot.
