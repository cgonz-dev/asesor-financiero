# Gate previo a Fase 3 — ADR-004 Preview y confirmación financiera

Status: Completed — 2026-09-04
Phase: Gate arquitectónico previo a Fase 3
Story: Estados, preview, confirmación y correcciones

## Goal

Definir y validar el flujo intención → comando validado → preview inmutable/versionado →
confirmación explícita → idempotencia → posting atómico al ledger. El resultado será ADR-004 en
estado **Propuesto**; no se aceptará el ADR ni se iniciará Fase 3.

## Context / references

- [`AGENTS.md`](../../../AGENTS.md), [`project-state.md`](../../project-state.md),
  [`05-roadmap.md`](../../05-roadmap.md) y [`08-definition-of-done.md`](../../08-definition-of-done.md).
- [`02-domain-rules.md`](../../02-domain-rules.md), [`04-architecture.md`](../../04-architecture.md),
  [`06-ai-behavior.md`](../../06-ai-behavior.md) y
  [`07-security-and-privacy.md`](../../07-security-and-privacy.md).
- ADR-002, ADR-003, ADR-008, ADR-009 y ADR-021 aceptados y obligatorios.

## Scope

- Comparar snapshot persistido inmutable, token firmado autocontenido y recálculo al confirmar.
- Definir identidad, versionado, digest, estados, expiración e invalidación de previews.
- Definir qué operaciones requieren confirmación y qué cambios obligan a una nueva versión.
- Vincular confirmación UI/IA, replay, double submit y retry con ADR-008.
- Definir correcciones, reversals, replacements y adjustments sin mutar ledger confirmado.
- Validar concurrencia, autorización y RLS mediante probes efímeros en PostgreSQL/PgBouncer.
- Proponer `docs/adr/0004-estados-preview-confirmacion-y-correcciones.md`.

La hipótesis principal usa `operationId` estable, `previewId` por versión, snapshot persistido,
digest canónico, TTL inicial de 15 minutos, vínculo al mismo actor/hogar y consumo único.

## Out of scope

- Aceptar ADR-004 o iniciar Fase 3.
- Implementar cuentas, ledger, dinero, contratos, endpoints, UI o IA financiera.
- Cambiar código, schema Prisma, migraciones o persistencia productiva.
- Resolver el baseline de ADR-019, retención general de ADR-018 o persistencia de borradores de
  ADR-011.
- Commit o push.

## Acceptance criteria

- ADR-004 existe como **Propuesto** con alternativas, recomendación, state machine, matriz de
  invalidación, errores públicos, amenazas, consecuencias y adopción.
- Quedan inequívocos identidad/versionado, TTL, actor/hogar, consumo único, fingerprint,
  confirmación UI/IA y operaciones que requieren preview.
- La confirmación reautoriza y revalida dentro de `withRlsContext(..., { intent: 'write' })` según
  ADR-021 antes de reclamar idempotencia y hacer posting.
- Misma clave/intención no duplica; reutilización incompatible y replay tienen resultados estables.
- Correcciones agregan historia y no mutan entradas confirmadas.
- Los probes demuestran expiración, invalidación, concurrencia, rollback, replay, RLS y relaciones
  de corrección sin dejar artefactos.
- No existe diff en código, contratos, schema Prisma o migraciones y Fase 3 sigue sin iniciar.

## Required verification

1. Registrar `git status --short` y preservar cambios preexistentes.
2. `pnpm install --frozen-lockfile`.
3. Probes temporales directos y mediante PgBouncer.
4. `pnpm test:rls:direct`.
5. `pnpm test:rls:pooler`.
6. `pnpm verify:full`.
7. Revisar enlaces y estados documentales.
8. `git diff --check`.
9. Confirmar diff vacío en código, contratos, schema Prisma y migraciones.

## Manual validation

No aplica validación móvil. ADR-004 requiere revisión humana y aceptación explícita posterior.

## Documentation updates

- Crear ADR-004 como **Propuesto**.
- Actualizar únicamente registro ADR, estado, arquitectura, dominio, IA, seguridad y roadmap.
- Mantener ADR-019 como gate y no presentar la propuesta como funcionalidad implementada.

## Completion

Mover el plan a `completed/` únicamente cuando ADR-004 esté listo para revisión, los probes y la
verificación sean verdes y se confirme que Fase 3 y la persistencia productiva no cambiaron.

La revisión humana posterior deberá confirmar snapshot persistido, TTL de 15 minutos, vínculo al
mismo actor, replay con otra clave, allowlist de metadata y catálogo de operaciones confirmables.

### Evidence

- `pnpm install --frozen-lockfile`: PASS; lockfile sin cambios.
- Probe efímero de preview/confirmación sobre PostgreSQL 18.4 y pool directo: 10/10 PASS.
- El mismo probe mediante PgBouncer 1.25.2 en `pool_mode=transaction`: 10/10 PASS.
- `pnpm test:rls:direct`: 26/26 PASS.
- `pnpm test:rls:pooler`: 9/9 PASS.
- `pnpm verify:full`: PASS después de iniciar el PostgreSQL local requerido; matriz general 195/195,
  unitarias 141/141, integración 28/28, E2E 26/26 y Expo Doctor 21/21, además de migraciones, lint,
  formato, typecheck, builds, OpenAPI, peers y whitespace.
- Los probes limpiaron schema, roles, contenedores, redes, volúmenes y archivos temporales en
  `finally`.
- El diff final no contiene cambios en código, contratos, schema Prisma ni migraciones productivas.
- ADR-004 queda **Propuesto** para revisión humana; ADR-019 continúa pendiente y Fase 3 no inició.
