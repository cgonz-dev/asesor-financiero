# Gate previo a Fase 3 — Revocación concurrente de membresías bajo RLS

Status: Completed — 2026-09-02
Phase: Gate previo a Fase 3
Story: Cierre del riesgo concurrente pendiente de ADR-021

## Goal

Demostrar con PostgreSQL 18.4 real la semántica de revocación concurrente de
`HouseholdMembership` bajo `READ COMMITTED` y cerrar el riesgo pendiente de ADR-021 sin aceptar el
ADR, iniciar Fase 3 ni modificar producción.

## Context / references

- [`AGENTS.md`](../../../AGENTS.md)
- [`project-state.md`](../../project-state.md)
- [ADR-006](../../adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [ADR-021](../../adr/0021-postgresql-rls-para-aislamiento-multi-household.md)
- [Spike RLS completado](../completed/pre-phase-3-postgresql-rls-spike.md)
- [PostgreSQL — Transaction Isolation](https://www.postgresql.org/docs/18/transaction-iso.html)
- [PostgreSQL — Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL — Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [Prisma — Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [PgBouncer — Configuration](https://www.pgbouncer.org/config.html)

## Scope

- Reutilizar exclusivamente el schema efímero `rls_spike`, sus recursos ficticios y roles
  desechables.
- Probar en pool directo y PgBouncer las transiciones `Suspended`, `Left` y `Removed` mientras una
  interactive transaction tenant-aware permanece abierta.
- Demostrar snapshots por statement, reevaluación de la policy, una carrera dentro de un statement
  y rollback de trabajo parcial.
- Comparar `READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`, revalidación aislada y locking.
- Prototipar en el harness un lock `FOR SHARE` de la membresía activa para operaciones de escritura.
- Terminar con la decisión `RESOLVED` o `UNRESOLVED` y actualizar solo la evidencia necesaria.

## Out of scope

- `FinancialAccount`, ledger, dinero, saldos o tablas financieras.
- RLS productivo o cambios en schema Prisma/migraciones funcionales.
- Auth0, mobile, endpoints, contratos públicos o autorización funcional vigente.
- Aceptar ADR-021, iniciar Fase 3, commit o push.

## Acceptance criteria

- Bajo `READ COMMITTED`, cada statement posterior al commit de revocación falla cerrado para las
  tres transiciones, mientras un statement ya iniciado conserva su snapshot anterior.
- La carrera RLS documentada por PostgreSQL se reproduce como control y queda cerrada por un lock
  endurecido `FOR SHARE`, no `FOR KEY SHARE`.
- Si la operación bloquea primero, la revocación espera y queda ordenada después; si la revocación
  confirma primero, la operación se deniega sin escrituras parciales.
- El patrón funciona con Prisma interactive transactions y PgBouncer transaccional, y commit,
  rollback y reutilización liberan lock y contexto.
- Revalidación sin lock, otros niveles de aislamiento y constraints quedan evaluados con evidencia.
- El runtime no obtiene acceso directo a membresías y no cambian schema ni migraciones de
  producción.
- ADR-021 permanece `Propuesto`; solo queda listo para revisión explícita si la matriz completa
  resulta `RESOLVED`.

## Required verification

1. Registrar y preservar `git status --short`.
2. `pnpm install --frozen-lockfile`.
3. `pnpm test:rls:direct`.
4. `pnpm test:rls:pooler`.
5. `pnpm verify:full`.
6. `git diff --check`.
7. Confirmar por diff que schema Prisma y migraciones de producción no cambiaron.

## Manual validation

No aplica. La evidencia requiere PostgreSQL y PgBouncer reales, pero es automatizada y
determinista.

## Documentation updates

Con resultado `RESOLVED`, actualizar ADR-021, `project-state.md`, arquitectura, seguridad, roadmap
y la documentación mínima del harness; mantener ADR-021 `Propuesto` y Fase 3 bloqueada hasta su
revisión explícita.

## Completion

Decisión: **RESOLVED**.

Evidencia observada:

- `READ COMMITTED` reevalúa la membresía en cada statement nuevo; después del commit de
  `Suspended`, `Left` o `Removed`, las lecturas y escrituras posteriores fallan cerrado.
- Un statement iniciado antes de la revocación conserva su snapshot. El harness reprodujo la
  carrera documentada por PostgreSQL cuando una policy consulta otra tabla.
- Las escrituras tenant-aware adquieren `FOR SHARE` sobre la membresía activa mediante una función
  `SECURITY DEFINER` endurecida y propiedad de un rol `NOLOGIN` dedicado. Si la operación bloquea
  primero, la revocación espera; si la revocación confirma primero, la operación se deniega.
- Rollback y timeout liberan el lock, no dejan escritura parcial y el contexto transaccional no se
  filtra al reutilizar conexiones.
- `REPEATABLE READ`, `SERIALIZABLE`, una revalidación sin lock y constraints estáticas no sustituyen
  el patrón `READ COMMITTED + FOR SHARE`.
- El comportamiento coincide con pool directo y PgBouncer 1.25.2 en `pool_mode=transaction`.
- El runtime no recibió lectura ni actualización directa de membresías.

Resultados finales:

- `pnpm install --frozen-lockfile`: PASS.
- `pnpm test:rls:direct`: PASS, 26/26.
- `pnpm test:rls:pooler`: PASS, 9/9.
- `pnpm verify:full`: PASS; 195/195 generales, 141/141 unitarias, 28/28 integración,
  26/26 E2E, builds, OpenAPI, peers y Expo Doctor 21/21.
- `git diff --check`: PASS; solo advertencias informativas LF/CRLF.
- Diff de `apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations`: vacío.

ADR-021 permanece **Propuesto** y queda listo para revisión explícita. No se inició Fase 3 ni se
modificó producción.
