# Phase 2 logout update loop hotfix

Status: Completed
Phase: 2
Story: Maintenance defect; no new product story

## Goal

Remove the `Maximum update depth exceeded` cycle observed on Android logout while preserving Auth0,
the shared mobile runtime and the current visual design.

## Context / references

- [`../../../AGENTS.md`](../../../AGENTS.md)
- [`../../project-state.md`](../../project-state.md)
- [`../../../apps/mobile/AGENTS.md`](../../../apps/mobile/AGENTS.md)
- [`../../adr/0005-autenticacion-y-ciclo-de-sesion-movil.md`](../../adr/0005-autenticacion-y-ciclo-de-sesion-movil.md)
- [`../../mobile/design-system.md`](../../mobile/design-system.md)

## Scope

- Trace logout through Auth0/session state, `MobileAppProvider`, user-state cleanup and Expo Router.
- Replace competing authentication redirects with one root navigation decision.
- Remove duplicate user-state cleanup during logout.
- Add a regression test for cleanup, one navigation transition and render stability.

## Out of scope

- New product stories, routes, visual changes, backend, contracts, persistence or Auth0 behavior.
- Commit, push or deployment.

## Acceptance criteria

- Logout leaves the session unauthenticated and removes the internal user profile.
- Household and invitation memory is cleared once for the logout transition.
- Navigation changes from the authenticated area to access once.
- Repeated provider updates after cleanup do not produce another navigation transition or render
  cycle.

## Required verification

- Relevant mobile unit regression tests.
- `pnpm verify`.
- `git diff --check` as included by the verification harness.

## Manual validation

- The original Android failure is user-observed evidence. A post-fix physical-device run was not
  available to the agent and remains the recommended final confirmation.

## Documentation updates

- `docs/project-state.md`, `docs/04-architecture.md` and `docs/mobile/design-system.md` record the
  centralized root route protection and logout cleanup behavior.

## Completion

- Root navigation uses mutually exclusive `Stack.Protected` groups instead of redirects mounted in
  the session gate, authenticated layout and modals.
- `MobileAppProvider` delegates logout to the session coordinator; the existing session transition
  effect clears Household and invitation state once.
- The regression mounts the provider and proves session/profile cleanup, Household/invitation
  cleanup, one authenticated-to-access target transition and stable render count afterward.
- Focused mobile tests: 27 passed in 4 files.
- `pnpm verify`: passed, including 130 unit tests, builds, OpenAPI, peers, Expo Doctor 21/21 and
  `git diff --check`.
- No commit or push was performed.
