# Spring Boot Code Review Checklist

Spring Boot specific checks — dependency injection, API contract, persistence, transactions, migrations, security, and upgrade risk. Language-agnostic checks live in `general-checklist.md`; plain Java checks live in `java-checklist.md`.

**Severity scale**: Critical = blocks merge, causes data loss, a security hole, or a startup/build failure. High = correctness risk, clear Spring convention violation, or performance trap. Medium = maintainability/consistency improvement. Low = style preference.

Version differences are called out as `(Boot 4)` or `(Boot 3)`. Confirm the project's actual Boot version from the build file before applying a version-specific rule, and check whether the surrounding code already handles a finding before reporting it.

| Check | Severity | What to Look For |
|-------|----------|------------------|
| **Dependency Injection** | | |
| Constructor injection only | High | A dependency is declared with `@Autowired` on a field. Dependencies are `final` constructor parameters. |
| Controller reaches the repository directly | High | A `@RestController` injects a `@Repository` instead of a `@Service` — the service layer is bypassed. |
| Circular bean dependencies | High | Two beans depend on each other through constructors — the context fails to start, or the cycle is silently resolved with a proxy and one bean receives a not-fully-initialised reference. |
| **Controllers & API Contract** | | |
| Entities returned from controllers | High | A response body type is a JPA entity — the API contract exposes persistence internals and lazy associations. Responses are mapped to DTO records. |
| Request validation at the boundary | High | A `@RequestBody` lacks `@Valid`, or the request DTO carries no Bean Validation constraints. `@PathVariable` and `@RequestParam` inputs are validated too. |
| Status codes match the operation | High | POST-create does not return 201, DELETE returns a body instead of 204, validation failure does not return 400, a missing resource does not return 404, or a duplicate does not return 409. |
| Page size is capped | High | `spring.data.web.pageable.max-page-size` is unset — a bare `Pageable` parameter accepts `?size=100000` and can pull an entire table into memory. |
| **Error Handling** | | |
| RFC 9457 Problem Details in use | Medium | `spring.mvc.problemdetails.enabled` is on and errors are returned as `application/problem+json` (Boot 4 WebFlux: `spring.webflux.problemdetails.enabled`). The `status` field in the body matches the HTTP status. |
| Internal detail not leaked | Critical | A catch-all handler returns `ex.getMessage()`, a stack trace, or a raw persistence message to the client. The full exception is logged server-side and a generic detail is returned. |
| Filter-level failures not handled by advice | High | Filter-chain authentication or authorization failures are expected to be caught by `@RestControllerAdvice` — they need an `AuthenticationEntryPoint` and an `AccessDeniedHandler` instead. |
| **Persistence & JPA** | | |
| `jakarta.persistence` imports | Critical | A `javax.persistence.*` import remains — it does not compile on Boot 3 or Boot 4, which both use `jakarta.persistence.*`. |
| Lazy fetch on to-one relationships | High | A `@ManyToOne` or `@OneToOne` mapping omits `fetch = FetchType.LAZY` — to-one mappings default to EAGER. |
| Enum persisted as STRING | High | `@Enumerated(EnumType.ORDINAL)` is used — reordering the enum silently corrupts stored data. `EnumType.STRING` with an explicit column length is used. |
| Optimistic locking on editable aggregates | High | A user-editable entity has no `@Version` field, or uses a primitive `long` version — lost updates go undetected. The version is a nullable wrapper `Long`. |
| Safe entity `equals` and `hashCode` | High | `equals`, `hashCode`, or `toString` includes collections, mutable fields, or associations — this triggers lazy loads, recursion, and changing hash codes. |
| N+1 access patterns | High | A lazy association is dereferenced inside a loop, or an entity is serialized straight to JSON. Fetch joins, `@EntityGraph`, or projections are used for list endpoints. |
| **Transactions** | | |
| Transaction boundary at the service layer | High | `@Transactional` sits on a controller or on a repository instead of the service method that owns the multi-step unit of work. |
| Proxy is not bypassed | High | A `@Transactional`, `@Async`, or `@Retryable` method is called via `this.` from inside the same class, or the annotation sits on a `private` method — the Spring proxy cannot intercept either case. |
| Rollback rules for checked exceptions | High | A checked exception is expected to roll back the transaction without `rollbackFor` — only unchecked exceptions and errors roll back by default. |
| Retry runs in a fresh transaction | High | `@Retryable` is on the same method as `@Transactional`, or `noRollbackFor` is used to swallow an optimistic-lock failure — the retry then re-runs inside a transaction already marked rollback-only. (Boot 4: `@Retryable` and `@EnableResilientMethods` come from Spring Framework core; Boot 3 projects commonly use the `spring-retry` dependency instead.) |
| **Database Migrations** | | |
| Flyway dependencies declared | High | The Flyway starter or the database-specific `flyway-database-*` module is missing (Boot 4: Flyway is no longer pulled in transitively by the JDBC/JPA starters — declare `spring-boot-starter-flyway`; Boot 3: it arrives transitively). |
| Migration file naming | High | A migration file uses a single underscore (`V1_create_users.sql`) instead of `V{version}__{description}.sql`, so Flyway never applies it. |
| Applied migrations never edited | Critical | An existing `V<n>__*.sql` file was modified — its checksum no longer matches and startup fails. A new migration is added instead. |
| Schema change is backward compatible | High | A `NOT NULL` column is added without a default or backfill, or a column is renamed in place — the running application breaks. The change is staged as add, backfill, constrain, then drop. |
| **Configuration** | | |
| Properties are typed and registered | High | A `@ConfigurationProperties` record is defined but never registered via `@ConfigurationPropertiesScan` or `@EnableConfigurationProperties` — a record is not automatically a bean. |
| Validation and explicit units | Medium | `@Validated` is used with no validation provider on the classpath, or a timeout or size is a bare number with no unit suffix. |
| Secrets are not defaults | High | A required credential has a default value, or a secret is a record component whose generated `toString` exposes it. Missing settings fail startup. |
| **Security** | | |
| Lambda DSL security configuration | Critical | `WebSecurityConfigurerAdapter`, `.and()`, `authorizeRequests()`, `antMatchers()`, `mvcMatchers()`, or `AntPathRequestMatcher` are used — removed in Spring Security 7 (Boot 4) and no longer compile. A `SecurityFilterChain` bean uses `requestMatchers(...)`. |
| Stateless sessions for token APIs | High | `SessionCreationPolicy.IF_REQUIRED` is used where authentication is JWT-based — it must be `STATELESS`. |
| Signing key comes from the environment | Critical | The JWT secret is a literal in source or is shorter than 256 bits — HS256 needs at least a 256-bit key or `Keys.hmacShaKeyFor` throws `WeakKeyException`. |
| Token filter rejects invalid tokens | High | `ExpiredJwtException` escapes the filter so an expired token becomes a 500, the filter accepts a refresh token as an access token, or it does not re-check the account's enabled/locked/expired status. |
| Method security is enabled | High | `@PreAuthorize` is used without `@EnableMethodSecurity` — the annotation is silently ignored. |
| Actuator exposure is minimal | Critical | `management.endpoints.web.exposure.include=*`, or `configprops`/`env` is exposed publicly — internal configuration and secrets are reachable. |
| CORS is restricted | High | `@CrossOrigin(origins = "*")` or a wildcard allowed-origin list is used outside local development. |
| **Testing** | | |
| Real database in tests | High | H2 stands in for the production database — dialect differences hide real bugs. Testcontainers is used with `@ServiceConnection`. |
| Boot 4 test annotations | High | `@MockBean`/`@SpyBean` are used (Boot 4: removed — use `@MockitoBean`/`@MockitoSpyBean`), or a `@SpringBootTest` expects an auto-provided `MockMvc` without `@AutoConfigureMockMvc` (Boot 4). Boot 4 HTTP integration tests use `RestTestClient` with `@AutoConfigureRestTestClient` rather than `TestRestTemplate`. |
| Security context in slice tests | Medium | A `@WebMvcTest` has no `@WithMockUser` — the security filter rejects every request and the test passes for the wrong reason. |
| Committed state is verified from a new transaction | High | A test asserts on data read inside the same transaction that wrote it, so a test-wide rollback hides after-commit behaviour and the test proves nothing about what was persisted. |
| **Observability & Deployment** | | |
| Probe separation | High | The liveness probe depends on a database or broker — a dependency outage triggers restart loops. Traffic-critical dependencies belong in the readiness group instead. |
| Low-cardinality metric tags | High | A metric tag carries a user id, an entity id, a URL containing an id, or an exception message. |
| Secrets injected at runtime | Critical | A secret is baked into an image layer or build context instead of being injected at deployment time. |
| **Boot 4 Migration Risk** | | |
| Starter names | High | `spring-boot-starter-web` is still present (Boot 4: `spring-boot-starter-webmvc`), or the project assumes Flyway arrives with the JPA starter (Boot 4: declare `spring-boot-starter-flyway`). Boot 4 also splits into dedicated starters such as `spring-boot-starter-security-test`. |
| Jackson generation | High | Jackson 2 `com.fasterxml` customizations remain in a Boot 4 codebase — Boot 4 uses Jackson 3 (`tools.jackson`): a `JsonMapper` bean replaces a hand-rolled `ObjectMapper`, and `@JsonComponent` becomes `@JacksonComponent`. |
| Removed Security and MVC APIs | High | Non-lambda Security chaining or `authorizeRequests()` remains (Boot 4 / Security 7), or API versioning is hand-rolled with duplicated `/v1` and `/v2` controllers (Boot 4: use `spring.mvc.apiversion.*` with the `version` attribute on the mapping). |
| Migration leftovers | Medium | `spring-boot-properties-migrator` is still installed, a classic starter coexists with the Boot 4 technology starter, or the dependency tree contains two Jackson generations. |
