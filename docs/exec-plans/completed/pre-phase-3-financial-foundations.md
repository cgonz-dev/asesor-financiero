# Gate previo a Fase 3 — Fundamentos financieros

Status: Completed — 2026-09-03
Phase: Gate arquitectónico previo a Fase 3
Story: Decisiones fundamentales de Money, Ledger, Idempotency y Date & Time

## Goal

Investigar, contrastar y validar las decisiones financieras fundamentales antes de crear modelos,
contratos, endpoints o migraciones financieras. El resultado serán ADR-002, ADR-003, ADR-008 y
ADR-009 en estado **Propuesto**; no se aceptará ninguno ni se iniciará Fase 3.

## Context / references

- [`AGENTS.md`](../../../AGENTS.md), [`project-state.md`](../../project-state.md) y
  [`05-roadmap.md`](../../05-roadmap.md).
- [`02-domain-rules.md`](../../02-domain-rules.md), [`04-architecture.md`](../../04-architecture.md),
  [`07-security-and-privacy.md`](../../07-security-and-privacy.md) y
  [`08-definition-of-done.md`](../../08-definition-of-done.md).
- ADR-006, ADR-007 y ADR-021 aceptados. Las restricciones RLS de ADR-021 son obligatorias.
- Runtime vigente: Node 24, PostgreSQL 18.4, Prisma/adapter 7.9.1, `pg` 8.23.0 y Zod 4.4.3.

## Scope

- Investigar fuentes primarias y la implementación actual.
- Comparar alternativas reales, ventajas, costos, riesgos y reversibilidad.
- Ejecutar probes desechables, sin artefactos de producción, para validar los puntos técnicos que
  no deban resolverse solo por documentación.
- Proponer:
  - ADR-002: representación monetaria, moneda, redondeo y división;
  - ADR-009: fechas financieras, zonas horarias y periodos;
  - ADR-003: ledger, signos, cuentas técnicas e invariantes;
  - ADR-008: idempotencia, concurrencia y alcance de claves.
- Documentar dependencias, riesgos, preguntas abiertas, orden de aceptación y gates restantes.

### ADR-002 — Money

Comparar minor units, decimal exacto y una estrategia híbrida. Definir una recomendación concreta
para TypeScript, Prisma/PostgreSQL, Zod/JSON/OpenAPI, `currency`, precisión, límites, overflow,
redondeo, división/residuos, agregaciones y errores por monedas incompatibles. Validar round-trip,
límites, signos, exponentes 0/2/3, sumas y divisiones exactas. Las conversiones y FX permanecen
diferidas.

### ADR-009 — Date & Time

Comparar instantes únicamente frente a un modelo híbrido de instantes UTC, fechas civiles y zonas
IANA. Definir `occurredAt`, `recordedAt`, `effectiveDate`, `dueDate`, formatos contractuales,
precedencia de zonas, hechos sin hora, quincenas, cierres, fin de mes, año bisiesto, recurrencias,
DST y cambio de zona sin reescribir historia. Validar fechas civiles, límites de calendario y gaps/
folds de DST.

### ADR-003 — Ledger

Comparar importes firmados, débito/crédito y lado contable explícito. Definir la cabecera
`FinancialTransaction`, sus `LedgerEntry`, balance por moneda, signos, cuentas técnicas,
enforcement de dominio/DB, inmutabilidad, reversals/replacements/adjustments, saldos derivados,
atomicidad e interacción con ADR-006/ADR-021. Validar balance, desbalance, rollback, moneda,
transferencia, retiro, pago de tarjeta, reversión y cruces entre hogares mediante probes
desechables.

### ADR-008 — Idempotency

Comparar clave en header, body y derivación por servidor. Definir formato, entropía, scope,
fingerprint, concurrencia, conflictos, doble submit, retries HTTP/IA, estados, retención,
expiración, constraints y orden con autenticación, autorización, ledger y RLS. Validar concurrencia,
payload incompatible, rollback, respuesta perdida y reintento.

## Out of scope

- Implementar o aceptar automáticamente los ADR propuestos.
- `FinancialAccount`, `FinancialTransaction`, `LedgerEntry`, balances, gastos, ingresos,
  transferencias, categorías, presupuestos, IA, endpoints o UI financiera.
- Nuevas migraciones o cambios al schema Prisma de producción.
- Iniciar Fase 3, aceptar ADR-004/ADR-019, commit o push.

## Acceptance criteria

- Los cuatro ADR existen en estado **Propuesto** con alternativas, recomendación, consecuencias,
  riesgos, evidencia y estrategia de adopción.
- Money y Date & Time se resuelven primero; Ledger depende de ambos e Idempotency depende de los
  tres.
- Las propuestas son coherentes con ADR-006, ADR-007 y las restricciones obligatorias de ADR-021.
- Se identifican las decisiones humanas pendientes y ADR-004/ADR-019 permanecen como gates.
- La documentación distingue propuesta de decisión aceptada y Fase 3 continúa sin iniciar.
- No existe cambio en contratos, código funcional, schema Prisma o migraciones de producción.

## Required verification

1. `git status --short` y registro de cambios preexistentes.
2. `pnpm install --frozen-lockfile`.
3. Probes temporales y matrices de evidencia de los cuatro ADR.
4. `pnpm verify:full`.
5. `git diff --check`.
6. Diff explícito de `apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations/`.
7. Revisión de enlaces, estados y dependencias documentales.

## Manual validation

No aplica una validación móvil. Cada ADR requiere revisión humana y aceptación explícita posterior.

## Documentation updates

- Crear ADR-002, ADR-003, ADR-008 y ADR-009 como **Propuesto**.
- Actualizar registro ADR, estado, arquitectura, dominio, roadmap y seguridad solo donde cambie el
  estado documental o deban enlazarse dependencias.
- No presentar las recomendaciones como vigentes mientras no sean aceptadas.

## Completion

Mover el plan a `completed/` únicamente cuando los cuatro ADR estén listos para revisión, la
evidencia y verificaciones sean verdes y se confirme que Fase 3, schema y migraciones no cambiaron.

Resultado al completar el plan: **COMPLETED**. Los cuatro ADR se entregaron **Propuestos** para
aceptación humana individual; la revisión posterior se registra al final de este documento.

### Recomendaciones producidas

- ADR-002 propone minor units en `bigint`/`BIGINT`, moneda explícita, contrato JSON string,
  `ROUND_HALF_EVEN` para resultados derivados y reparto determinista de residuos.
- ADR-009 propone separar instantes UTC, fechas civiles y zonas IANA; periodos civiles semiabiertos
  y resolución explícita de gaps/folds de DST.
- ADR-003 propone entradas firmadas, mínimo dos cuentas, balance cero por moneda, inmutabilidad,
  reversals y un constraint trigger diferible como defensa adicional de PostgreSQL.
- ADR-008 propone `Idempotency-Key` opaca, scope por hogar/actor/operación, fingerprint canónico y
  claim confirmado atómicamente con ledger y auditoría.

El orden de revisión es ADR-002 + ADR-009, ADR-003 y finalmente ADR-008. ADR-004 y el baseline de
ADR-019 permanecen gates separados. ADR-006/ADR-021 son restricciones transversales obligatorias.

### Evidencia técnica

Los probes desechables, ejecutados sin crear artefactos productivos, validaron sobre PostgreSQL
18.4 y Prisma/adapter 7.9.1:

- round-trip exacto de `numeric`/`BIGINT`, suma, límites, exponentes y división con residuos;
- fechas civiles, febrero bisiesto, fin de mes y diferencias de gaps/folds DST;
- commit balanceado, rechazo diferible de desbalance, rollback completo y FK compuesta tenant;
- concurrencia idempotente, fingerprint incompatible, rollback, respuesta perdida y scope por
  actor.

### Verificación final

- `git status --short`: baseline inicial limpio; al cierre solo existen los cambios documentales
  de este plan.
- `pnpm install --frozen-lockfile`: PASS, lockfile sin cambios.
- Probes temporales Money/Date & Time/Ledger/Idempotency: PASS; recursos efímeros eliminados.
- `pnpm verify:full`: PASS; migraciones al día, 195/195 pruebas generales, suites unitarias,
  integración y E2E, lint, formato, typecheck, builds, OpenAPI, peers y Expo Doctor 21/21.
- Revisión de enlaces relativos y estados ADR: PASS.
- `git diff --check`: PASS, solo advertencias informativas LF/CRLF.
- Diff de `apps/api/prisma/schema.prisma` y `apps/api/prisma/migrations/`: vacío.

No se implementaron cuentas, ledger, dinero, endpoints, UI o migraciones; Fase 3 sigue sin iniciar.

### Revisión posterior

El 4 de septiembre de 2026, después de solicitar e incorporar cambios acotados, el responsable del
proyecto aceptó explícitamente ADR-002 y ADR-009. ADR-002 adoptó residuos rotativos deterministas
por operación; ADR-009 distinguió el ciclo semi-monthly predeterminado de una invariante y fijó
anclaje mensual sin drift. Más tarde ese mismo día, el responsable aceptó explícitamente ADR-003
y ADR-008. Los cuatro fundamentos están **Aceptados**; ADR-004 y el baseline de ADR-019 permanecen
como gates. Esta revisión no inició Fase 3 ni implementó funcionalidad financiera.
