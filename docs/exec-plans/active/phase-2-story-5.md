# Phase 2 — Story 5: aislamiento, visibilidad y auditoría básica

Status: Active — not started  
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

## Scope

- Auditar primero la implementación de Fase 2 y enumerar gaps reales; no duplicar controles ya
  demostrados.
- Implementar policies puras y denegación por defecto para `Private`, `SelectedMembers` y
  `Household` en el nivel mínimo no financiero que permita probar ADR-006.
- Demostrar que Owner administrativo no obtiene acceso a un recurso `Private` ajeno.
- Exigir `Active HouseholdMembership` y compatibilidad de hogar en cada decisión.
- Completar pruebas negativas de acceso cruzado, membresía no activa, rol, ownership, audiencia y
  referencias manipuladas.
- Completar auditoría básica de las acciones sensibles de Fase 2 que realmente existan, con datos
  mínimos y sin secretos.
- Revisar evidencia y emitir una recomendación explícita de cierre o no cierre de Fase 2.
- Preservar navegación, componentes, tokens y movimiento descritos en el sistema visual móvil.

## Out of scope

- `FinancialAccount`, `FinancialTransaction`, ledger, importes, dinero o migraciones financieras.
- IA, tools, OpenAI o Fase 3.
- PostgreSQL RLS.
- Transferencia de Owner, expulsión, salida, `Admin` o co-owner.
- Nuevas capacidades de producto, endpoints o pantallas no indispensables para los gaps verificados.
- Rediseño mobile.

## Acceptance criteria

- Existe una matriz pequeña y comprobable de acción, membresía, ownership y visibilidad.
- `Private` solo permite al propietario activo; Owner no tiene bypass administrativo.
- `SelectedMembers` exige propietario o integrante activo seleccionado del mismo hogar.
- `Household` exige membresía activa del mismo hogar y la capacidad aplicable.
- Todo estado no activo, recurso cross-household o combinación desconocida se deniega.
- Las rutas/casos de uso de Fase 2 siguen usando identidad autenticada y policies del servidor.
- Acciones sensibles implementadas producen auditoría mínima sin token, hash, correo completo ni
  datos privados innecesarios.
- Pruebas negativas cubren al menos dos usuarios y dos hogares.
- Contratos, OpenAPI y migraciones solo cambian si un gap real lo exige y se mantienen sincronizados.
- El sistema visual y el comportamiento móvil existente no cambian.
- El reporte final determina, con evidencia, si Fase 2 puede cerrarse; no la cierra por inferencia.

## Required verification

- `pnpm install --frozen-lockfile` cuando el entorno no tenga una instalación verificada.
- `pnpm verify`
- `pnpm verify:full` con PostgreSQL local/CI permitido.
- Revisión explícita de autorización, aislamiento, auditoría, secretos, OpenAPI y migraciones.

## Manual validation

La aceptación de una invitación con una segunda identidad/dispositivo real continúa pendiente de
validación manual. No se afirmará que fue validada sin ejecutar la prueba. Su estado se mantendrá en
`project-state.md` y en la recomendación de cierre de Fase 2.

## Documentation updates

- Actualizar `docs/project-state.md` con resultados reales.
- Actualizar roadmap, arquitectura y seguridad solo donde cambie estado/evidencia.
- Mover este plan a `completed/` únicamente cuando satisfaga la DoD.

## Completion

La historia termina cuando las policies, auditoría y pruebas negativas de este plan estén
implementadas y verificadas, y exista una recomendación explícita de cierre. Cualquier gap, prueba
manual o decisión pendiente debe quedar registrado; no iniciar Fase 3.

