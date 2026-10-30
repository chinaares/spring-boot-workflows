# Rule 17: Visual Progress

Generate a Mermaid state diagram in the **Progress section** of `.workflows/current-state.md`. This diagram is regenerated on every phase transition (Rule 0 init and Rule 1 updates).

**When to generate**: If `progress.visual` is `true` in `.workflows/config.yml` (default: `true`).

**How to generate**: Read the `phases` list from state frontmatter and the Phase History table. Build the diagram using these status-to-style mappings:

| Phase Status | Mermaid Style |
|---|---|
| `COMPLETED` | `classDef completed fill:#2da44e,color:#fff` (green) |
| `ACTIVE` | `classDef active fill:#bf8700,color:#fff` (amber) |
| `SKIPPED` | `classDef skipped fill:#656d76,color:#fff` (gray) |
| `FAILED` | `classDef failed fill:#cf222e,color:#fff` (red) |
| _(not yet started)_ | `classDef pending fill:#444c56,color:#adbac7` (dark gray) |

**Template** — generate a `mermaid stateDiagram-v2` block in the Progress section with `direction LR`:
- Transitions: `[*] --> PHASE-1 --> PHASE-2 --> ... --> PHASE-N --> [*]` (linear, no backward arrows)
- `classDef` lines: use hex values from the table above (add `,stroke:<same-color>` to each). Omit `classDef` for statuses with no phases.
- `class` lines: group all phases with the same status into one comma-separated declaration (e.g., `class GATHER,SPEC,PLAN completed`)

**Rules**:
- List phases in workflow order (from `phases` frontmatter field)
- Each `class` line groups ALL phases with the same status into one comma-separated declaration
- Omit `classDef` lines for statuses that have no phases (e.g., omit `failed` if nothing has failed)
- For REPLAN: if a phase transitions from `COMPLETED` back to `ACTIVE` via replan, mark it `active` again
- Keep transitions linear (`A --> B --> C`). Do not add backward arrows for replans — the Phase History table captures that detail

**Display to user**: After updating the state file, print a compact text summary instead of the raw Mermaid block (terminals don't render Mermaid):

```
Progress: ✓GATHER ✓SPEC ○BRAINSTORM ▶PLAN ·BRANCH ·IMPLEMENT ·TEST ·PR
```

Legend: ✓=completed, ▶=active, ○=skipped, ✗=failed, ·=pending
