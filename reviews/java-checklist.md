# Java Code Review Checklist

Framework-agnostic Java checks. Language-agnostic checks live in `general-checklist.md`; Spring Boot specifics live in `spring-boot-checklist.md`.

**Severity scale**: Critical = blocks merge, causes data loss, a security hole, or a build failure. High = correctness risk or clear convention violation. Medium = maintainability/consistency improvement. Low = style preference.

Report only findings you can confirm by tracing the code: verify each candidate finding against its callers, tests, and the surrounding control flow, and run the narrowest useful check (compile, targeted test, static analysis) before reporting it. Separate confirmed defects from risks and open questions.

| Check | Severity | What to Look For |
|-------|----------|------------------|
| **Null Safety** | | |
| Chained dereferences without null checks | High | A call chain dereferences a possibly-null value at each link. Every intermediate is null-checked, or the chain is wrapped in `Optional`. |
| `Optional.get()` without a presence check | High | `findById(id).get()` throws `NoSuchElementException` at runtime. Use `orElseThrow(...)` with a domain exception. |
| `null` returned from public methods | Medium | A public method returns `null` instead of `Optional<T>` or an empty collection, forcing every caller to null-check. |
| `Optional` as a field or parameter type | Medium | `Optional` appears in a field declaration or method parameter — it is a return-type container, not a field type. |
| Nullability not declared on public APIs | Medium | Public method parameters and return types carry no `@Nullable`/`@NonNull` annotation, so nullability is undocumented for callers. |
| **Exception Handling** | | |
| Empty catch block | High | `catch (Exception e) { }` discards the failure silently. The exception is logged and either rethrown or translated. |
| Catching `Exception` or `Throwable` | High | The catch type is broader than the failure being handled, so programming errors are swallowed too. The specific checked exception is caught. |
| Cause discarded when wrapping | High | `throw new RuntimeException(e.getMessage())` loses the original stack trace. The original exception is passed as the cause. |
| Swallowed exception | High | A caught exception is neither logged nor rethrown, so the failure leaves no trace anywhere. |
| **Resource Management** | | |
| Resources not in try-with-resources | High | An `InputStream`, `Connection`, `ResultSet`, or `Socket` is opened without try-with-resources — the close is skipped when the body throws. |
| Resource acquired before the try block | Medium | The resource is created outside the `try`, so it is not closed on every exit path from the method. |
| Executor or client never closed | High | An `ExecutorService` or client with its own resources is created and never shut down — thread or connection leak. |
| **Concurrency** | | |
| Shared mutable state without synchronization | High | A field is read or written from multiple threads with no `volatile`, lock, or atomic wrapper, so visibility is not guaranteed. |
| Non-atomic check-then-act | High | `if (map.containsKey(k)) map.get(k)` — another thread can insert between the two calls. `computeIfAbsent` is used instead. |
| Non-thread-safe collection shared across threads | High | A `HashMap`, `ArrayList`, or `HashSet` instance is shared between threads. A concurrent variant is used. |
| Read-modify-write on a counter or flag | High | `count++` or `flag = true` runs outside a lock or atomic type, so updates are lost. |
| Inconsistent lock acquisition order | High | Two methods acquire the same two locks in different orders, or a `ReentrantLock` is not released in a `finally` block — deadlock or lock leak risk. |
| Unbounded thread pool | High | `Executors.newCachedThreadPool()` or an oversized fixed pool is used as the application's pool — it grows without limit under load. |
| Coarse lock or `synchronized(this)` | Medium | `synchronized` covers a whole method when only a small section needs it, or `this` is the monitor in a class exposed to other code — a private lock object is used. |
| **Modern Java** | | |
| `==` used to compare strings | High | `str1 == str2` compares references rather than content. |
| `equals` overridden without `hashCode` | High | The class overrides one of `equals`/`hashCode` but not the other, breaking `HashMap` and `HashSet` lookups. |
| Legacy concurrency and collection classes | Medium | `Vector`, `Hashtable`, `StringBuffer`, or `Enumeration` appear in new code. |
| Deprecated boxing constructors | Low | `new Integer(...)` or `new Long(...)` is used instead of `valueOf` or autoboxing. |
| **Naming & Structure** | | |
| Vague method and variable names | Medium | Names such as `get`, `check`, `doStuff`, `handle`, or single-letter parameters (outside loop indices) do not convey intent. |
| Boolean naming without `is`/`has`/`can` | Medium | A boolean field or method is named `active`, `valid`, or `enabled` instead of `isActive`, `hasPermission`, or `canRetry`. |
| Constant naming | Low | A `static final` field is not named in `SCREAMING_SNAKE_CASE`. |
| Package naming | Medium | A package segment contains an underscore, a hyphen, or an uppercase letter. |
| Layer separation | Medium | Business logic, persistence access, and HTTP concerns are not kept in separate packages (`controller`, `service`, `repository`, `entity`, `dto`, `exception`, `config`, `util`). |
| Concrete dependency in business logic | High | A field or constructor takes a concrete implementation, or business logic calls `new ConcreteClass()` — it depends on an abstraction instead. |
| Utility class absorbing responsibilities | Medium | A `*Manager`, `*Helper`, or `*Utils` class holds more than three unrelated methods. |
| **Security** | | |
| SQL injection via string concatenation | Critical | User input is concatenated into JPQL, HQL, native SQL, or a `JdbcTemplate` query string. Named parameters or `?` placeholders are used instead. |
| Command injection | Critical | `Runtime.exec()` or `ProcessBuilder` receives input that originates outside the process. |
| Unsafe deserialization | Critical | `ObjectInputStream.readObject()` is applied to data from an external source. |
| Expression and JNDI injection | Critical | A SpEL, OGNL, or JNDI lookup expression is built from external input. |
| Weak hashing for credentials | Critical | MD5, SHA-1, or DESede hashes a password or verifies integrity. BCrypt (strength 12+) or Argon2 is used for passwords. |
| Hardcoded credentials or keys | Critical | An API key, password, or token literal appears in source. |
| Missing authorization check | Critical | A privileged action — delete, role change, export, admin route — is reachable with no explicit permission check on the path that performs it. |
| Insecure randomness | High | `java.util.Random` generates a token, session id, or secret. `java.security.SecureRandom` is used. |
| Sensitive data in logs | High | A log statement prints a password, token, session id, card number, or other PII. |
| **Testing** | | |
| New behavior is untested | High | The changed production code has no test, or a bug fix has no regression test. |
| Class under test is mocked | High | The test mocks the class it is testing, or mocks a plain value object instead of constructing it directly. |
| Test naming | Medium | A test method is not named `methodName_stateUnderTest_expectedBehavior`. |
| Assertions use AssertJ | Medium | A test uses JUnit `assertEquals`/`assertTrue` instead of `assertThat(...)`. |
| Exception assertions | Medium | A thrown exception is asserted by try/catch instead of `assertThatThrownBy(...).isInstanceOf(...)`. |
