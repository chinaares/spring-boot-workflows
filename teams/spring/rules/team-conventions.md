# Spring Team Conventions
#
# This file is copied to .claude/rules/ during install.
# Claude reads these rules during ALL work — not just workflows.
#
# Write rules as DO / DON'T pairs with brief rationale.
# Keep it focused on conventions that differ from general best practices.
# ─────────────────────────────────────────────

## Layering

- DO keep controllers thin — parse input, call one service method, map the result
- DON'T put business logic or `@Transactional` in a controller
- DO put business rules in services and keep repositories to data access only
- DON'T let JPA entities reach an API response — map to a DTO or record at the boundary
- DO keep cross-feature shared types in an explicit `common`/`shared` package, not scattered across features

## Package Structure

- DO mirror the domain in the package path — `com.example.order.service`, not `com.example.impl.service`
- DO keep feature packages self-contained; a feature owns its entity, repository, service, and controller
- DON'T create a top-level `common` package that accumulates unrelated utilities
- DON'T use `util`, `helper`, `misc`, or `base` as package or class names

## Dependency Injection

- DO use constructor injection — explicit constructors or `@RequiredArgsConstructor`, consistent across the project
- DON'T use field `@Autowired`
- DON'T inject a repository or entity manager into a controller

## Validation & Errors

- DO validate request bodies with `@Valid` and Bean Validation annotations at the boundary
- DO handle errors in one `@RestControllerAdvice` returning a consistent error body
- DON'T catch `Exception` and swallow it; DON'T expose stack traces or exception messages to clients
- DON'T invent a second error envelope — extend the existing one

## Persistence

- DO put `@Transactional` on service methods; use `readOnly = true` for queries
- DO manage schema with Flyway or Liquibase migrations committed alongside the entity change
- DON'T rely on `ddl-auto: update` outside local development — use `validate` in every other environment
- DON'T build SQL by string concatenation; use parameters or a specification/query object
- DO avoid N+1: use fetch joins or `@EntityGraph`, and paginate list endpoints

## Configuration

- DO bind settings with `@ConfigurationProperties`; keep per-environment values in profiles
- DON'T hardcode secrets; read them from environment variables or a secret manager
- DON'T read a group of related properties with raw `@Value`

## Logging

- DO use SLF4J with parameterized messages
- DON'T log passwords, tokens, or PII — not at INFO, not at DEBUG
- DO use MDC to carry the request/correlation id through the call chain

## Naming

- DO use PascalCase for types, camelCase for methods and fields, UPPER_SNAKE_CASE for constants
- DO name REST paths as plural kebab-case nouns — `/api/v1/order-items`
- DO suffix types by role — `*Entity`, `*Repository`, `*Service`, `*Controller`, `*Request`, `*Response`

## Testing

- DO write both positive and negative test cases for every new behavior
- DO use Testcontainers with the production database engine; avoid in-memory substitutes for relational databases
- DO keep the slice tests honest — a slice test that silently skips the configuration under test is worse than no test
- DON'T weaken or delete an assertion to make a build pass

## Build

- DO use the checked-in build wrapper (`./mvnw`, `./gradlew`) so local and CI builds match
- DON'T commit generated build output or IDE folders
