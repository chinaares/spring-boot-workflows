# Security Checks

Patterns and commands for the SECURITY and DIFF phases of `/verify`.

**Redaction rule**: when a pattern matches, report the **file, the line, and the
pattern name** — never the matched value. A live credential written into
`report.md`, a PR body, or the terminal is a second leak.

---

## 1. Credential patterns

Scan the changed files. Each pattern is a **regex** (ERE), matched case
sensitively unless noted.

| Name | Pattern | Severity |
|---|---|---|
| `aws-access-key` | `\bAKIA[0-9A-Z]{16}\b` | critical |
| `aws-secret-key` | `[Aa][Ww][Ss].{0,20}?['\"][0-9a-zA-Z/+]{40}['\"]` | critical |
| `github-token` | `\bgh[pousr]_[A-Za-z0-9]{36,}\b` | critical |
| `gitlab-token` | `\bglpat-[A-Za-z0-9_-]{20,}\b` | critical |
| `slack-token` | `\bxox[abprs]-[A-Za-z0-9-]{10,}\b` | critical |
| `openai-key` | `\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b` | critical |
| `anthropic-key` | `\bsk-ant-[A-Za-z0-9_-]{20,}\b` | critical |
| `google-api-key` | `\bAIza[0-9A-Za-z_-]{35}\b` | critical |
| `private-key` | `-----BEGIN (RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----` | critical |
| `jwt` | `\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b` | high |
| `basic-auth-url` | `\b[a-z][a-z0-9+.-]*://[^/\s:@]+:[^/\s:@]+@` | critical |
| `bearer-literal` | `[Bb]earer\s+[A-Za-z0-9._~+/-]{20,}=*` | high |
| `password-literal` | `['\"]([Pp]assword|[Pp]asswd|[Pp]wd|[Ss]ecret)['\"]\s*[:=]\s*['\"][^'\"\s]{6,}['\"]` | high |
| `jdbc-credentials` | `[Jj][Dd][Bb][Cc]:[a-z]+://[^/\s]*:[^/\s@]+@` | critical |

Scan command (source tree):

```bash
grep -rnE '<pattern>' src/ --include='*.java' --include='*.yml' --include='*.yaml' \
  --include='*.properties' --include='*.xml' --include='*.json' --include='*.env'
```

Scan only the diff (faster, and the pre-existing ones are someone else's problem):

```bash
git diff <base>...HEAD -U0 | grep -nE '^\+.*<pattern>'
```

### False positives

These are **not** leaks — report them as notes, not failures:

- A value that is entirely a placeholder: `${...}`, `{{...}}`, `%s`, `changeme`,
  `REPLACE_ME`, `your-secret-here`, `xxx`, `<secret>`
- A test fixture with a deliberately fake key — `src/test/**` with a name
  matching `test|mock|fixture|fake`
- A **public** key (`-----BEGIN PUBLIC KEY-----`) — public by definition
- A hash or a UUID used as a non-secret identifier
- A local development URL with inline credentials in `application-local.yml`
  that is git-ignored — confirm with `git check-ignore` before dismissing

Everything else is a **hard fail**.

---

## 2. Runtime-security heuristics

These are found by reading the changed lines, not by grepping the whole tree.

| Check | Why |
|---|---|
| Wildcard CORS (`allowedOrigins("*")`) | Any origin may call the API with the user's cookie or token |
| `e.getMessage()` returned in a response body | Leaks stack detail and internal identifiers |
| A catch-all `@ExceptionHandler(Exception.class)` that returns the message | Same, plus it hides real failures |
| `System.out.print` / `printStackTrace()` in `src/main/` | Leaks to stdout, bypasses the log pipeline |
| `log.debug` of a request body or a credential-bearing object | Secrets land in the log store |
| `@Autowired` on a field | Field injection defeats immutability and hides the dependency |
| Empty `catch (Exception e) {}` | Swallows failures — the bug surfaces later, elsewhere |
| `Thread.sleep` in application code | A scheduler bug wearing a disguise |
| Native query with string concatenation | SQL injection |
| `SELECT *` in a native query | Couples the schema to the response shape |
| `@Transactional` on a private method | Spring's proxy never sees it — the annotation is inert |
| A `permitAll()` route that returns personal data | Authorization bypass |
| `spring.jpa.hibernate.ddl-auto: update` or `create` outside tests | Schema drift in production |
| `logging.level.*=DEBUG` or `TRACE` in a committed profile | Verbose logs in production |

---

## 3. Dependency CVE scan

The OWASP analyzer is the only real CVE source here — a version comparison
against a known-good list is not a substitute.

```bash
./mvnw -B org.owasp:dependency-check-maven:check
```

Record each finding as `CVE-id — severity — dependency — fixed-in-version`.

**Never report the scan as clean when it did not finish.** A timed-out or
rate-limited NVD update is an `ERROR`, not a `PASS`. The difference matters:
one means "no known CVEs", the other means "we did not look".

---

## 4. Git history scan

Credentials that were committed and later removed are still in the history.

```bash
git log -p --all -S'<pattern>' -- '*.java' '*.yml' '*.properties'
```

This is slow — run it only when the diff scan is clean but the user asks for a
deeper pass, or when `git.secrets` / `gitleaks` is already configured:

```bash
git secrets --scan          # if the git-secrets hook is installed
gitleaks detect --source .  # if gitleaks is installed
```

A credential found in history is a **hard fail** and needs rotation, not just a
deletion — the value must be treated as compromised.

---

## 5. Reporting format

```
[SECURITY] src/main/resources/application-prod.yml:12 — password-literal
            → hardcoded credential in a committed profile
            → move to an environment variable / Vault; rotate the value
```

Severity mapping to the findings file:

| Pattern class | Severity |
|---|---|
| Access keys, private keys, basic-auth URLs, JDBC credentials | `critical` |
| JWTs, bearer literals, password literals | `high` |
| Heuristic findings (wildcard CORS, raw exception messages) | `medium` |
| Debug logging of sensitive objects | `low` |
