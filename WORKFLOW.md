# Dynamic Readme Workflow

This workflow is designed to dynamically update my README file with various statistics and information, including GitHub stats, age calculation, my typing speed and resume details.

It now runs on **GitHub Actions**. It used to run on a self-hosted **n8n** instance, which is no longer active. The original n8n workflow is documented below for reference.

## Current: GitHub Actions

- [`.github/workflows/update-readme.yml`](.github/workflows/update-readme.yml): schedule, runs the script, commits the result
- [`scripts/update-svg.mjs`](scripts/update-svg.mjs): fetches the data and rewrites `dark_mode.svg` (Node, no dependencies)

### How it works

- Scheduled to trigger every midnight IST (`30 18 * * *` UTC), or manually from the Actions tab ("Run workflow")
- Checkout the repo, set up Node 22, run the script
  - Github Stats
    - Fetches all my public repositories
    - Repos = total, Contributed = forks, Issues = sum of open issues, Stars = sum of stars
  - Get monkeytype stats
    - Public profile API (`divy03`), no key needed
    - Takes my highest personal best across all modes
  - Calculate my age
    - From my birthdate, using today's date in `Asia/Kolkata` (the runner is on UTC)
  - Extract information from my Resume
    - Reads the `Languages:` line from `resume.tex` in [divy-03/Resume](https://github.com/divy-03/Resume)
- Replace each value in the SVG by finding its label (`Uptime`, `Speed`, `Programming`, `Repos`, `Contributed`, `Issues`, `Stars`)
- Finally, commit `Updated Readme` and push, only if the SVG changed

### When something fails

- If a data source is down (e.g. Monkeytype), its value stays as it was, the rest still update and get pushed, and the run is marked failed so GitHub emails me
- If a label is missing from the SVG, the script stops without writing anything

### Run it locally

```sh
node scripts/update-svg.mjs            # updates dark_mode.svg
node scripts/update-svg.mjs other.svg  # or any other SVG with the same labels
```

Usernames, birthdate, timezone and the resume URL live in `CONFIG` at the top of the script. `GITHUB_TOKEN` is optional locally; Actions provides it automatically.

## Before: n8n (retired)

- Scheduled to trigger every midnight
  - Github Stats
    - Fetches all my repositories stats
    - Count forks, watchers, issues
  - Get existing SVG file
    - decode base64 to UTF-8 text
  - Get monkeytype stats
  - Cacluate my age
  - Extract information from my Resume
- Merge all the information
- Return the updated SVG code
- Finally, update the SVG on Github

<img width="1179" height="725" alt="image" src="https://github.com/user-attachments/assets/1e99a3fb-c7db-48c2-ac4e-648534dfba6c" />

## What changed

| | Before (n8n) | Now (GitHub Actions) |
|---|---|---|
| Runs on | Self-hosted n8n server | GitHub-hosted runner, nothing to host |
| Schedule | Daily, commits landed at 03:00 IST | Daily at 00:00 IST (GitHub may start it a few minutes late), plus a manual "Run workflow" button |
| Logic | 14 nodes: GitHub, Edit Fields, Date & Time, HTTP Request, Extract from File, Merge, 3 Code nodes | One script, `scripts/update-svg.mjs` |
| Reading/writing the SVG | "Get a file" + base64 decode, then "Edit a file" through the GitHub API | Checks out the repo, edits the file on disk, `git commit` + `git push` |
| Credentials | GitHub token stored in n8n | Built-in `GITHUB_TOKEN`, no secrets to add |
| Resume source | `MyResume.pdf` via "Extract From PDF" (last uploaded Dec 2025, so it went stale) | `resume.tex`, which the Resume repo's own Action keeps current |
| Age | Two Date & Time nodes | Calendar maths in the script, in IST; matches every value n8n produced |
| Failures | By default, a failing node stopped the whole run, so nothing updated | Failed sources keep their old values, the rest update, and the run is marked failed |
| Commit | `Updated Readme`, authored as me | Same message and author, so it still counts on my contribution graph |

Switching the resume source to `resume.tex` dropped `C` from `Languages.Programming`, because it was removed from the resume in January 2026 but the old PDF still had it.
