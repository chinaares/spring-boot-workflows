# Rule 3: Quality Gate — Rules & Reviews

**Before writing code** in any implementation phase:

1. Determine project type from `.workflows/config.yml` → `project.type`. Fall back to user plugin settings.
2. Read language rules from `<plugin-root>/rules/` based on project type:

   | project_type | Files to read from `<plugin-root>/rules/` |
   |---|---|
   | spring-boot | `java.md`, `spring-boot.md` |
   | java | `java.md` |
   | generic | (skip — no bundled rules; use `generic` conventions) |

3. If team is set, also read: `<plugin-root>/teams/<team>/rules/team-conventions.md`
4. Follow every DO/DON'T while implementing.
5. **Spring Boot projects only**: before the first implementation phase, load the
   domain knowledge for the layers the change touches. Read
   `<plugin-root>/skills/spring-context/SKILL.md` and follow its routing table —
   it maps changed file types to the vendored Spring Boot skills under
   `<plugin-root>/skills/spring-boot-4/`.

**Before creating a PR** (every workflow that ends with PR):

1. Run `git diff --name-only <base>..HEAD` to identify changed files.
2. **Proportional review** — scale the gate to the change size.

   Read these three values from `workflows.review.size_thresholds` in
   `.workflows/config.yml`, falling back to `<plugin-root>/config/defaults.yml`
   **per key**:

   | Value | Config path | Default |
   |---|---|---|
   | Light file limit | `workflows.review.size_thresholds.light.max_files` | `3` |
   | Light line limit | `workflows.review.size_thresholds.light.max_lines` | `50` |
   | Standard file limit | `workflows.review.size_thresholds.standard.max_files` | `15` |

   **This config block is the single source of truth** — do not hardcode
   thresholds here or in a skill.

   | Change Size | Gate Level |
   |---|---|
   | ≤ light file limit files **and** ≤ light line limit lines | **Light**: Security checks (Critical items only) from general checklist. Skip language-specific checklists. |
   | ≤ standard file limit files | **Standard**: General checklist (High + Critical items) + language-specific checklist (High + Critical). |
   | more than standard file limit files | **Full**: All checklists, all severity levels. |

   With the shipped defaults that is: ≤3 files and ≤50 lines → Light;
   4–15 files → Standard; >15 files → Full.

   **Legacy project configs** — a config generated before this block was
   reshaped has `size_thresholds: {small, medium, large}` and no `light` /
   `standard` keys. When the project block has no `light` or `standard` key,
   use the **plugin defaults for the whole block**, and tell the user their
   `.workflows/config.yml` predates the current shape (`/setup` regenerates it
   from the current defaults). Do not read `small`/`medium`/`large` as the gate
   level — those numbers are not the gate level.

   If `quality.proportional` is `false`, use the **Full** gate regardless of
   change size.

3. **Checklist selection** — read `workflows.review.checklist` from config:

   | Value | Behavior |
   |---|---|
   | `auto` (default) | General checklist + language-specific checklist (from `project.language`). If a team is set, also `<plugin-root>/teams/<team>/reviews/team-review-checklist.md`. |
   | `none` | No checklist files — use the fallback checks (architecture, code quality, security, performance, test coverage, consistency). |
   | `<path>` | Use only that checklist file. |

   No checklist found → use the same fallback checks as `none`.

4. Self-check changes against applicable items. For each Critical/High item, record an explicit verdict:
   - `PASS: <item> — <evidence>` (e.g., "no hardcoded secrets — grep for API key patterns returned 0 results")
   - `FAIL: <item> — <issue> — <fix>`
   - `N/A: <item> — <reason>`

   **Minimum evidence**: Every Critical item needs explicit evidence — grep results, test output, or code inspection finding. "Checked" or "no issues found" without specifics is unacceptable.

5. Fix any Critical/High violations before creating the PR. Report Medium/Low as notes in the PR body.

**If `quality.self_review` is `false`** — skip steps 4–5 and state plainly in
the PR body that the self-check was disabled by configuration. Never present a
skipped gate as a passed one.

**Executable verification** — the checklist gate above is a human/model
judgement, not an execution. When the project has a build, run the
verification loop before the PR: read `<plugin-root>/skills/verify/SKILL.md`
and execute it (Rule 9 — inline, no separate state file). Its report is the
evidence for the "build succeeds / tests pass / coverage" checklist items;
quote its numbers rather than asserting them.
