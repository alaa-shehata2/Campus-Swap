# CampusSwap — AI Engineering Rules

## Project

CampusSwap is a web platform where university students exchange
skills and physical items without money.

The system allows students to:

- create offers
- create requests
- discover compatible listings
- propose exchanges
- schedule exchanges
- complete exchanges
- leave reputation/reviews
- report problematic users or listings

## Engineering Principles

- Requirements come before implementation.
- Architecture comes before large-scale coding.
- Prefer simple solutions over unnecessary complexity.
- Do not introduce technologies without justification.
- Keep the application modular and maintainable.
- Avoid premature microservices.
- Avoid unnecessary infrastructure.
- Every behavioral change should have appropriate tests.
- Security must be considered during design, not after implementation.
- Documentation should reflect the actual implementation.

## AI Agent Rules

Before changing code:

1. Read the relevant requirements.
2. Read relevant architecture documentation.
3. Inspect the existing implementation.
4. Identify affected components.
5. Identify relevant tests.
6. Explain the proposed approach.

For web UI changes, also read `docs/web-ui-standards.md`. Web routes must use
the shared full-screen marketplace shell, fluid grid, responsive filter
patterns, and accessibility/state checklist defined there.

During implementation:

- Do not rewrite unrelated code.
- Do not silently change architectural decisions.
- Do not add dependencies without justification.
- Do not remove tests to make them pass.
- Do not disable validation or security controls to bypass problems.
- Keep changes focused and reviewable.

After implementation:

1. Run tests.
2. Run linting/static analysis where available.
3. Verify the change against its acceptance criteria.
4. Update documentation when necessary.
5. Report remaining risks or known limitations.

## Git Rules

- Work on feature/fix branches.
- Keep commits focused.
- Do not commit generated secrets.
- Do not modify unrelated files.
- Pull requests should explain what changed and why.

## Human Authority

The human developer is the final authority over:

- product requirements
- architecture
- security decisions
- technology choices
- scope
- merging changes

AI suggestions must be reviewed before being accepted.
