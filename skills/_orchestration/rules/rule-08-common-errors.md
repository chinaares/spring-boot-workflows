# Rule 8: Common Error Resolutions

> **Always-available rule**: This rule applies to ALL skills regardless of their `rules` list. Consult this table whenever encountering git/gh errors.

| Error | Resolution |
|-------|------------|
| `gh` CLI not authenticated | Tell user: run `! gh auth login` |
| Dirty working tree | Tell user: stash or commit first |
| Branch already exists | Ask user: switch, rename, or delete |
| Config file missing | Guide user: run `/spring-boot-workflows:setup` to initialize project |
| Remote branch not found | Check remote name (`git remote -v`), pull, or push with `-u` |
| Merge conflict | Report conflicting files, offer to resolve or abort |
