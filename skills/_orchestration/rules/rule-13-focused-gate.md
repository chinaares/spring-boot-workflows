# Rule 13: Focused Quality Gate

Specializes Rule 3's pre-PR gate by prioritizing checks based on changed file types.

**Applies only when `quality.focused_gate` is `true`** in `.workflows/config.yml`
(falling back to `<plugin-root>/config/defaults.yml`). When it is `false`, run
Rule 3's gate without the prioritization below — every applicable checklist item
is weighted equally.

1. `git diff --name-only <base>..HEAD` to identify changed files
2. Prioritize checklist items by category:
   - **Security** (auth, crypto, env) → Critical priority
   - **Data** (models, DB) → data integrity, injection
   - **UI** → XSS, accessibility, performance
   - **Test** → test quality only
3. **Always run**: architecture, naming, complexity. **Skip** categories with zero changed files.

Skipping a category means skipping its *low-severity* items. Critical and High
items in a category with zero changed files are recorded as `N/A: <item> — no
files in this category changed` — never silently dropped.
