# Phase 2 — Story 5: aislamiento, visibilidad y auditoría básica

Status: Completed — 2026-08-27  
Phase: 2  
Story: 5

## Goal

Validar y cerrar los gaps reales restantes de autorización de Fase 2 mediante policies de
visibilidad y aislamiento verificables, sin introducir recursos financieros ni cambiar el diseño
móvil vigente. Producir evidencia para decidir si Fase 2 está lista para cierre formal.

## Context / references

- [Project state](../../project-state.md)
- [Roadmap — Fase 2](../../05-roadmap.md#fase-2-autenticación-hogares-e-integrantes)
- [ADR-006](../../adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [Seguridad y privacidad](../../07-security-and-privacy.md)
- [Definition of Done](../../08-definition-of-done.md)
- [Sistema visual móvil](../../mobile/design-system.md)

## Scope completed

- Se auditó primero la implementación y se conservaron los controles ya demostrados de identidad,
  membership activa, roles, consultas acotadas, errores no enumerables e IDOR.
- Se implementaron policies puras con denegación por defecto para capabilities y lectura
  `Private`, `SelectedMembers` y `Household`.
- Se demostró que Owner administrativo no obtiene acceso a un recurso `Private` ajeno.
- Se exige `Active HouseholdMembership`, mismo hogar y capability aplicable.
- Se agregaron pruebas negativas de estados inactivos, referencias cross-household, capability
  ausente y valores desconocidos, usando al menos dos Users y dos Households ficticios.
- Se completó el gap de auditoría de `household.created` dentro de la misma transacción que
  Household y Owner membership.
- Se preservaron navegación, componentes, tokens y movimiento móvil.

## Out of scope preserved

- `FinancialAccount`, `FinancialTransaction`, ledger, importes, dinero o migraciones financieras.
- IA, tools, OpenAI o Fase 3.
- PostgreSQL RLS.
- Transferencia de Owner, expulsión, salida, `Admin` o co-owner.
- Nuevas capacidades de producto, endpoints, contratos, persistencia de recursos o pantallas.
- Rediseño mobile.

## Acceptance evidence

- La matriz pura combina acción, capability, membership, hogar, ownership y visibilidad.
- `Private` solo permite al propietario activo; Owner no tiene bypass administrativo.
- `SelectedMembers` permite al propietario o una membership activa seleccionada del mismo hogar.
- `Household` exige membership activa del mismo hogar y capability aplicable.
- Estados no activos, referencias cross-household y combinaciones desconocidas se deniegan.
- Las rutas de Fase 2 continúan derivando identidad autenticada y resolviendo policies en servidor.
- Los eventos exitosos `household.created`, `invitation.created`, `invitation.revoked` e
  `invitation.accepted` conservan actor, hogar, acción, resultado, recurso e instante sin token,
  hash o correo.
- Una falla al persistir `household.created` revierte también Household y membership.
- No cambiaron Prisma schema, migraciones, contratos, OpenAPI ni mobile.

## Verification completed

- `pnpm verify`: aprobado.
- `pnpm verify:full`: aprobado contra PostgreSQL local permitido y migraciones al día.
- General: 183 pruebas en 33 archivos.
- Unitarias: 129 pruebas en 24 archivos.
- Integración: 28 pruebas en 4 archivos.
- E2E: 26 pruebas en 5 archivos.
- Build, OpenAPI, peers, Expo Doctor 21/21 y `git diff --check`: aprobados.

## Manual validation

La aceptación de una invitación con una segunda identidad/dispositivo real continúa pendiente de
validación manual. No se afirma que fue validada. Su estado permanece en `project-state.md`.

## Completion and phase recommendation

Historia 5 está completa y satisface sus criterios automáticos. **Fase 2 no debe cerrarse todavía**:
falta registrar la validación manual con una segunda identidad/dispositivo. Después procede la
revisión formal de cierre; antes de introducir las primeras tablas financieras de Fase 3 debe
ejecutarse además el spike de RLS exigido por ADR-006.
