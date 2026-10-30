# General Code Review Checklist

Language-agnostic checks applicable to all pull requests.

**Severity scale**: Critical = blocks merge, likely causes bugs/security issues. High = should fix before merge. Medium = recommended improvement. Low = nice-to-have, can address later.

| Check | Severity | What to Look For |
|-------|----------|------------------|
| **Architecture** | | |
| Follows project patterns | High | Change matches existing architecture (layers, modules, dependency direction). |
| Single responsibility | Medium | Each class/module has one reason to change. No god objects. |
| Dependency direction | High | Dependencies point inward (domain has no dependency on infrastructure). |
| No circular dependencies | High | Modules/packages don't form circular import chains. |
| **Naming** | | |
| Descriptive names | Medium | Variables, functions, classes have intention-revealing names. No single letters (except loops). |
| Consistent terminology | Medium | Same concept uses same name everywhere. No synonyms (`user`/`account`/`client` for same thing). |
| No abbreviations | Low | Names are not abbreviated unless universally understood (`id`, `url`, `http`). |
| **Complexity** | | |
| Function length | Medium | Functions under 30-40 lines. Long functions split into named helpers. |
| Cyclomatic complexity | Medium | No deeply nested `if/else/switch`. Max 3-4 levels of indentation. |
| No premature abstraction | Medium | Abstraction introduced only when there are 2+ concrete use cases. |
| **Error Handling** | | |
| All errors handled | High | No ignored errors, unhandled promise rejections, or swallowed exceptions. |
| Specific error types | Medium | Catch/handle specific errors, not generic catch-all. |
| User-facing messages | Medium | Error messages shown to users are helpful and don't leak internals. |
| Graceful degradation | Medium | Feature failures don't crash the entire application. |
| **Security (OWASP)** | | |
| No hardcoded secrets | Critical | No API keys, passwords, tokens in source code. Use env vars or vaults. |
| Input validation | Critical | All external input (API, forms, files) validated and sanitized. |
| SQL/NoSQL injection | Critical | Parameterized queries only. No string interpolation in queries. |
| XSS prevention | Critical | User-generated content escaped before rendering. No `innerHTML` with raw input. |
| Auth/authz checks | Critical | Endpoints verify authentication and authorization. No broken access control. |
| Sensitive data exposure | High | PII, tokens, passwords not logged, not in URLs, not in error messages. |
| Dependency vulnerabilities | High | No known CVEs in dependencies. Lock files up to date. |
| **Performance** | | |
| No N+1 queries | High | Database queries in loops replaced with batch/join operations. |
| Pagination | Medium | List endpoints paginated. No unbounded result sets. |
| Caching appropriateness | Medium | Expensive reads cached. Cache invalidation strategy exists. |
| No unnecessary computation | Medium | Expensive operations not repeated in hot paths (loops, re-renders). |
| **Testing** | | |
| Tests exist | High | New functionality has tests. Bug fixes include regression tests. |
| Tests are meaningful | Medium | Tests verify behavior, not implementation details. |
| Edge cases covered | Medium | Null, empty, boundary, error, and concurrent cases tested. |
| Tests are independent | Medium | Tests don't depend on execution order or shared mutable state. |
| **Documentation** | | |
| Public API documented | Medium | Public functions/endpoints have clear descriptions of purpose and params. |
| Complex logic explained | Medium | Non-obvious algorithms or business rules have comments explaining why. |
| No commented-out code | Low | Dead code removed, not commented out. Use version control for history. |
| Changelog updated | Low | User-facing changes noted in changelog or release notes. |
| **Code Hygiene** | | |
| No TODO without ticket | Low | `TODO` comments reference a ticket/issue number for tracking. |
| No debug artifacts | Medium | No `console.log`, `print`, `debugger`, or test credentials left in code. |
| Consistent formatting | Low | Code follows project formatter (Prettier, Black, ktfmt, gofmt). |
| Minimal diff | Medium | PR only contains changes related to the stated purpose. No drive-by refactors. |
