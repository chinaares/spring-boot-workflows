# Spring Boot Rules

Spring Boot specific rules — dependency injection, web layer, persistence, transactions,
migrations, configuration, clients, testing, and operations.

Read `java.md` first for the language-level rules. Every rule is a DO/DON'T pair.
Items marked **Boot 4 only** or **Boot 3 only** apply to that major version only.

---

## Dependency Injection

- DO inject dependencies through a constructor.
- DON'T use field injection — no `@Autowired` on a field.
- DO declare injected dependencies `final`.
- DON'T call a collaborator from a field initialiser.
- DO use an explicit constructor or `@RequiredArgsConstructor` — pick one and keep it consistent across the project.
- DON'T mix explicit constructors and generated constructors in the same codebase.
- DO inject interfaces (ports) rather than concrete implementations.
- DON'T keep business logic in a `@Configuration` class.
- DON'T create circular bean dependencies between packages — extract the shared part into a third bean.

---

## Controllers & DTOs

- DO return a DTO record from a controller — never a persistence entity.
- DON'T serialise an entity directly: it leaks lazy associations and persistence internals.
- DO name request payloads `*Request` and response payloads `*Response`.
- DO use `@Valid @RequestBody` on every `POST`/`PUT`/`PATCH` endpoint that accepts a body.
- DON'T trust a request payload's shape — validate at the boundary.
- DO use plural nouns for resources (`/orders`, `/users`) and kebab-case for multi-word segments (`/order-items`).
- DON'T nest resources more than two levels deep — flatten the deeper one.
- DO keep the existing ID type of the project when adding an endpoint.
- DON'T switch an existing API's ID type or response envelope while adding one route.
- DO return `201 Created` for a newly created resource and `204 No Content` for a delete with no body.
- DO map entities to DTOs inside the transaction that loaded them.
- DON'T touch a lazy association outside the transaction boundary.

### API versioning

- DO use the framework's native API versioning instead of duplicated `/v1` and `/v2` controllers.
- **Boot 4 only**: DO configure `spring.mvc.apiversion.*` (path segment, header, or query parameter) and set the `version` attribute on the mapping annotation.
- **Boot 4 only**: DO pick one resolution strategy per API and keep it consistent across the service.
- **Boot 3 only**: DO keep the version in the path segment and split controllers manually.
- DON'T hand-roll version selection with custom `RequestCondition`s or header checks.

### Pagination

- DO cap the page size (`spring.data.web.pageable.max-page-size`).
- DON'T accept an unbounded `Pageable` from a client — one request can pull a whole table.
- DO map entities to DTOs and then wrap the page in a stable response shape.
- DON'T serialise `PageImpl` directly — its JSON contract is not stable.
- DO return `PagedModel` when the project standardises on it.
- DON'T return a bare `Page`/`PageImpl` as the API response type.
- DO validate sort fields against an allowlist.
- DON'T let a client sort by an arbitrary entity property.

---

## Problem Details (RFC 9457)

- DO enable `spring.mvc.problemdetails.enabled` for an API that uses Problem Details.
- DON'T mix a legacy error envelope with Problem Details in the same API — keep one error policy.
- DO handle exceptions centrally in a `@RestControllerAdvice`.
- DON'T put `@ExceptionHandler` methods inside a controller.
- DO extend `ResponseEntityExceptionHandler` so framework exceptions keep their standard handling.
- DO use project-owned, stable `type` URIs for custom problems; omit `type` only when `about:blank` is intended.
- DON'T return the exception message from the catch-all handler — log it server-side and return a generic detail.
- DON'T expose persistence or infrastructure exception messages to the caller.
- DO use extension members (for example `errorCode`, `violations`) for machine-readable detail instead of relying on `detail` text.
- DON'T let the HTTP status and the body `status` disagree.
- DO configure an `AuthenticationEntryPoint` and an `AccessDeniedHandler` for filter-level 401/403.
- DON'T expect controller advice to handle exceptions thrown before the dispatcher servlet.
- DO map domain exceptions to stable status codes (404 for not found, 409 for conflict, 422 for a business rule violation).

---

## JPA & Persistence

- DO import `jakarta.persistence.*`.
- DON'T import `javax.persistence.*` in a Spring Boot 3+ project.
- DO use an `@Entity` only for persistent state with identity and lifecycle.
- DON'T make an entity `final`, and don't make its constructor private — the provider must be able to instantiate and proxy it.
- DO give the entity a `protected` no-arg constructor plus a static factory and behaviour methods.
- DON'T add public setters for every field.
- DO set `FetchType.LAZY` on `@ManyToOne` and `@OneToOne` — to-one mappings are eager by default.
- DON'T use `FetchType.EAGER` to "fix" a lazy loading problem.
- DO use `@Enumerated(EnumType.STRING)` with an explicit column length.
- DON'T use `@Enumerated(EnumType.ORDINAL)` — the ordinal breaks when the enum is reordered.
- DO add `@Version Long version` to user-editable aggregates.
- DON'T use a primitive `long` for `@Version` — JPA treats `0` as the first persisted version.
- DON'T omit `@Version` on an aggregate that concurrent clients can edit — lost updates go undetected.
- DO initialise collection fields inline so they are never null.
- DON'T include collections, mutable fields, or associations in `equals`, `hashCode`, or `toString`.
- DO use `instanceof` rather than `getClass()` in `equals` so it works with provider proxies.
- DON'T generate entity equality from a broad Lombok `@Data`.
- DO prefer `UUID` or a pooled sequence over `GenerationType.IDENTITY` on a write-heavy table — `IDENTITY` disables insert batching.
- DO index every foreign key column and every column used in a `WHERE` or `ORDER BY`.
- DON'T use `@ManyToMany` for a business relationship that carries attributes — model the join row as an entity.
- DO use `orphanRemoval = true` only when the parent truly owns the child's lifecycle.
- DO map the database shape first: `@ManyToOne` on the owning side, `@OneToMany(mappedBy = ...)` only when parent-to-child navigation is needed.

### Queries and N+1

- DO use derived query methods for simple filters and `@Query` for joins, keyset pagination, and complex predicates.
- DON'T use `findAll()` in a list endpoint — require a `Pageable`, a `Limit`, or a projection.
- DO prevent N+1 with a `JOIN FETCH` or an `@EntityGraph` on a bounded relationship.
- DON'T access a lazy association inside a loop or serialise entities to JSON.
- DO use DTO projections for read-only list views instead of loading an entire aggregate graph.
- DO use `exists...` queries instead of `find...().isPresent()` checks.
- DO use keyset pagination for deep or infinite-scroll lists, with a stable cursor tuple (for example `createdAt, id`) backed by a matching index.
- DON'T use `OFFSET` pagination on a large table — it scans and discards skipped rows.
- DON'T use native SQL unless JPQL cannot express the query or a database-specific feature is intentional.
- DO use text blocks for `@Query` JPQL.

### Batch writes and projections

- DO enable JDBC batching (`hibernate.jdbc.batch_size`, `order_inserts`, `order_updates`) for bulk work.
- DON'T assume `saveAll` batches on its own — it loops over `save` and needs the batching properties plus a non-`IDENTITY` id strategy.
- DO flush and clear the persistence context periodically in a large batch loop.
- DO use record constructor expressions in JPQL for DTO projections.
- DON'T rely on nested constructor expressions in JPQL — Jakarta Persistence 3.2 only allows a top-level `NEW`.
- DO prefer a flat record plus service-layer assembly, or an interface projection, for nested shapes.
- DON'T use an interface projection with nested associations without checking for N+1.

---

## Transactions

- DO put the transaction boundary at the service layer for a multi-step business operation.
- DON'T put a transaction on a repository method that the framework already manages.
- DO set `@Transactional(readOnly = true)` at the service class level and override it on mutating methods.
- DON'T treat `readOnly = true` as write prevention, authorization, or read-replica routing — it is an optimisation hint only.
- DON'T assume a local transaction makes a write to a second database or an HTTP provider atomic.
- DO call a `@Transactional` method on another bean, not on `this`.
- DON'T self-invoke a `@Transactional` method — it bypasses the proxy and the annotation is ignored.
- DO extract an independently transactional operation into its own bean.
- DON'T put `@Transactional` on a `private` method — the proxy cannot intercept it.
- DO add `rollbackFor` when a checked exception must roll the transaction back.
- DON'T expect a checked exception to roll back by default — only unchecked exceptions and errors do.
- DON'T use `noRollbackFor` to recover from an optimistic-lock failure — the transaction is already marked rollback-only.
- DO roll back and retry the whole unit of work in a fresh transaction with a bounded retry policy and a fresh entity read.
- DON'T put `@Retryable` on the transactional method itself — put it on a separate facade that calls it, so each attempt gets a fresh transaction.
- DO use `Propagation.REQUIRES_NEW` only for records that must survive a failed operation, and account for the extra connection it needs.
- DON'T commit a success audit row in an independent transaction that claims a rolled-back write happened.
- DO use `@TransactionalEventListener(phase = AFTER_COMMIT)` for best-effort local notifications.
- DON'T rely on `AFTER_COMMIT` for required delivery — it cannot survive a process crash or a failed send; use an outbox.
- DO delegate database writes from an `AFTER_COMMIT` listener to a separate `REQUIRES_NEW` bean.
- **Boot 4 only**: DO use the core `@Retryable` with `@EnableResilientMethods` for transient-failure retries.
- **Boot 3 only**: DO use the Spring Retry dependency's `@Retryable` and its enabling annotation.

---

## Database Migrations (Flyway)

- DO use Flyway when the project uses JDBC/JPA against a Flyway-supported relational database.
- DON'T add Flyway to a project that already uses Liquibase, or to a NoSQL-only project.
- **Boot 4 only**: DO declare the Flyway starter explicitly — the modular starters no longer pull it in transitively.
- **Boot 4 only**: DO add the database-specific `flyway-database-*` module alongside the starter; without it startup fails as "Unsupported Database".
- **Boot 3 only**: DON'T assume the Flyway starter is missing — JDBC/JPA starters pull it in transitively.
- DO let Flyway own the schema and set `spring.jpa.hibernate.ddl-auto: validate`.
- DON'T use `ddl-auto: update` or `create` outside a throwaway test.
- DO name migrations `V<version>__<description>.sql` with a double underscore, and keep versions sequential.
- DON'T edit a migration that has already run in any environment, and don't fill a gap that was already skipped.
- DO ship every schema change as a new migration file in the same commit as the entity change.
- DO add a new `NOT NULL` column with a `DEFAULT` or a backfill so existing rows keep working.
- DON'T rename a column in one step — add, backfill, switch, then drop in a later migration after the code is deployed.
- DON'T drop a table or column as the first step of a migration.
- DO name constraints and indexes explicitly (`pk_`, `uk_`, `ck_`, `fk_`, `ix_`).
- DON'T create a `CREATE INDEX CONCURRENTLY` in a normal migration — it cannot run inside Flyway's transaction.
- DO put a `CONCURRENTLY` statement alone in its own migration file with a `.sql.conf` sidecar that sets `executeInTransaction=false`.
- DO seed development data in a profile-scoped runner, not in a migration.
- DON'T set `out-of-order: true` in production — it hides ordering bugs.
- DO run `flyway validate` as a pre-deploy CI step.

---

## Configuration

- DO bind a related group of settings with a typed `@ConfigurationProperties` record.
- DON'T use `@Value` for a group of related settings — it is untyped, unvalidated, and untestable.
- DO register the properties record with `@EnableConfigurationProperties` or `@ConfigurationPropertiesScan`.
- DON'T define a properties record and never register it — it is not a bean.
- DO add `@Validated` with Jakarta constraints, annotate nested objects with `@Valid`, and include the validation starter.
- DON'T add `@Validated` without a validation provider on the classpath.
- DO use explicit units for durations and sizes.
- DON'T use a bare numeric timeout with no unit.
- DO fail startup on a missing required endpoint or credential.
- DON'T give a default value to a secret or a required endpoint.
- DO resolve secrets at the integration boundary, not in a properties record component — a record's generated `toString` would expose it.
- DON'T log the full bound configuration object.
- DO document the public property keys and test the environment-variable binding path you actually deploy.
- DON'T rely on YAML list merging — lists are generally replaced, not merged.
- DON'T expose the `configprops` or `env` actuator endpoints publicly, and don't disable sanitisation to debug.

---

## HTTP Clients

- DO use `RestClient` for blocking HTTP calls.
- DON'T introduce `RestTemplate` or `WebClient` for a blocking call.
- DO use `@HttpExchange` interfaces for declarative clients.
- **Boot 4 only**: DO register HTTP interface clients with `@ImportHttpServices(group = ..., basePackages = ...)` and inject the interface as a bean.
- **Boot 4 only**: DON'T create a manual `HttpServiceProxyFactory` bean per client — that is the Boot 3 wiring.
- **Boot 4 only**: DO configure transport defaults under `spring.http.clients.*` and per-group settings under `spring.http.serviceclient.<group>.*`.
- **Boot 4 only**: DO select `ClientType.WEB_CLIENT` explicitly for an interface returning `Mono` or `Flux`.
- DON'T hard-code a host in the `@HttpExchange` path — keep it in configuration.
- DO set connect and read timeouts, and map a non-2xx response to a typed exception at the client boundary.
- DON'T call an external API without a timeout, and don't propagate a raw HTTP error body to the caller.

---

## Caching

- DO enable caching explicitly (`@EnableCaching`) — `@Cacheable` does nothing without it.
- DO cache DTO/response objects, not entities with lazy associations.
- DO set a TTL on every cache — memory is not infinite.
- DO use JSON serialization for cached values, not Java serialization.
- **Boot 4 only**: DO use `GenericJacksonJsonRedisSerializer` — the `GenericJackson2JsonRedisSerializer` API is deprecated.
- **Boot 4 only**: DON'T register a `JavaTimeModule` on the Jackson 3 mapper — `java.time` is handled natively.
- DON'T cache `null` values unless that is intended — disable null caching otherwise.
- DO use `@Cacheable(sync = true)` for a hot key, or a short distributed lock, to avoid a cache stampede.
- DO add jitter to TTLs so a batch of keys does not expire together.
- DO evict explicitly on write (`@CachePut` / `@CacheEvict`) in the same operation that changes the data.
- DON'T leave a stale entry after a write because the cache key and the entity id disagree.

---

## Security

- DO use method-level security (`@PreAuthorize` / `@PostAuthorize`) for business authorization decisions.
- DON'T rely on URL-level rules alone for business authorization.
- DO enable method security explicitly — `@PreAuthorize` is inert without it.
- DO use the lambda DSL for the security configuration.
- **Boot 4 only**: DON'T use `and()`, `authorizeRequests()`, `antMatchers()`, `mvcMatchers()`, or `WebSecurityConfigurerAdapter` — they no longer exist.
- **Boot 4 only**: DO use `requestMatchers(...)` or `PathPatternRequestMatcher` and declare a `SecurityFilterChain` bean.
- **Boot 3 only**: DO declare a `SecurityFilterChain` bean rather than extending `WebSecurityConfigurerAdapter`.
- DO use stateless session policy for a bearer-token API.
- DO validate the current account state (enabled, locked, expired) in addition to the token claims.
- DON'T log bearer tokens or credentials, and don't keep the JWT secret in source.
- DO return 401 for a missing or invalid credential and 403 for an authenticated caller without the required role.
- DON'T map an authentication failure to a 500.
- DO use the Problem Details shape for 401/403 responses in the security layer.
- DON'T expose actuator endpoints, health details, or stack traces to unauthenticated callers.
- DO permit the whole `/actuator/health/**` path so the liveness and readiness probes work behind security.
- DON'T permit only `/actuator/health` — the probe sub-paths stay blocked.
- DO keep CSRF protection when the browser sends the credential automatically on its own.

---

## Testing

- DO follow the test pyramid: many fast unit tests, fewer slice tests, fewest integration tests.
- DON'T start the full Spring context for a unit test.
- DO name test methods `methodName_condition_expectedBehavior`.
- DO use AssertJ's `assertThat`, not JUnit's `assertEquals` / `assertTrue`.
- DO write both positive and negative cases for a behaviour.
- DO use `@ExtendWith(MockitoExtension.class)` with `@Mock` / `@InjectMocks` for unit tests.
- DON'T call `Mockito.mock(...)` inline instead of using the annotations.
- DON'T mock the class under test, and don't mock value objects or simple POJOs — construct them directly.
- DO use Testcontainers with `@ServiceConnection` for database tests.
- DON'T use an in-memory H2 database as a substitute for the production engine — dialect differences hide real bugs.
- **Boot 4 only**: DO use `@MockitoBean` / `@MockitoSpyBean` — `@MockBean` / `@SpyBean` were removed.
- **Boot 3 only**: DO use `@MockitoBean` / `@MockitoSpyBean` — `@MockBean` is deprecated since Boot 3.4.
- **Boot 4 only**: DO add `@AutoConfigureMockMvc` to a `@SpringBootTest` that expects `MockMvc` — it is no longer provided automatically.
- **Boot 4 only**: DO use `RestTestClient` with `@AutoConfigureRestTestClient` for HTTP integration tests.
- **Boot 3 only**: DO use `TestRestTemplate` for HTTP integration tests.
- DO use `@WebMvcTest` for a controller slice and `@DataJpaTest` for a repository slice.
- DO use `@DataJpaTest` with `@AutoConfigureTestDatabase(replace = Replace.NONE)` when the test runs against Testcontainers.
- DO add `@WithMockUser` to a secured controller test — the security filter rejects every request otherwise.
- DO assert the real HTTP response for domain 404/422, validation 400, and unexpected 500 — content type, status, stable error code, and the absence of stack traces.
- DO test filter-level 401/403 separately from controller advice.
- DO verify committed data from a new transaction when testing transaction behaviour.
- DO use the production database engine for isolation and contention tests.

---

## Observability

- DO add the Actuator starter and expose only the endpoints the platform needs.
- DON'T expose every actuator endpoint, and don't leave the non-public ones unsecured.
- DO name observations by a stable operation name, for example `orders.create`.
- DO use low-cardinality keys for metrics.
- DON'T tag metrics with user ids, entity ids, ids inside URLs, or exception messages — those belong in traces.
- DO prefer the Micrometer observation API over direct tracing APIs in application code.
- DO keep liveness independent of remote dependencies.
- DON'T tie liveness to a database or broker — a dependency outage triggers restart loops.
- DO put traffic-critical dependencies in the readiness group, and include the database in the readiness group.
- DO give a custom health check a strict timeout and stable detail keys.
- DO hide sensitive health detail from unauthenticated callers.
- DO emit structured logs correlated with the trace and span ids, and redact credentials, tokens, and personal data by default.
- DO configure graceful shutdown (`server.shutdown: graceful`).
- DO register context propagation for async executors so the trace context survives.
- DO alert on service-level symptoms — error ratio, latency, saturation, queue lag — and include a runbook reference.

---

## Spring Boot 4 Specifics

- **Boot 4 only**: DO use `spring-boot-starter-webmvc` — `spring-boot-starter-web` was renamed.
- **Boot 4 only**: DO use `spring-boot-starter-webmvc-test` for MockMvc test support.
- **Boot 4 only**: DO import `tools.jackson.*` — Boot 4 ships Jackson 3.
- **Boot 4 only**: DO declare a `JsonMapper` bean, not a generic `ObjectMapper` bean, when customising JSON.
- **Boot 4 only**: DO use `@JacksonComponent` and `JsonMapperBuilderCustomizer`; the Jackson 2 names no longer exist.
- **Boot 4 only**: DO enable virtual threads with `spring.threads.virtual.enabled` when the workload is I/O-bound and highly concurrent.
- **Boot 4 only**: DON'T expect virtual threads to help a CPU-bound workload.
- **Boot 4 only**: DO use the modular starters and declare any starter that is no longer implied — Flyway is the common one.
- **Boot 4 only**: DO use `RestClient` as the default HTTP interface client type.
- **Boot 4 only**: DO use `ResponseEntityExceptionHandler` in the problem-details advice.
- **Boot 3 only**: DO keep `spring-boot-starter-web` and the Jackson 2 `com.fasterxml.jackson.*` imports.
- **Boot 3 only**: DON'T use `spring.mvc.apiversion.*` — native API versioning is a Boot 4 feature.
- **Boot 3 only**: DO add the Spring Retry dependency before using `@Retryable`.
