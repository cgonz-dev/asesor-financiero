# Gate previo a Fase 3 — Spike arquitectónico de PostgreSQL RLS

Status: Completed — 2026-09-02
Phase: Gate previo a Fase 3
Story: Spike obligatorio de RLS exigido por ADR-006

## Goal

Evaluar PostgreSQL Row-Level Security como defensa en profundidad para futuras tablas financieras
multi-household y terminar con una recomendación explícita `ADOPT`, `ADOPT WITH CONSTRAINTS` o
`DO NOT ADOPT`, sin iniciar Fase 3 ni modificar persistencia funcional.

## Context / references

- [`AGENTS.md`](../../../AGENTS.md)
- [`docs/project-state.md`](../../project-state.md)
- [`docs/05-roadmap.md`](../../05-roadmap.md)
- [`docs/07-security-and-privacy.md`](../../07-security-and-privacy.md)
- [`ADR-006`](../../adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [`docs/08-definition-of-done.md`](../../08-definition-of-done.md)
- PostgreSQL 18 Row Security Policies, `set_config`, Prisma 7 pooling/transacciones y PgBouncer
  transaction pooling.

## Scope

- Crear un schema efímero `rls_spike` con recursos ficticios no financieros y RLS sin tocar tablas
  actuales.
- Probar roles separados de bootstrap/owner/runtime/job, `ENABLE` + `FORCE ROW LEVEL SECURITY`,
  `USING`, `WITH CHECK`, membresía activa y fail-closed.
- Probar Prisma 7.9.1 con `@prisma/adapter-pg`, CRUD tipado, nested writes, interactive
  transactions, rollback y contexto transaccional parametrizado.
- Probar reutilización y concurrencia en el pool `pg`, más PgBouncer 1.25.2 real con
  `pool_mode=transaction`.
- Evaluar policies defectuosas, constraints cross-household/canales laterales, roles operacionales,
  migraciones, índices y adopción futura.
- Crear ADR-021 como propuesta con la recomendación y evidencia obtenidas.

## Out of scope

- `FinancialAccount`, ledger, dinero, saldos o cualquier tabla financiera.
- RLS sobre `User`, `Household`, `HouseholdMembership`, invitaciones o auditoría actuales.
- Auth0, mobile, contratos públicos, OpenAPI o autorización funcional.
- Aceptar automáticamente ADR-021, iniciar Fase 3, commit o push.

## Acceptance criteria

- El harness solo puede operar sobre la base local/CI permitida y elimina schema, roles y secretos
  efímeros aun ante error.
- Runtime y job son roles reales sin ownership, superuser ni `BYPASSRLS`; el owner `NOLOGIN`
  también queda sujeto mediante `FORCE RLS`.
- Sin contexto, con contexto parcial/malformado, User bloqueado o membership no activa, el acceso
  falla cerrado.
- Dos hogares permanecen aislados en SELECT/INSERT/UPDATE/DELETE, nested writes, rollback,
  concurrencia y reutilización del pool.
- `set_config(..., true)` y todas las consultas tenant-scoped ocurren en la misma interactive
  transaction y conexión.
- PgBouncer en modo transaccional no pierde contexto dentro de la transacción ni lo filtra a la
  siguiente.
- El harness detecta RLS/policies ausentes, deshabilitadas, sobreamplias o ignoradas.
- Se documentan constraints, canales laterales, rendimiento, migraciones, jobs, soporte, backups y
  límites de confianza.
- El schema Prisma y las migraciones de producción no reciben cambios.
- ADR-021 queda `Propuesto` con una de las tres recomendaciones y riesgos residuales; Fase 3 sigue
  bloqueada hasta revisión explícita.

## Required verification

- `pnpm install --frozen-lockfile`
- migraciones vigentes sobre PostgreSQL local autorizado
- `pnpm test:rls:direct`
- `pnpm test:rls:pooler`
- `pnpm verify:full`
- `git diff --check`
- comprobación de que no cambiaron schema/migraciones de producción

## Manual validation

No aplica UI ni Auth0. Registrar versiones reales, configuración de PgBouncer, matriz PASS/FAIL y
salida exacta de los comandos enfocados.

## Documentation updates

- ADR-021 y registro ADR.
- Arquitectura, seguridad, roadmap y `project-state.md` únicamente en lo afectado por el resultado.
- Este plan con evidencia de cierre.

## Implemented design

- Schema efímero `rls_spike` y cliente Prisma exclusivo del harness, sin cambios en el schema o
  migraciones de producción.
- Roles físicos separados: owner `NOLOGIN`, runtime API y job, todos sin superuser ni
  `BYPASSRLS`; el job ficticio solo recibió lectura.
- `ENABLE` + `FORCE RLS`, policy de hogar y membership activa, función `SECURITY DEFINER`
  endurecida, FKs compuestas e índices tenant-leading.
- `withRlsContext` valida UUID, aplica `set_config(..., true)` y entrega únicamente el
  `TransactionClient`, comprobando el mismo backend antes y después del trabajo.
- Runner desechable para pool `pg` directo y PgBouncer 1.25.2 real en
  `pool_mode=transaction`, con secretos efímeros y cleanup de contenedores/volúmenes en `finally`.
- Gates enfocados integrados a CI sin hacer que `pnpm verify:full` dependa de Docker anidado.

## Closure evidence — 2026-09-02

Versiones reales: PostgreSQL server 18.4; Prisma CLI, client y adapter 7.9.1; `pg` 8.23.0;
PgBouncer 1.25.2.

| Área | Resultado |
|---|---|
| Catálogo, roles, owner, grants, función y policies exactas | PASS |
| Fail-closed y aislamiento CRUD cross-household | PASS |
| User/membership no activa, `USING` y `WITH CHECK` | PASS |
| Nested write, rollback y FK compuesta | PASS |
| Pool directo reutilizado y concurrente | PASS |
| PgBouncer transaccional con un backend reutilizado | PASS |
| Job explícitamente acotado y admin como control negativo | PASS |
| Detección de RLS/policy defectuosa | PASS |
| Canal lateral de constraint global | PASS, riesgo demostrado |
| Índice tenant-leading en `EXPLAIN` | PASS |

- `pnpm install --frozen-lockfile`: PASS, lockfile sin cambios.
- Migraciones vigentes sobre el PostgreSQL desechable: PASS, 2/2 aplicadas y al día.
- `pnpm test:rls:direct`: PASS, 12/12.
- `pnpm test:rls:pooler`: PASS, 3/3.
- `pnpm verify:full`: PASS, 195/195 en 37 archivos, más lint, formato, typecheck, builds,
  OpenAPI, peers y Expo Doctor 21/21.
- `git diff --check`: PASS.
- Schema Prisma y migraciones de producción: sin cambios.

La recomendación resultante es **`ADOPT WITH CONSTRAINTS`** y se registra en
[ADR-021](../../adr/0021-postgresql-rls-para-aislamiento-multi-household.md) con estado
**Propuesto**. La principal investigación pendiente antes de aceptar el ADR es la semántica de
revocación concurrente de membership bajo `READ COMMITTED`; además se mantienen los gates de roles,
transacción contextual, catálogo, jobs y operación. Fase 3 no se inicia con este spike.

## Completion

Ambos perfiles de pooling y la matriz completa están verdes. La recomendación y sus restricciones
quedan documentadas sin aceptar automáticamente ADR-021, iniciar Fase 3 ni modificar persistencia
funcional. El plan se archiva en `completed/`.
