# Estado actual del proyecto

## Snapshot

- Fecha: 2026-08-27.
- Fase 1: cerrada.
- Fase 2: abierta; no se declara cerrada.
- Historias 1 a 4 de Fase 2: completadas.
- Historia 5 de Fase 2: todavía no iniciada; existe solo como
  [execution plan activo](exec-plans/active/phase-2-story-5.md).
- ADR aceptados: [ADR-001](adr/0001-idioma-y-vocabulario-canonico.md),
  [ADR-005](adr/0005-autenticacion-y-ciclo-de-sesion-movil.md),
  [ADR-006](adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md) y
  [ADR-007](adr/0007-contratos-validacion-openapi-y-cliente.md).

Este archivo es el snapshot operacional vigente. El [roadmap](05-roadmap.md) conserva dirección y
criterios; los [ADR](adr/README.md) conservan decisiones; los
[execution plans](exec-plans/README.md) describen trabajo concreto.

## Stack relevante

- Monorepo TypeScript con pnpm workspaces, Node.js 24 LTS y pnpm 11.9.0.
- React Native 0.86.2, Expo/Expo Router SDK 57 y development build Android.
- NestJS 11, REST `/api/v1`, Zod compartido y OpenAPI 3.1 reproducible.
- PostgreSQL 18/Prisma 7 con migraciones versionadas.
- Auth0 OAuth 2.0/OIDC, Authorization Code + PKCE, access tokens RS256 y Credentials Manager.

## Implementado

- Bootstrap, CI, health/readiness, OpenAPI y cliente REST tipado.
- Identidad interna por `issuer + subject`, sesión móvil segura, restauración, `/me` y logout.
- Hogares, membresías Owner/Member, creación, listado, selección y persistencia UX revalidada.
- Invitaciones dirigidas, opacas, expirables, revocables y de un solo uso; aceptación atómica,
  incorporación `Member Active` y auditoría mínima de invitaciones.
- Aislamiento inicial de endpoints Household mediante membresía activa y policy de capacidad.
- App móvil en modo oscuro con Manrope, tabs `Inicio`/`Hogar`/`Perfil`, modales, safe areas,
  manejo de teclado, microinteracciones y Reduce Motion. La fuente visual es
  [`docs/mobile/design-system.md`](mobile/design-system.md).

## Baseline de calidad

Última línea base registrada antes de crear Harness 1.0:

- 174 pruebas aprobadas en 32 archivos;
- Expo Doctor 21/21;
- lint, formato, typecheck, build web, OpenAPI, peers y `git diff --check` en verde;
- Auth0 Android, consulta de perfil, hogares e invitaciones cubiertos por pruebas automatizadas;
- GitHub Actions configurado con PostgreSQL efímero y sin depender de Auth0 real.

La interfaz reutilizable de verificación se documenta en
[`docs/exec-plans/README.md`](exec-plans/README.md).

## Deuda de validación manual

La aceptación de una invitación con una segunda identidad/dispositivo real continúa pendiente de
validación manual. No se afirma que haya sido validada manualmente. El flujo está cubierto por
pruebas automatizadas.

Esta deuda debe permanecer visible al evaluar el cierre formal de Fase 2.

## Todavía no implementado

- Historia 5: policy completa `Private` / `SelectedMembers` / `Household`, gaps finales de
  aislamiento y auditoría básica transversal.
- Cuentas financieras, saldos, `FinancialTransaction`, ledger, dinero y migraciones financieras.
- Fases 3 en adelante, incluida IA, tools, presupuestos, tarjetas, conciliación y dashboard.
- PostgreSQL RLS, administración avanzada de integrantes, transferencia de Owner, expulsión,
  salida, `Admin` o co-owners.
- Despliegue productivo, publicación en tiendas, integraciones bancarias y pagos reales.

