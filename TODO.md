# TODO

## CI setup — phase 1 (done)

- `skills/ci-setup/` with DETECT → CONFIGURE → GENERATE → VALIDATE → REPORT
- GitHub Actions and Gitea Actions Maven templates
- Features: `test`, `coverage`, `coverage-gate`, `spotbugs`, `pmd`, `checkstyle`, `dependency-check`, `artifact`
- Optional Maven mirror settings (`.mvn/settings.xml`)
- Cache-path consistency between `settings.xml` and the workflow
- Config keys under `ci:` in `config/defaults.yml`
- Integrations: `new-project`, `ci-fix`, `start`
- Template validation in `tests/validate-workflows.js`
- Render + YAML/XML golden test in `tests/ci-templates.test.js`
- Dual-platform `ci-fix` (and PR flows in `review`, `git-flow`, `new-feature`, `release`)
  via `skills/_orchestration/references/platform-cli.md`
- Plugin's own CI: `.github/workflows/validate.yml`
- Verified on Gitea 1.27.3
  - `checkout@v7`, `cache@v6`, `setup-java@v6`, `upload-artifact@v7` all exist on gitea.com
  - `checkout` reads only its `token` input; `env: GITEA_TOKEN` is ignored.
    The built-in `${{ github.token }}` authenticates same-repository checkouts.
  - `cache`, `setup-java`, `upload-artifact` inputs used by the templates all exist
- Live end-to-end Gitea run (2026-11-01, run #146, `demo-claude-code-java-2`)
  - Checkout, JDK 25, Maven cache (`.m2/repository`), `verify`, Testcontainers MySQL,
    and Flyway all executed successfully
  - Job failed on a project-specific missing property
    `app.spring-boot-admin.role.user.name` — not a workflow defect
  - Temporary PR #9 closed, remote branch `test/ci-setup-gitea` deleted
  - Follow-up added: `ci-setup` now detects Failsafe/Testcontainers and supports `--skip-it`

## CI setup — phase 2 backlog

### Docker build and push

- [ ] GitHub: `docker/login-action@v3`, `docker/metadata-action@v5`,
      `docker/build-push-action@v6`; tags for branch, PR, semver, and SHA.
- [ ] Gitea: raw `docker build/push` plus `https://gitea.com/docker/metadata-action@v6`
      (mirrors the reference project), or a verified `build-push-action` URL.
- [ ] Handle registry mirrors (for example `docker.1ms.run`) without hard-coding them
      into every template — expose a `ci.docker.base_image_mirror` setting.
- [ ] Multi-stage Dockerfile template: Temurin 25 builder, minimal JRE runtime,
      non-root user, Actuator health check.
- [ ] Secrets inventory: `REGISTRY`, `REGISTRY_USERNAME`, `REGISTRY_PASSWORD`.

### SSH deploy

- [ ] GitHub: `appleboy/ssh-action@v1`.
- [ ] Gitea: `docker://appleboy/drone-ssh:1.8.2`.
- [ ] Deploy script: docker login, pull, stop/remove, run, health check.
- [ ] Secrets inventory: `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`, app secrets.
- [ ] Require explicit opt-in: never deploy from `pull_request`.

### JDK source variants

- [ ] `--jdk setup-java|container|mirror` (phase 1 uses `setup-java` only).
- [ ] Distribution matrix: temurin, zulu, redhat, microsoft.
- [ ] Air-gapped / China mirror mode: download from Tsinghua Adoptium and set
      `JAVA_HOME` / `PATH`.
- [ ] Container mode: `docker://maven:3.10.0-eclipse-temurin-25`; pair
      `<localRepository>.m2/repository</localRepository>` with cache `.m2/repository`
      (see `skills/ci-setup/references/platform-matrix.md`).

### Build systems

- [ ] Gradle: `gradle/actions/setup-gradle`, wrapper detection, dependency cache.
- [ ] Multi-module Maven: per-module artifacts and optional matrix builds.
- [ ] JDK / OS matrix (`ci.java_versions` already exists as a list).

### Pipeline composition

- [ ] Reusable workflow mode (`on: workflow_call`) with thin per-repo callers.
      Verify support per Gitea version before enabling.
- [ ] Optional security jobs: CodeQL (GitHub), dependency review, SBOM.
      (The OWASP dependency CVE scan is **done** — `ci-setup --features
      dependency-check` and the `verify` skill's SECURITY phase.)
- [ ] GitHub test-report UI (`dorny/test-reporter` or equivalent); Gitea stays
      artifact-only.

### Validation and maintenance

- [x] Parse generated YAML in validation (add a pinned YAML parser or run
      `actionlint` for GitHub output).
- [x] Detect unresolved placeholders after rendering.
- [ ] Renovate / Dependabot configuration for action versions.
- [ ] Pin third-party actions to commit SHAs (option, default off).
- [ ] Golden-file tests for the rendered output of each platform/feature combo.
      (Partially done — `tests/ci-templates.test.js` now covers every optional
      feature toggled alone and all features enabled at once.)

### Known issues to revisit

- [ ] `demo-harness` caches `.m2/repository` without a `settings.xml` that sets
      `<localRepository>` — the reference workflow's cache never restores.
      The generated templates avoid this; keep the check in `ci-setup` Phase 4.
- [ ] Gitea reusable workflows, `permissions:` enforcement, and artifact retention
      semantics vary by version — verify against the target instance.

---

## Verification loop — phase 1 (done)

- `skills/verify/` — seven phases: DETECT → BUILD → STATIC → TEST → SECURITY → DIFF → REPORT
- Coverage gate computed from the JaCoCo **report** (`target/site/jacoco/jacoco.xml`),
  not from `jacoco:check` — works on any project that has JaCoCo, with no
  `<rules>` block in the POM
- Static analysis: SpotBugs / PMD / Checkstyle, each reported separately; a
  missing plugin is `SKIPPED`, never `PASS`
- OWASP dependency CVE scan + credential scan; a timed-out scan is `ERROR`,
  never "clean"
- Structured output: `.workflows/verify/report.md` + `findings.json`
  (schema `spring-boot-workflows/verify-findings@1`), shared with the `review`
  skill's findings file
- Wired into the PR phase of `new-feature` and into `git-flow commit` / `git-flow pr`
  (guards scan) and `review`
- CI side: `ci-setup --features coverage,coverage-gate,spotbugs,pmd,checkstyle,dependency-check`
- Config: `verify:` block in `config/defaults.yml`; every key is asserted to be
  read by at least one skill (`tests/validate-workflows.js`)

### Fixes that shipped with it

- The proportional review gate had **three** different threshold sets
  (`rule-03`, `review`, `config/defaults.yml`). `workflows.review.size_thresholds`
  is now the single source of truth, and a test asserts the rule documents the
  shipped numbers.
- `guards` was never wired into any commit or push path — it was install-only.
  It now runs before `git commit`, before `git push`, and in the PR phase of
  `new-feature`.
- `guards.strict` was referenced by the skill but existed in no config file.
- Nine config keys were read by nothing (`guards.enabled`,
  `quality.proportional`, `quality.self_review`, `quality.focused_gate`,
  `workflows.review.checklist`, `workflows.review.size_thresholds`, …). All are
  read now, and a test keeps them alive.
- `guards.yml` mixed regexes and globs without saying so — the fork-bomb
  pattern was silently broken as a regex. The matching semantics are now
  documented and the pattern is fixed.
- `platform-matrix.md` said SpotBugs was "artifact-only on both"; the template
  actually runs a gating `spotbugs:check`.
- The PreToolUse quality-gate hook only matched `Bash(gh pr create*)` —
  `tea pr create` and the GitHub API path bypassed it.
- The migration scanner existed in two byte-identical copies. There is one now.
- `spring-context` said "the six `-boot3` skills"; there are eight.
- The `test` skill said "run coverage tool if available" without saying which
  command — the command is now specified, and an unmeasured result is reported
  as "not measured" rather than as 0%.

## Verification loop — phase 2 backlog

- [ ] Re-gate against an existing `findings.json` — the schema is shared, but
      nothing consumes it yet (no SARIF export, no baseline comparison).
- [ ] Gradle parity: the `verify` skill knows the Gradle task names, but the
      JaCoCo XML path (`build/reports/jacoco/test/jacocoTestReport.xml`) and the
      plugin-detection table are Maven-shaped.
- [ ] JDK matrix — `ci.java_versions` is still a list that phase 1 renders as a
      single entry (the skill now says so out loud).
- [ ] Cache the OWASP NVD database in CI so the CVE scan is not a 10-minute
      cold start on every run.
- [ ] Wire `/verify` into `hotfix` and `release`, not just `new-feature`.

## Domain knowledge coverage (breadth — not started)

The vendored trees cover a subset of the upstream reference package
(`rrezartprebreza/spring-boot-skills`, 34 topics per version tree):

- Boot 4: **19 of 34** topics vendored
- Boot 3: **8 of 34** topics vendored

Not vendored: `openapi-first`, `hexagonal-architecture`, `domain-driven-design`,
`event-driven-messaging`, `resilience-retry`, `production-observability`,
`multi-tenancy`, `http-interface-clients`, `container-native-deployment`,
`webflux-reactive-patterns`, `spring-batch`, `spring-ai-integration`,
`spring-cloud-gateway`, `hateoas`, `mcp-server`, `ai-observability`,
`agent-qa-browser-regression`.

- [ ] Decide the priority order before importing — a wider tree means a wider
      router table, and the router's value depends on the knowledge set staying
      small and auditable.
- [ ] `tests/validate-workflows.js` now validates the domain trees (frontmatter,
      name/directory match, description convention, router reachability), so
      new topics get a safety net that did not exist before.
