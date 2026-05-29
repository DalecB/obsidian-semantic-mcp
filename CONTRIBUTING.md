# Contributing

This project is pre-1.0. Keep changes small, testable, and biased toward vault safety.

## Local Checks

```bash
npm test
npm pack --dry-run
```

## Safety Rules

- Do not add tools that write to, patch, move, rename, or delete vault notes.
- Do not write generated data inside the Obsidian vault.
- Keep `.obsidian/**`, hidden folders, and sensitive paths excluded by default.
- Any sensitive-path access must require explicit server-side opt-in.

## Pull Requests

Include:

- the problem being fixed
- the behavior change
- tests or a reason tests are not applicable
- any safety or privacy impact
