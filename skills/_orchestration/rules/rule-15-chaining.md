# Rule 15: Workflow Chaining

After completing a workflow (Rule 5 step 5), check `.workflows/config.yml` → `chains`:
1. If a chain matches the completed workflow, ask: "Chain detected: run `<next-command>` next? (y/n)"
2. On yes: preserve the `.workflows/<feature>/` context directory and launch the chained workflow
3. On no: complete normally
