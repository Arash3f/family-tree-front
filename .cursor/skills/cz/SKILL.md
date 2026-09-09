---
name: cz
description: >-
  Draft a Commitizen (cz) commit message from staged git changes using this
  repo's .cz.toml / .cz-config.js. Use when the user says cz, asks for a commit
  message, commitizen, or conventional commit text for the frontend.
---

# cz — Commit message from staged changes

## Hard rules

- **Output a commit message only.** Do **not** run `git commit` unless the user explicitly asked to commit in this turn.
- Work only inside **this** git repo (frontend). Do not mix backend changes.
- Follow **this repo's** `.cz.toml` / `.cz-config.js` exactly (prefixes, scopes, template). Do not invent types/scopes that are not in those files.

## Workflow

1. Confirm repo root is this frontend project (directory that contains `.cz.toml` / `.cz-config.js` and `.git`).
2. Read `.cz.toml` (or `.cz-config.js`) and load:
   - allowed `prefix` / `types` values (use the `value` field, e.g. `:sparkles: feat`)
   - allowed `scope` values (or empty for no scope)
   - `message_template` (from `.cz.toml`)
3. Inspect **staged** changes only:

```powershell
git status
git diff --cached --stat
git diff --cached
```

4. If nothing is staged, say so and stop. Do not invent a message from unstaged files unless the user asks to include them.
5. Pick the best matching `prefix` and optional `scope` from `.cz.toml` based on the staged diff.
6. Write a short imperative `message` (what/why in one line). Add `description` / `issue_number` only when useful or requested.
7. Render the final text with the template from `.cz.toml`:

```text
{{prefix}}{% if scope %}({{scope}}){% endif %}: {{message}}
{% if description %}{{description}}{% endif %}
{% if issue_number %}Closes #{{issue_number}}{% endif %}
```

## Output format

Reply with:

1. One-line summary of what the staged change does
2. The final commit message in a fenced code block (ready to paste)
3. Brief rationale: why that prefix/scope

## Examples (shape only)

```text
:sparkles: feat(pedigree): add branch folding controls
```

```text
:wrench: fix(i18n): show localized permission labels
```

```text
:hammer: ref(auth): simplify login form validation
```
