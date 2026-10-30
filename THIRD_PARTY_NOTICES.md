# Third-Party Notices

`spring-boot-workflows` is derived from **claude-workflows** (MIT, © ragaa07) and bundles
third-party Spring Boot knowledge. The licenses below govern that content.

---

## Bundled content

### rrezartprebreza/spring-boot-skills — MIT License

> Copyright (c) 2026 Rrezart Prebreza
> https://github.com/rrezartprebreza/spring-boot-skills

Vendored under `skills/spring-boot-4/` and `skills/spring-boot-3/`:
`spring-data-jpa`, `rest-api-conventions`, `flyway-migrations`, `testing-pyramid`,
`spring-security-jwt`, `layered-architecture`, `problem-details-rfc9457`,
`transactional-patterns`, `configuration-properties`, `api-versioning`,
`idempotency-patterns`, `null-safety`, `spring-data-redis`, `oauth2-resource-server`,
`multi-module-maven`, `spring-modulith`.

Local modifications: skill `name` fields renamed where they collided with other bundled
skills. The Boot 3 set is a curated subset (8 of 33 topics) covering only the topics whose
Boot 3 and Boot 4 content differs substantively, renamed with a `-boot3` suffix.
`spring-modulith` ships Boot 4 only — its Boot 3 and Boot 4 versions differ by 4 lines
after normalizing version strings.

### springboot-skills-marketplace — MIT License

> Copyright (c) 2026 Pavithra
> https://github.com/a-pavithraa/springboot-skills-marketplace

Vendored under `skills/spring-boot-4/`:
`spring-code-review` (from `code-reviewer`), `spring-project-scaffolding` (from
`creating-springboot-projects`), `spring-boot-migration` (from `springboot-migration`),
plus the `references/` and `assets/` trees of `spring-data-jpa`.

Also vendored: `scripts/scan_migration_issues.py` (858 lines) — an unmodified copy of the
Boot 4 / Modulith 2 / Testcontainers 2 migration scanner.

Local modifications: skill `name` fields renamed as listed above.

### sivalabs-agent-skills — MIT License

> Copyright (c) 2026 K Siva Prasad Reddy
> https://github.com/sivaprasadreddy/sivalabs-agent-skills

Source material for `rules/java.md`, `reviews/java-checklist.md`,
`teams/spring/rules/team-conventions.md`, and `teams/spring/reviews/team-review-checklist.md`
— specifically the visibility matrix, naming-convention table, and review methodology
(verify-first, no speculation, confidence levels). These files are **rewritten**, not copied
verbatim, to match this plugin's DO/DON'T and checklist table conventions.

---

## Declared runtime dependency (not bundled)

### piomin/claude-ai-spring-boot — Apache License 2.0

> Copyright 2023 Piotr Mińkowski
> https://github.com/piomin/claude-ai-spring-boot

Declared in `.claude-plugin/plugin.json` as `dependencies: ["spring-boot-template@piomin"]`.
Installed by Claude Code, not redistributed here. Referenced at runtime by the
`spring-context` router and available to users as `/spring-boot-template:<skill>` and
`@agent-spring-boot-template:<agent>`.

---

## Upstream project

### claude-workflows — MIT License

> Copyright (c) ragaa07
> https://github.com/ragaa07/claude-workflows

The orchestration engine — 23 workflow skills, 18 orchestration rules, `PROTOCOL.md`,
`hooks/hooks.json`, `templates/`, `config/`, and `tests/` — is inherited from
`claude-workflows` v3.2.1. Local modifications:

- Renamed the plugin and marketplace to `spring-boot-workflows`
- Replaced `/claude-workflows:` command namespace with `/spring-boot-workflows:`
- Removed the non-Java language rules, review checklists, and team packs
  (`rules/{compose,go,kotlin,python,react,swift,typescript}.md`,
  `reviews/{compose,go,kotlin,python,react,swift,typescript}-checklist.md`,
  `teams/{android,ios,frontend,backend}/`)
- Added Spring-specific project-type mapping (Rule 3), Maven/Gradle wrapper-first build
  detection and Spring Boot major-version detection (Rule 4), and the `project.spring.*`
  config block
- Added `rules/java.md`, `rules/spring-boot.md`, `reviews/java-checklist.md`,
  `reviews/spring-boot-checklist.md`, `teams/spring/`, and `skills/spring-context/`
- Quoted `${CLAUDE_PLUGIN_ROOT}` in `hooks/hooks.json`
- Extended `tests/validate-workflows.js` with the Spring mapping and rule assertions
