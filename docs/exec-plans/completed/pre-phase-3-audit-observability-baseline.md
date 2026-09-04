# Gate previo a Fase 3 — ADR-019 Auditoría y observabilidad financiera

Status: Completed
Phase: Gate arquitectónico previo a Fase 3
Story: Baseline mínimo de auditoría, observabilidad y redacción

## Goal

Definir el baseline mínimo obligatorio de auditoría y observabilidad para operaciones financieras.
El resultado será ADR-019 en estado **Propuesto**; no se aceptará el ADR, iniciará Fase 3 ni se
implementará infraestructura productiva.

## Context / references

- [`AGENTS.md`](../../../AGENTS.md), [`project-state.md`](../../project-state.md),
  [`05-roadmap.md`](../../05-roadmap.md) y
  [`08-definition-of-done.md`](../../08-definition-of-done.md).
- [`04-architecture.md`](../../04-architecture.md),
  [`06-ai-behavior.md`](../../06-ai-behavior.md) y
  [`07-security-and-privacy.md`](../../07-security-and-privacy.md).
- ADR-003, ADR-004, ADR-008 y ADR-021 aceptados y obligatorios.
- `AuditEvent` actual y sus pruebas de atomicidad para hogares e invitaciones.

## Scope

- Comparar un registro unificado, señales separadas y auditoría externa/event-sourced.
- Definir audit trail, logs, métricas y tracing como señales con propósitos y datos distintos.
- Clasificar success, failure, retry, rollback, reversal, replacement y adjustment.
- Definir campos de trazabilidad desde preview e idempotencia hasta ledger y correcciones.
- Fijar allowlists y prohibiciones de datos por señal, incluida IA y jobs.
- Definir atomicidad, append-only, retención, investigación, RLS y acceso operacional.
- Validar la propuesta con PostgreSQL/PgBouncer y artefactos efímeros.
- Proponer `docs/adr/0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md`.

La hipótesis principal separa un audit trail tenant-scoped durable de telemetría técnica redactada.
Los hechos financieros confirmados comparten commit con preview, idempotencia y ledger; un fallo
revertido se observa fuera de esa transacción sin fingir que forma parte de la historia financiera.

## Out of scope

- Aceptar ADR-019 o iniciar Fase 3.
- Implementar cuentas, ledger, preview, idempotencia, auditoría financiera, telemetría o IA.
- Crear tablas, migraciones, contratos, endpoints, dashboards o dependencias.
- Fijar periodos legales definitivos de ADR-018 o infraestructura de beta de Fase 12.
- Commit o push.

## Acceptance criteria

- ADR-019 existe como **Propuesto** con alternativas, recomendación, amenazas, consecuencias,
  riesgos, adopción y decisiones humanas pendientes.
- Existe una taxonomía mínima y una matriz de campos/prohibiciones por señal.
- La cadena `operationId → previewId → idempotency record → transactionId → auditEventId` es
  reconstruible sin duplicar datos financieros.
- Posting y auditoría de éxito son atómicos; fallos y retries quedan clasificados sin crear hechos
  financieros falsos o duplicados.
- RLS, append-only, jobs, IA, soporte y retención respetan ADR-021 y privacidad por diseño.
- Las métricas son operacionales y de baja cardinalidad; no se convierten en analytics financieros.
- Los probes demuestran commit/rollback, aislamiento, append-only, correlación y redacción sin dejar
  artefactos.
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

No aplica validación móvil. ADR-019 requiere revisión humana y aceptación explícita posterior.

## Documentation updates

- Crear ADR-019 como **Propuesto**.
- Actualizar únicamente registro ADR, estado, índice, arquitectura, seguridad, IA y roadmap.
- Mantener las propuestas separadas de controles implementados y Fase 3 sin iniciar.

## Completion

Mover el plan a `completed/` únicamente cuando ADR-019 esté listo para revisión, los probes y la
verificación sean verdes y se confirme que código y persistencia productiva no cambiaron.

La revisión humana posterior deberá confirmar separación de señales, tratamiento durable de
fallos/denegaciones, política reference-only, relación de retención con ADR-018, acceso de soporte y
semántica causal de IA/jobs.

## Completion evidence

- `pnpm install --frozen-lockfile`: PASS; lockfile sin cambios.
- Probes efímeros de auditoría/observabilidad: 10/10 PASS con PostgreSQL 18.4 directo y 10/10 PASS
  mediante PgBouncer 1.25.2 en `pool_mode=transaction`. Los schemas, roles, contenedores, volúmenes
  e imagen temporal se eliminaron al finalizar.
- `pnpm test:rls:direct`: PASS, 26/26.
- `pnpm test:rls:pooler`: PASS, 9/9.
- `pnpm verify:full`: la primera invocación detectó correctamente que PostgreSQL local no estaba
  iniciado y se detuvo antes de ejecutar pruebas; después de levantar temporalmente `pnpm db:dev`,
  PASS con 195/195 pruebas generales, 141 unitarias, 28 de integración y 26 E2E, además de
  migraciones, lint, formato, typecheck, builds, OpenAPI, peers y Expo Doctor 21/21. El servicio
  temporal se cerró al terminar.
- Enlaces documentales y `git diff --check`: PASS.
- Diff en `apps`, `packages`, schema Prisma y migraciones productivas: vacío. El probe temporal fue
  eliminado.
- [ADR-019](../../adr/0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md) permanece
  **Propuesto** y listo para revisión humana. Fase 3 no fue iniciada.

## Seguimiento posterior — 2026-09-04

La evidencia anterior conserva el resultado de la investigación. Posteriormente el responsable
aceptó explícitamente ADR-019 con las decisiones registradas en el propio ADR. Esto cierra el gate
arquitectónico previo a Fase 3, sin iniciar su implementación.
