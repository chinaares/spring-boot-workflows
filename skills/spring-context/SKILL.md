---
name: spring-context
description: "Route a Spring Boot change to the vendored domain skills it needs — maps changed files to the right Spring Boot knowledge set (JPA, REST, security, migrations, testing) so implementations use project conventions instead of generic Spring knowledge."
rules: []
---

# Spring Context Router

**Purpose**: pick the minimum set of Spring Boot domain knowledge a change actually needs.
Loads nothing itself — it produces a routing decision the caller then executes (Rule 9).

**When to run**: before any implementation phase on a Spring Boot project, and before the
CHECK phase of `/review`. Skip entirely if `project.type` is not `spring-boot`.

---

## Step 1: Resolve the version tree

Read `project.spring.boot_major` from `.workflows/config.yml` (fall back to
`<plugin-root>/config/defaults.yml`, then user plugin settings).

| `boot_major` | Skill tree | Naming |
|---|---|---|
| `4` | `<plugin-root>/skills/spring-boot-4/` | `spring-data-jpa`, `rest-api-conventions`, … |
| `3` | `<plugin-root>/skills/spring-boot-3/` | `spring-data-jpa-boot3`, `rest-api-conventions-boot3`, … |

**If the value is absent, stop and ask the user.** Boot 3 and Boot 4 differ in package
locations and test annotations (`tools.jackson.*` vs `com.fasterxml.jackson.*`,
`@MockitoBean` vs `@MockBean`, `spring-boot-starter-webmvc` vs `spring-boot-starter-web`).
Loading the wrong set produces code that compiles against the wrong APIs — guessing is
worse than asking. See Rule 4 for how the version is detected.

Boot 3 projects get only the eight `-boot3` skills (`configuration-properties-boot3`,
`flyway-migrations-boot3`, `multi-module-maven-boot3`, `oauth2-resource-server-boot3`,
`rest-api-conventions-boot3`, `spring-data-jpa-boot3`, `spring-security-jwt-boot3`,
`testing-pyramid-boot3`); for topics outside that set, fall back to the Boot 4 skill and
read only the parts that are version-neutral.

## Step 2: Classify the changed files

Run `git diff --name-only <base>..HEAD` (or the file list from the current phase's plan).
Map each path to a layer. Match on **path shape first**, then on **content markers** —
the same layer often lives in different packages across projects.

| Changed path looks like | Layer |
|---|---|
| `**/entity/**`, `**/*Entity.java`, `**/domain/**`, `**/*Aggregate.java` | Persistence model |
| `**/repository/**`, `**/*Repository.java`, `**/dao/**` | Data access |
| `**/service/**`, `**/*Service.java`, `**/usecase/**`, `**/*UseCase.java` | Domain logic |
| `**/controller/**`, `**/*Controller.java`, `**/web/**`, `**/api/**` | HTTP boundary |
| `**/dto/**`, `**/*Request.java`, `**/*Response.java`, `**/*Dto.java` | HTTP contract |
| `**/exception/**`, `**/*ExceptionHandler.java`, `**/error/**` | Error model |
| `**/security/**`, `**/*SecurityConfig.java`, `**/*Jwt*.java`, `**/auth/**` | Security |
| `**/db/migration/**`, `**/*.sql` | Schema |
| `**/application*.yml`, `**/application*.properties` | Configuration |
| `**/src/test/**`, `**/*Test.java`, `**/*Tests.java`, `**/*IT.java` | Tests |
| `**/cache/**`, `**/*Redis*.java`, `**/*Cache*.java` | Caching |
| `pom.xml`, `build.gradle`, `build.gradle.kts`, `libs.versions.toml` | Build & dependencies |

## Step 3: Produce the routing decision

For each layer present in the change, emit the skills to load. **Load only what the change
touches** — do not load the full set.

| Layer | Load (Boot 4 name) | Read first inside the skill |
|---|---|---|
| Persistence model | `spring-data-jpa` | `references/relationships-advanced.md`, `references/cqrs-query-service-advanced.md` |
| Data access | `spring-data-jpa` | `references/query-patterns-advanced.md`, `references/custom-repositories-advanced.md`, `references/dto-projections-advanced.md` |
| Domain logic | `transactional-patterns`, `layered-architecture` | SKILL.md only |
| HTTP boundary | `rest-api-conventions`, `problem-details-rfc9457` | SKILL.md only |
| HTTP contract | `rest-api-conventions` | SKILL.md only |
| Error model | `problem-details-rfc9457` | SKILL.md only |
| Security — self-issued tokens | `spring-security-jwt` | SKILL.md only |
| Security — external IdP (Keycloak, Auth0, Cognito) | `oauth2-resource-server` | SKILL.md only |
| Schema | `flyway-migrations` | SKILL.md only |
| Configuration | `configuration-properties` | SKILL.md only |
| Tests | `testing-pyramid` | SKILL.md only |
| Caching | `spring-data-redis` | SKILL.md only |
| Build & dependencies | `spring-boot-migration` **only if** the change crosses a Boot major version; otherwise read `configuration-properties` | `references/spring-boot-4-migration.md` when crossing versions |
| API versioning | `api-versioning` — only when the change touches URL/header versioning | SKILL.md only |
| Idempotency | `idempotency-patterns` — only when the change adds or alters a write endpoint that may be retried | SKILL.md only |
| Nullability | `null-safety` — only when the change touches annotations or a `package-info.java` | SKILL.md only |
| Wide or structural change (new module, package restructure, multi-layer edit) | `spring-code-review` | `references/architecture-patterns.md`, `references/domain-modeling.md` |
| New project or new module | `spring-project-scaffolding` | `references/architecture-guide.md`, `references/spring-boot-4-features.md` |
| Multi-module build (`<modules>` in `pom.xml`, or `include(...)` in `settings.gradle`) | `multi-module-maven` — Maven only; for Gradle multi-module read `spring-project-scaffolding` | SKILL.md only |
| Modular monolith (`@ApplicationModule`, `spring-modulith` dependency present) | `spring-modulith` | SKILL.md only |

### Disambiguating the project-shape rows

Three rows above depend on a project-level fact rather than a changed file. Detect them
once from the build file and record the result — do not re-derive per change:

| Question | How to tell | Route |
|---|---|---|
| Who issues the tokens? | `spring-boot-starter-oauth2-resource-server` or `issuer-uri` / `jwk-set-uri` in config → **external IdP**. A `JwtEncoder`/`JwtDecoder` bean built locally from a signing key → **self-issued** | external → `oauth2-resource-server`; self-issued → `spring-security-jwt` |
| Single or multi-module? | `<modules>` in `pom.xml`, or `include(...)` in `settings.gradle(.kts)` | multi-module → `multi-module-maven` |
| Modular monolith? | `spring-modulith` dependency, or any `package-info.java` with `@ApplicationModule` | yes → `spring-modulith` |

If a project is both multi-module and a modular monolith, load both — they answer different
questions (build layout vs module boundaries).

### Cross-cutting additions

| Condition | Also load |
|---|---|
| The change touches persistence **and** HTTP | `spring-data-jpa` + `rest-api-conventions` — these two interact (entity shape leaks into DTO shape) |
| The change adds a write endpoint | `idempotency-patterns` |
| The change is a performance-sensitive path | `spring-data-jpa` → `references/performance-guide-advanced.md` |
| The change touches concurrency, caching, or virtual threads | `spring-code-review` → `references/performance-patterns.md` |
| The change touches auth, secrets, or input handling | `spring-code-review` → `references/security-checklist.md` |
| The project uses JSpecify nullability | `spring-code-review` → `references/jspecify-null-safety.md` |
| The change adds or moves a module boundary | `spring-modulith` + `spring-code-review` → `references/architecture-patterns.md` |
| The change adds a dependency to a module | `multi-module-maven` — verify it belongs in that module, not the parent |

## Step 4: Output format

Write the routing decision to the **current workflow's output directory** (Rule 9 — no
separate state file). Use this exact shape so the next phase can act on it:

```markdown
## Spring Context — <feature>

- Boot major: 4
- Changed layers: Persistence model, HTTP boundary, Tests

### Skills to load
1. `spring-data-jpa` → read `references/relationships-advanced.md`
2. `rest-api-conventions`
3. `testing-pyramid`

### Version notes
- Boot 4 uses `tools.jackson.*`; `spring.jackson.serialization.write-dates-as-timestamps` does not bind.

### Not loaded (and why)
- `flyway-migrations` — no SQL changes in this diff
```

Always include a **Not loaded (and why)** section. It is what keeps the knowledge set
minimal, and it makes the decision auditable.

## Step 5: Execute (Rule 9)

Read each selected skill's `SKILL.md` and its listed reference files, and execute their
guidance as sub-steps of the current phase. Do not create a separate state file, and do not
advance the phase — routing is a pre-step, the caller owns the phase transition.

## Failure modes

| Situation | Action |
|---|---|
| `boot_major` missing or ambiguous | Ask the user; do not guess |
| A changed file matches no layer | Check content markers (e.g. `@Entity`, `@RestController`) before giving up |
| The change touches every layer | Load the full set, and say so explicitly in the output |
| The project is not Spring Boot | Skip this skill entirely |
| A listed reference file does not exist | Report it and continue with the skill's `SKILL.md` — do not fabricate the reference |
