# Rule 13: Focused Quality Gate

Specializes Rule 3's pre-PR gate by prioritizing checks based on changed file types:

1. `git diff --name-only <base>..HEAD` to identify changed files
2. Prioritize checklist items by category:
   - **Security** (auth, crypto, env) → Critical priority
   - **Data** (models, DB) → data integrity, injection
   - **UI** → XSS, accessibility, performance
   - **Test** → test quality only
3. **Always run**: architecture, naming, complexity. **Skip** categories with zero changed files.
