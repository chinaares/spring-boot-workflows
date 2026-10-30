# Team Review Checklist
#
# This file is copied to .claude/reviews/ during install.
# Used by /review for team-specific quality gates.
#
# Format: Markdown table with Check, Severity, and What to Look For.
# ─────────────────────────────────────────────

| Check | Severity | What to Look For |
|-------|----------|------------------|
| Example: Architecture compliance | High | No layer violations (e.g., UI importing data layer directly) |
| Example: Error handling | High | All network/IO operations handle failures with user feedback |
| Example: Naming conventions | Medium | Files, classes, functions follow team naming standards |
| Example: Test coverage | Medium | New logic has corresponding unit tests |
