# Java Rules

Generic Java rules — language level, idiom, structure, and naming.
Framework-specific rules live in `spring-boot.md`.

Every rule is a DO/DON'T pair. Apply all of them when writing or reviewing `.java` files.

---

## Language Level

- DO read the target release from the build file (`maven.compiler.release`, Gradle `toolchain`) before choosing an API.
- DON'T use an API newer than the configured release, even if the local JDK supports it.
- DO compile with `--release <target>` (or a Gradle toolchain) so the bytecode matches the declared level on every machine.
- DON'T rely on the JDK installed on the build agent being newer than the declared level.
- DO treat preview features (primitive patterns, stable values) as opt-in per build.
- DON'T enable preview features in a production build without an explicit team decision — preview APIs change between releases.
- DO use Java 17 language features (records, sealed types, `instanceof` patterns, text blocks) as the portable floor.
- DON'T adopt Java 21+ features (virtual threads, sequenced collections, switch patterns) in a module compiled below that release.
- DO use Java 21+ features when the project targets them and the surrounding module is already migrated.

---

## Records vs Classes

- DO use records for DTOs, request/response payloads, configuration holders, value objects, and query projections.
- DON'T use records for entities that a persistence provider must instantiate and mutate, or for types that need inheritance.
- DO declare record components `final` by default and add no setters.
- DON'T add mutable state, lazily-initialised fields, or bidirectional references to a record.
- DO enforce record invariants in a compact constructor with `Objects.requireNonNull` and range checks.
- DON'T rely on validation annotations alone inside a record — a compact constructor runs on every construction path.
- DO keep records small and single-purpose; split into a record per concern.
- DON'T mirror a whole domain aggregate in one wide record.

---

## Null Safety

- DO adopt JSpecify (`org.jspecify.annotations`) and mark each package `@NullMarked` in a `package-info.java`.
- DON'T annotate every parameter and return type with an explicit non-null marker — `@NullMarked` already covers them.
- DO mark genuine exceptions with `@Nullable` at the type-use site.
- DON'T put `@Nullable` on a package-private helper to silence a warning instead of fixing the null flow.
- DO place type-use annotations directly before the type (`private @Nullable String name`).
- DON'T use the deprecated framework nullability annotations (`org.springframework.lang.*`) in new code.
- DO distinguish a nullable container from nullable elements (`@Nullable List<String>` vs `List<@Nullable String>`).
- DON'T mix JSpecify and legacy nullability annotations in the same module.
- DO run NullAway with `NullAway:OnlyNullMarked=true` if you want the annotations enforced at compile time.
- DON'T assume annotations alone break the build — JSpecify is metadata until a checker reads it.

---

## Exception Handling

- DO throw the most specific exception type that describes the failure.
- DON'T use a generic `RuntimeException` when a domain or standard exception fits.
- DO keep the original cause when wrapping an exception.
- DON'T swallow a cause — a rethrow without the cause destroys the failure chain.
- DO catch an exception only to add context, translate it, or recover — and then rethrow.
- DON'T catch `Exception` (or `Throwable`) and return `null`, log-and-continue, or return a default value.
- DON'T use exceptions for ordinary control flow on a hot path.
- DO state the thrown exceptions in the Javadoc of a public API.
- DON'T let internal messages, SQL fragments, or stack traces reach an external caller.
- DO keep unchecked exceptions for programming errors and checked exceptions for recoverable, caller-actionable failures.
- DON'T declare checked exceptions a caller cannot meaningfully handle.

---

## Immutability & Collections

- DO return `List.of`, `Map.of`, `Set.of` from constants and fixed configurations.
- DON'T return a mutable collection from a public method or hand the internal collection to a caller.
- DO wrap an internal collection with `List.copyOf` / `Map.copyOf` / `Collections.unmodifiableList` at the boundary.
- DON'T mutate a collection that was handed out as unmodifiable — it fails at runtime, not compile time.
- DO initialise collection fields inline (`private final List<Item> items = new ArrayList<>();`).
- DON'T leave a collection field null and null-check it everywhere.
- DO use `Optional` for a method result that may be absent.
- DON'T use `Optional` as a field type or a method parameter type.
- DO use `getFirst()` / `getLast()` / `reversed()` on ordered collections (Java 21+).
- DON'T index into a list with `get(0)` / `get(size() - 1)` and duplicate the emptiness check.
- DO use `ConcurrentHashMap` and the `java.util.concurrent` collections for state shared across threads.
- DON'T share a plain `HashMap` or `ArrayList` across threads.

---

## Concurrency

- DO pass data between threads as immutable values (records, `List.copyOf`) instead of shared mutable objects.
- DON'T mutate a shared object from more than one thread without an explicit, documented synchronisation strategy.
- DO use `ExecutorService` (or a virtual-thread-per-task executor) instead of raw `Thread` objects.
- DON'T create unbounded executors or unbounded queues.
- DO size platform-thread pools deliberately and keep the size explicit in configuration.
- DON'T use virtual threads for CPU-bound work — they do not raise throughput there.
- DON'T adopt virtual threads for low-concurrency services; the documented threshold for a benefit is ~10,000+ concurrent tasks on an I/O-bound workload.
- DON'T hold a `synchronized` block across a blocking call when virtual threads are enabled — it pins the carrier thread; use `ReentrantLock`.
- DO use `ReentrantLock` instead of `synchronized` around blocking I/O in a virtual-thread application.
- DO use `ScopedValue` (Java 25) for request-scoped context in a virtual-thread-heavy application.
- DON'T use `ThreadLocal` for request-scoped context on Java 25.
- DO document the thread-safety expectations of a class that is shared.
- DON'T assume a plain method call runs inside a caller's unit of work — only framework-proxied cross-bean calls do. See `spring-boot.md` for transaction boundaries.

---

## Naming

- DO name classes, interfaces, enums, and annotations in `PascalCase`.
- DO name methods and variables in `camelCase`, using verb phrases for methods (`calculateTotal`, `findById`).
- DO name `static final` constants in `SCREAMING_SNAKE_CASE`.
- DO prefix boolean methods and fields with `is`, `has`, or `can`.
- DON'T prefix a boolean getter with `get` — `getActive()` reads as a non-boolean accessor.
- DO prefix abstract classes with `Abstract`.
- DON'T abbreviate names to save characters — spell out `message`, `repository`, `configuration`.
- DO use single-letter type parameters with the conventional meaning (`T` type, `E` element, `K` key, `V` value, `R` result).
- DON'T use underscores, hyphens, or uppercase segments in package names.
- DO name test methods `methodName_stateUnderTest_expectedBehavior`.
- DON'T name test methods `test_something` — the pattern carries the intent.

---

## Visibility Matrix

Default to the minimum visibility that works. Expose only what another layer genuinely calls.

| Component                | Class                       | Constructor     | Methods         |
|--------------------------|-----------------------------|-----------------|-----------------|
| HTTP / inbound handler   | package-private             | package-private | package-private |
| Service                  | `public`                    | package-private | `public`        |
| Repository / port        | package-private (interface) | —               | —               |
| Entity / domain model    | package-private             | protected       | `public`        |
| DTO / record              | `public` or package-private | —               | —               |
| Module facade / API      | `public`                    | package-private | `public`        |
| Request / response record | package-private            | —               | —               |
| Config / error handler   | package-private             | —               | —               |

- DO default a class to package-private when no other package needs it.
- DON'T make a class `public` "in case it is needed later".
- DO keep a constructor package-private or protected when the type controls instantiation.
- DON'T expose a public constructor on a type with a static factory.
- DO keep entity and repository types non-public.
- DON'T expose entity internals to a different layer.

---

## Naming Conventions

| Type                 | Convention           | Example                                     |
|----------------------|----------------------|---------------------------------------------|
| Entities             | `*Entity`            | `UserEntity`, `AddressEntity`               |
| Value objects        | Domain name (record) | `Email`, `UserCode`, `UserId`               |
| Commands             | `*Cmd`               | `CreateUserCmd`, `UpdateAddressCmd`         |
| Command results      | `*Result`            | `LoginResult`, `RegistrationResult`         |
| DTOs                 | `*Dto`               | `UserDto`, `AddressDto`                     |
| HTTP request         | `*Request`           | `CreateUserRequest`, `CreateAddressRequest` |
| HTTP response        | `*Response`          | `CreateUserResponse`, `CreateAddressResponse` |
| Repositories         | `*Repository`        | `UserRepository`, `AddressBookRepository`   |
| Services             | `*Service`           | `UserService`, `AddressBookService`         |
| Domain exceptions    | `*Exception`         | `InvalidUserCreationException`             |
| Module facade        | `*API`               | `UsersAPI`                                  |

- DO pick one suffix per type and use it everywhere in the project.
- DON'T mix suffix styles for the same kind of type across modules.
- DO name a domain exception after the rule it violates (`InvalidUserCreationException`), not after the layer that throws it.
- DON'T name exceptions `ServiceException` or `DaoException`.
- DO flag a naming violation by name together with the corrected suggestion when reviewing.

---

## Modern Java Features

- DO use switch expressions instead of switch statements that produce a value.
- DON'T use `break` to produce a value from a switch statement.
- DO omit the `default` branch when switching over a sealed type, so the compiler enforces exhaustiveness.
- DON'T add a `default` branch that silently absorbs a case the compiler could have caught.
- DO use `instanceof` pattern matching instead of a type check plus cast.
- DON'T cast a value immediately after `instanceof` — bind it to a pattern variable.
- DO use text blocks for multi-line strings, queries, and JSON fixtures.
- DON'T build multi-line strings with `\n` concatenation.
- DO use sealed interfaces for closed hierarchies (result types, domain events, state machines).
- DON'T seal a type whose extensions are meant to come from outside the module.
- DO use records to implement the permitted subtypes of a sealed interface.
- DON'T use string templates — the feature was withdrawn and is not available in Java 25; use `String.format`, concatenation, or text blocks.

---

## Build & Dependencies

- DO pin every dependency version in a single place — Maven `<dependencyManagement>` or a Gradle platform BOM.
- DON'T scatter versions across individual `<dependency>` blocks.
- DO import one BOM that aligns the whole dependency set to a compatible version matrix.
- DON'T declare `LATEST` or `RELEASE` version ranges — they break reproducible builds.
- DO keep test-scope dependencies (test frameworks, mock libraries) in `test` scope.
- DON'T let test libraries leak into `compile` / `implementation` scope.
- DO declare the Java release once (`maven.compiler.release` or a Gradle toolchain).
- DON'T mix `source`/`target` with `release` — `release` is the one that constrains the API surface.
- DO use the Gradle `toolchain` rather than `sourceCompatibility`.
- DON'T let two copies of the same library resolve to different versions.
- DON'T add a dependency before checking whether an existing one already provides the capability.
- DON'T mix `javax.*` and `jakarta.*` packages in the same module.
