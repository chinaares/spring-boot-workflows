# Rule 8: Common Error Resolutions

> **Always-available rule**: This rule applies to ALL skills regardless of their `rules` list. Consult this table whenever encountering git/CLI errors.

| Error | Resolution |
|-------|------------|
| `gh` CLI not authenticated | Tell user: run `! gh auth login` |
| `tea` CLI not authenticated | Tell user: run `! tea login add --name <instance> --url <url> --token <token>` |
| Wrong CLI for the platform | Detect the platform and switch between `gh` and `tea` — see `references/platform-cli.md` |
| Dirty working tree | Tell user: stash or commit first |
| Branch already exists | Ask user: switch, rename, or delete |
| Config file missing | Guide user: run `/spring-boot-workflows:setup` to initialize project |
| Remote branch not found | Check remote name (`git remote -v`), pull, or push with `-u` |
| Merge conflict | Report conflicting files, offer to resolve or abort |

## Platform detection

Skills that run CI or PR commands must resolve the platform before acting:

1. `--platform` flag → use it.
2. `ci.platform` in `.workflows/config.yml`, when it is not `auto`.
3. `git remote get-url origin`: `github.com` → `github`; otherwise → `gitea`.
4. Otherwise ask the user.

The full `gh` ↔ `tea` command mapping lives in
`<plugin-root>/skills/_orchestration/references/platform-cli.md`.
