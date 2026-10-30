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
2. **Proportional review** — scale the gate to the change size:

   | Change Size | Gate Level |
   |---|---|
   | ≤3 files, ≤50 lines | **Light**: Security checks (Critical items only) from general checklist. Skip language-specific checklists. |
   | 4-15 files | **Standard**: General checklist (High + Critical items) + language-specific checklist (High + Critical). |
   | >15 files | **Full**: All checklists, all severity levels. |

3. If team is set, also read: `<plugin-root>/teams/<team>/reviews/team-review-checklist.md`
4. Self-check changes against applicable items. For each Critical/High item, record an explicit verdict:
   - `PASS: <item> — <evidence>` (e.g., "no hardcoded secrets — grep for API key patterns returned 0 results")
   - `FAIL: <item> — <issue> — <fix>`
   - `N/A: <item> — <reason>`

**Minimum evidence**: Every Critical item needs explicit evidence — grep results, test output, or code inspection finding. "Checked" or "no issues found" without specifics is unacceptable.

5. Fix any Critical/High violations before creating the PR. Report Medium/Low as notes in the PR body.
