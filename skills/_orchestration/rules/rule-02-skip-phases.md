# Rule 2: Skipping Phases

Read `.workflows/config.yml` (if exists), falling back to `<plugin-root>/config/defaults.yml`:
- `require_brainstorm: false` OR `--skip-brainstorm` → skip BRAINSTORM
- `require_tests: false` → skip TEST
- `require_spec: false` → skip SPEC

**Precedence**: CLI flags override config. When skipping: mark `SKIPPED` in state, no output document, proceed to next phase.
