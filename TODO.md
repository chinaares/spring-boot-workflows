# TODO

## CI setup — phase 1 (done)

- `skills/ci-setup/` with DETECT → CONFIGURE → GENERATE → VALIDATE → REPORT
- GitHub Actions and Gitea Actions Maven templates
- Features: `test`, `coverage`, `spotbugs`, `artifact`
- Optional Maven mirror settings (`.mvn/settings.xml`)
- Cache-path consistency between `settings.xml` and the workflow
- Config keys under `ci:` in `config/defaults.yml`
- Integrations: `new-project`, `ci-fix`, `start`
- Template validation in `tests/validate-workflows.js`

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
- [ ] GitHub test-report UI (`dorny/test-reporter` or equivalent); Gitea stays
      artifact-only.

### Validation and maintenance

- [ ] Parse generated YAML in validation (add a pinned YAML parser or run
      `actionlint` for GitHub output).
- [ ] Detect unresolved placeholders after rendering.
- [ ] Renovate / Dependabot configuration for action versions.
- [ ] Pin third-party actions to commit SHAs (option, default off).
- [ ] Golden-file tests for the rendered output of each platform/feature combo.

### Known issues to revisit

- [ ] `demo-harness` caches `.m2/repository` without a `settings.xml` that sets
      `<localRepository>` — the reference workflow's cache never restores.
      The generated templates avoid this; keep the check in `ci-setup` Phase 4.
- [ ] Gitea reusable workflows, `permissions:` enforcement, and artifact retention
      semantics vary by version — verify against the target instance.
