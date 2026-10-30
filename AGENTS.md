# Repository agent instructions

## Architecture documentation is a required part of every change
- Keep `docs/system-flow.md` synchronized with the **actual implementation** whenever changes affect user journeys, API boundaries, authentication/authorization, roles, salon isolation, booking/availability, appointment state transitions, background jobs, persistence, infrastructure or deployment.
- Before modifying a relevant flow, read `docs/system-flow.md` and the affected source code. Update the Mermaid diagram(s) and explanatory notes in the same change/PR; do not postpone documentation to a later task.
- Verify diagrams against code rather than assuming planned features are already implemented. Label conceptual or future behavior explicitly. Never invent endpoints, integrations, transitions or guarantees.
- Keep the top-level one-glance flow short; retain detailed diagrams for architecture, booking, OTP and appointment states.
- When a change does not affect these flows, no diagram edit is required; in the PR summary say "system-flow unchanged" with a reason.
- Review `docs/README.md` links when moving/renaming documentation.
- Before completion, inspect `git diff -- docs/system-flow.md` and check that Mermaid syntax remains valid.
- This policy applies to future agent-assisted edits; it is not a background auto-update mechanism. Human/manual changes must follow the same checklist.
