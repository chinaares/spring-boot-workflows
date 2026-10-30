# Rule 9: Skill Composition

When a workflow phase requires another skill's logic:
1. **Execute inline**: Read the target skill and execute its steps as sub-steps within the current phase
2. **Output routing**: Write to the CURRENT workflow's output directory
3. **State**: Do NOT create a separate state file — track as part of current phase
4. **Completion**: Continue with parent workflow's next phase
