# Rule 4: Build/Test Command Detection

Before the first implementation phase, detect build system from marker files:

| Marker | System | Marker | System |
|--------|--------|--------|--------|
| `pom.xml` | Maven | `mvnw` / `mvnw.cmd` | Maven wrapper |
| `build.gradle(.kts)` | Gradle | `gradlew` / `gradlew.bat` | Gradle wrapper |
| `settings.gradle(.kts)` | Gradle multi-module | `gradle/libs.versions.toml` | Version catalog |

Store detected commands for use wherever `<build-command>` or `<test-command>` appear.

## Wrapper-first

**Always prefer the checked-in wrapper over a system-installed tool.** The wrapper pins the
build tool version and is what CI runs.

| System | Build command | Test command | Single test |
|--------|---------------|--------------|-------------|
| Maven | `./mvnw -q clean package -DskipTests` | `./mvnw -q test` | `./mvnw -q test -Dtest=ClassName` |
| Maven (no wrapper) | `mvn -q clean package -DskipTests` | `mvn -q test` | `mvn -q test -Dtest=ClassName` |
| Gradle | `./gradlew build -x test` | `./gradlew test` | `./gradlew test --tests "pkg.ClassName"` |
| Gradle (no wrapper) | `gradle build -x test` | `gradle test` | `gradle test --tests "pkg.ClassName"` |

If a `mvnw`/`gradlew` file exists but is not executable (`-rw-r--r--`), run it via
`sh ./mvnw …` — do not silently fall back to the system tool.

## Spring Boot version detection

For Spring Boot projects, determine the **major version** and record it as
`project.spring.boot_major` in `.workflows/config.yml`. This single value decides which
Spring Boot knowledge set applies everywhere else.

| Source | Where to look |
|--------|---------------|
| Maven | `pom.xml` → `<parent>` → `<artifactId>spring-boot-starter-parent</artifactId>` → `<version>` (or `spring-boot-dependencies` in `<dependencyManagement>`) |
| Gradle | `build.gradle(.kts)` → `id 'org.springframework.boot' version 'x.y.z'` / `id("org.springframework.boot") version "x.y.z"` |
| Fallback | `gradle/libs.versions.toml` → `[versions] springBoot = "x.y.z"` |

Map the detected version to a major: `3.5.x` → `3`, `4.1.x` → `4`. If the version cannot be
determined, **ask the user** — never guess, because Boot 3 and Boot 4 differ in package
locations (`javax` vs `jakarta` is Boot 2 vs 3; `tools.jackson.*` vs `com.fasterxml.jackson.*`
is Boot 4 vs 3; `@MockBean` vs `@MockitoBean` is Boot 3 vs 4) and loading the wrong set
produces code that compiles against the wrong APIs.

**Verification**: After detecting a build system, verify the command works by running it. If it fails, ask the user for the correct command. Never assume a build command — always detect from marker files or ask.
