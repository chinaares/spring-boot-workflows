# Maven Quality Plugins

Snippets for adding a check that the `/verify` skill detects. Versions below were
read from Maven Central — **re-check before pinning in a real build**, and keep
the version you pin in one place.

All snippets go in the **project's** `pom.xml` (or the parent POM of a
multi-module build). A plugin in a `<pluginManagement>` block is **declared** but
not **active** — the goal must also be bound, or the goal must be invoked
explicitly (`./mvnw -B spotbugs:check`).

---

## JaCoCo — coverage report (required by the coverage gate)

```xml
<plugin>
  <groupId>org.jacoco</groupId>
  <artifactId>jacoco-maven-plugin</artifactId>
  <version>0.8.16</version>
  <executions>
    <execution>
      <id>prepare-agent</id>
      <goals><goal>prepare-agent</goal></goals>
    </execution>
    <execution>
      <id>report</id>
      <phase>verify</phase>
      <goals><goal>report</goal></goals>
    </execution>
  </executions>
</plugin>
```

The `report` execution is what produces `target/site/jacoco/jacoco.xml`. The
`/verify` skill parses that file — **without the `report` goal there is nothing
to parse and coverage is `SKIPPED`.**

### Optional: let the build fail on low coverage

The `/verify` gate does **not** need this — it parses the report itself and
compares against `verify.coverage_threshold`. Add it only if you also want the
build itself to fail:

```xml
<execution>
  <id>check</id>
  <goals><goal>check</goal></goals>
  <configuration>
    <rules>
      <rule>
        <element>BUNDLE</element>
        <limits>
          <limit>
            <counter>LINE</counter>
            <value>COVEREDRATIO</value>
            <minimum>0.80</minimum>
          </limit>
        </limits>
      </rule>
    </rules>
  </configuration>
</execution>
```

Keep the number here in sync with `verify.coverage_threshold` — two different
thresholds in one project is a silent disagreement.

---

## SpotBugs — bytecode bug detection

```xml
<plugin>
  <groupId>com.github.spotbugs</groupId>
  <artifactId>spotbugs-maven-plugin</artifactId>
  <version>4.10.5.0</version>
  <configuration>
    <effort>Max</effort>
    <threshold>Medium</threshold>
    <failOnError>true</failOnError>
  </configuration>
  <executions>
    <execution>
      <id>spotbugs</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

Optional `spotbugs-exclude.xml` for accepted findings — every exclusion needs a
comment saying why, otherwise the next reader cannot judge it.

---

## PMD — source-level rules

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-pmd-plugin</artifactId>
  <version>3.28.0</version>
  <configuration>
    <rulesets>
      <ruleset>/rulesets/java/maven-pmd-plugin-default.xml</ruleset>
      <ruleset>/rulesets/java/spring.xml</ruleset>
    </rulesets>
    <printFailingErrors>true</printFailingErrors>
  </configuration>
  <executions>
    <execution>
      <id>pmd</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

PMD and Checkstyle overlap. Pick **one** as the primary style gate — running
both at the same strictness produces duplicate findings and noise, not safety.

---

## Checkstyle — style gate

```xml
<plugin>
  <groupId>org.apache.maven.plugins</groupId>
  <artifactId>maven-checkstyle-plugin</artifactId>
  <version>3.6.0</version>
  <configuration>
    <configLocation>google_checks.xml</configLocation>
    <includeTestSourceDirectory>false</includeTestSourceDirectory>
    <consoleOutput>true</consoleOutput>
    <failOnViolation>true</failOnViolation>
  </configuration>
  <executions>
    <execution>
      <id>checkstyle</id>
      <phase>verify</phase>
      <goals><goal>check</goal></goals>
    </execution>
  </executions>
</plugin>
```

`google_checks.xml` ships with the plugin. A project-specific file should live
in the repository (e.g. `config/checkstyle/checkstyle.xml`) so the rules are
reviewable.

---

## OWASP Dependency-Check — dependency CVE scan

```xml
<plugin>
  <groupId>org.owasp</groupId>
  <artifactId>dependency-check-maven</artifactId>
  <version>13.0.0</version>
  <configuration>
    <formats>
      <format>HTML</format>
      <format>JSON</format>
    </formats>
    <failBuildOnCVSS>7</failBuildOnCVSS>
    <suppressionFiles>
      <suppressionFile>config/dependency-check-suppressions.xml</suppressionFile>
    </suppressionFiles>
  </configuration>
</plugin>
```

**Operational notes — read before running it in CI:**

- The first run downloads the full NVD feed: **10+ minutes** and a large
  download. Subsequent runs are much faster with the local database cached.
- Without an NVD API key, the analyzer is rate-limited and often fails with a
  database-update error. Provide `NVD_API_KEY` as a CI secret. Never commit it.
- The local database lives in `~/.m2/repository/org/owasp/dependency-check-data`.
  Cache that path in CI or every run starts cold.
- `failBuildOnCVSS` is the gate — `7` is High and above. Lower it only with a
  reason.
- Every suppression needs an expiry date and a reason. A suppression without
  both is a silent hole.

---

## Gradle equivalents

| Check | Gradle task |
|---|---|
| Coverage report | `./gradlew jacocoTestReport` → `build/reports/jacoco/test/jacocoTestReport.xml` |
| Coverage gate | `./gradlew jacocoTestCoverageVerification` (needs `violationRules` in the `jacoco` block) |
| SpotBugs | `./gradlew spotbugsMain` |
| PMD | `./gradlew pmdMain` |
| Checkstyle | `./gradlew checkstyleMain` |
| OWASP | `./gradlew dependencyCheckAnalyze` |

Gradle's JaCoCo XML lives at
`build/reports/jacoco/test/jacocoTestReport.xml` — the same
report-level-counter rule applies.
