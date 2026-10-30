# Spring Team Review Checklist
#
# This file is copied to .claude/reviews/ during install.
# Used by /review for team-specific quality gates.
#
# Format: Markdown table with Check, Severity, and What to Look For.
# ─────────────────────────────────────────────

| Check | Severity | What to Look For |
|-------|----------|------------------|
| Layering | High | Controllers hold no business logic and no `@Transactional`; repositories do no business logic |
| Package structure | Medium | Packages mirror the domain; no `util` / `helper` / `misc` buckets; feature packages self-contained |
| Dependency injection | High | Constructor injection everywhere; no field `@Autowired`; no repository injected into a controller |
| Entity leakage | High | No JPA entity type appears in a controller signature, response body, or request body |
| Validation | High | Every mutating endpoint validates its request body with `@Valid`; nested objects validated with `@Valid` on the field |
| Error model | High | One `@RestControllerAdvice` handles errors; no per-controller try/catch swallowing; no exception message or stack trace in the response |
| Transaction boundaries | Critical | `@Transactional` on service methods; `readOnly = true` on queries; no self-invocation of a transactional method |
| Schema ownership | Critical | Every entity change ships with a new migration in the same commit; no applied migration edited; production uses `ddl-auto: validate` |
| Query safety | Critical | No string-concatenated SQL; list endpoints paginated; no N+1 in a loop |
| Configuration | High | Settings bound via `@ConfigurationProperties`; no hardcoded secrets; no raw `@Value` for grouped properties |
| Secrets & PII | Critical | No credentials, tokens, or personal data in source, logs, or error messages |
| Logging | Medium | Parameterized SLF4J messages; correlation id propagated; no sensitive values logged at any level |
| API contract | High | Plural kebab-case paths; correct status codes (201 with body on create, 204 on delete); pagination parameters present on list endpoints |
| Testing | High | New behavior has both positive and negative cases; persistence and integration tests use Testcontainers with the real engine |
| Test integrity | Critical | No assertion weakened or deleted to make a build pass; no test silently skipped to avoid a failure |
| Build reproducibility | Medium | Uses the checked-in wrapper; no generated output or IDE files committed; dependency versions resolved through the BOM or `dependencyManagement` |
| Build & test run | High | The change's own tests and the full build pass on the current branch — record the command and the result |
