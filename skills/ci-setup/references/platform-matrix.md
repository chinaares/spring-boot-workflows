# GitHub Actions vs Gitea Actions

Gitea Actions follows the GitHub Actions syntax but not every feature behaves the
same. Use this matrix when generating or reviewing workflows.

## Directory and context

| Item | GitHub Actions | Gitea Actions |
|---|---|---|
| Workflow directory | `.github/workflows/` | `.gitea/workflows/` |
| Context namespace | `github.*` (e.g. `github.ref`) | `gitea.*` (e.g. `gitea.ref`) |
| Workflow name in concurrency | `github.workflow` | `gitea.workflow` |
| PR number | `github.event.pull_request.number` | `gitea.event.pull_request.number` |
| Commit SHA | `github.sha` | `gitea.sha` |

Never mix namespaces. A `github.*` expression in a Gitea workflow evaluates to
empty, and vice versa.

## Action references

| Item | GitHub Actions | Gitea Actions |
|---|---|---|
| Checkout | `actions/checkout@v4` | `https://gitea.com/actions/checkout@v7` |
| JDK | `actions/setup-java@v5` | `https://gitea.com/actions/setup-java@v6` |
| Cache | `actions/cache@v4` | `https://gitea.com/actions/cache@v6` |
| Artifacts | `actions/upload-artifact@v4` | `https://gitea.com/actions/upload-artifact@v7` |
| Container step | `docker://...` | `docker://...` (supported) |

Gitea resolves a bare `owner/repo@ref` against **github.com**. Always write the
full `https://gitea.com/...` URL unless the instance sets `DEFAULT_ACTIONS_URL`
to another host. If your Gitea instance mirrors actions elsewhere (a self-hosted
registry or a Gitea instance on another domain), use that host instead.

## Tokens and permissions

| Item | GitHub Actions | Gitea Actions |
|---|---|---|
| Built-in token | `secrets.GITHUB_TOKEN` (automatic) | `${{ github.token }}` (automatic; `gitea.token` is the native spelling) |
| Checkout auth | built into `actions/checkout` | built into `actions/checkout` via its `token` input default `${{ github.token }}` |
| Private / cross-repo checkout | `token: ${{ secrets.GITHUB_TOKEN }}` or a PAT | `with: token: ${{ secrets.GITEA_TOKEN }}` — an `env: GITEA_TOKEN` alone is ignored |
| `permissions:` block | supported | partially supported; omit it unless the target version documents it |
| Environment protection / approvals | `environment:` with reviewers | no equivalent |
| OIDC cloud credentials | supported | no equivalent — use long-lived secrets |

Verified against Gitea 1.27.3: `actions/checkout@v7` reads only the `token`
input (`source: src/input-helper.ts`), and the built-in token authenticates a
same-repository checkout without any secret.

## Runners

`runs-on` must match a label registered by the runner, not a GitHub-hosted
image name:

- GitHub-hosted: `ubuntu-latest`, `ubuntu-24.04`, `windows-latest`, ...
- Gitea `act_runner`: whatever labels the runner registered (often
  `ubuntu-latest`, but self-hosted instances commonly use `docker`, `linux`,
  or a custom label). Ask the user which label the runner exposes.

## Maven caching

The cache path must equal the local repository Maven actually uses:

| Setup | Maven local repository | Cache path |
|---|---|---|
| No `<localRepository>` in settings | `~/.m2/repository` | `~/.m2/repository` |
| `<localRepository>.m2/repository</localRepository>` | `<workspace>/.m2/repository` | `.m2/repository` |
| `<localRepository>/custom/path</localRepository>` | `/custom/path` | `/custom/path` |

Common failure: caching `.m2/repository` while Maven writes to
`~/.m2/repository` (or the reverse). The cache then never restores anything and
the workflow looks fine while being pure overhead.

`setup-java`'s `cache: maven` always uses `~/.m2/repository`. When a project
declares a custom `<localRepository>`, use an explicit `actions/cache` step
with the real path instead.

## Container-based Maven (phase 2)

The reference examples run Maven through `docker://maven:3.10.0-eclipse-temurin-25`.
That works on both platforms, but note:

- A `docker://` step runs in a container where `$HOME` is `/root`. A host-side
  `actions/cache` that restores `~/.m2/repository` is **not visible** inside the
  container.
- To cache with container steps, put `<localRepository>.m2/repository</localRepository>`
  in `.mvn/settings.xml` (inside the mounted workspace) and cache `.m2/repository`.
- Phase 1 avoids this trap by using `setup-java` on both platforms. Container
  and air-gapped JDK variants are tracked in `TODO.md`.

## Test reports and coverage

- GitHub surfaces Surefire results through checks/annotations; Gitea has no
  equivalent test-report UI, so artifacts are the portable baseline.
- JaCoCo HTML reports are uploaded as artifacts on both platforms.
- Static analysis (SpotBugs) is artifact-only on both.

## Feature gaps to verify per Gitea version

These vary by Gitea/act_runner release — confirm against the target instance
before relying on them:

- Reusable workflows (`on: workflow_call`)
- `permissions:` enforcement
- `environment:` and deployment approvals
- Some `actions/*` inputs (for example sparse checkout in old `checkout` ports)
- Artifact retention semantics
