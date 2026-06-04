# Agent guide — Hawkynt.github.io

Working agreement for **all** coding agents (Claude Code, Codex, Copilot, …)
and human contributors working in this repository. These rules are not
optional. The full house spec lives in the `Hawkynt/project-template` repo
(`STANDARD.md`); this file is the per-repo distillation.

## What this is

The **»SynthelicZ« website**, served directly by GitHub Pages from `main` —
no build step. A collection of self-contained sub-projects (Cipher, AskEngine,
Drums player, GrabList, BitBench, …) plus the History archive (1995-2006).
**Pushing to `main` IS deploying** — treat every push as a production deploy.

## Compatibility is a feature

The site intentionally runs on everything from **Lynx and IE5 to current
browsers**: progressive enhancement, CSS Grid with table fallbacks, graceful
degradation. Don't "modernize away" legacy support — keep new code
ES5-compatible where the surrounding sub-project is, and never break
text-browser accessibility.

## Commits

- **Group changes semantically/logically** — one sub-project/concern per
  commit; never one big "did stuff" commit.
- **Every subject line starts with a prefix**:
  - `+` added feature/behavior
  - `-` removed feature/behavior
  - `*` changed behavior / public API
  - `#` bug fixed
  - `!` critical todo / open issue worth recording
- Never start a subject with "fix"/"bugfix"/"changed"/"modified" — the prefix
  already says it.
- **No AI traces anywhere**: no `Co-Authored-By` AI lines, no "Generated with"
  footers, no agent mentions in messages, comments, or authorship.

## The loop (always, in this order)

1. **Before committing**: syntax-check touched scripts —
   `node --check <file>` per touched `.js` (CI runs it over all of them) —
   and open the affected page locally in a browser. Update the README's
   project list when sub-projects are added/removed; keep `sitemap.xml`
   current for new pages.
2. **Commit** (rules above) and **push** — remember: this deploys.
3. **Wait for CI** and fix until green. A pushed change isn't done while the
   workflow it triggered is red.

## README & repo conventions

- Keep the standard frame: title → badges → one-line `>` blockquote; standard
  sections use the fixed emoji mapping (`## ✨ Featured Projects`,
  `## ❤️ Support`, `## 📜 License`); repo-specific sections keep consistent
  topical emojis.
- License is LGPL-3.0-or-later; the `## ❤️ Support` section and
  `.github/FUNDING.yml` stay intact.
