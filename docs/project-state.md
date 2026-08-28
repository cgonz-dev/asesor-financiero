# Estado actual del proyecto

## Snapshot

- Fecha: 2026-08-27.
- Fase 1: cerrada.
- Fase 2: abierta; no se declara cerrada.
- Historias 1 a 5 de Fase 2: completadas.
- Historia 5 completó policies puras de visibilidad, pruebas negativas y el gap de auditoría de
  creación de Household; su [plan y evidencia](exec-plans/completed/phase-2-story-5.md) están
  archivados.
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
- Policy pura y con denegación por defecto para lectura `Private`, `SelectedMembers` y `Household`:
  exige membership activa, mismo hogar y capability; Owner no obtiene bypass sobre `Private`.
- Auditoría atómica exitosa para `household.created`, `invitation.created`, `invitation.revoked` e
  `invitation.accepted`, sin secretos, hashes ni correo.
- App móvil en modo oscuro con Manrope, tabs `Inicio`/`Hogar`/`Perfil`, modales, safe areas,
  manejo de teclado, microinteracciones y Reduce Motion. La fuente visual es
  [`docs/mobile/design-system.md`](mobile/design-system.md).
- Logout móvil con limpieza única del contexto de User y protección centralizada de rutas en el
  Stack raíz; se eliminó el ciclo de redirects que podía producir `Maximum update depth exceeded`
  en Android.

## Baseline de calidad

Línea base verificada al completar Historia 5:

- 183 pruebas aprobadas en 33 archivos;
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

## Recomendación de cierre de Fase 2

Los gaps automáticos de Historia 5 están resueltos, pero **Fase 2 no debe cerrarse todavía**. Falta
la validación manual con segunda identidad/dispositivo descrita arriba. Después de registrar esa
evidencia procede una revisión formal de cierre; antes de crear tablas financieras de Fase 3 debe
ejecutarse además el spike de RLS exigido por ADR-006.

## Todavía no implementado

- Persistencia, contratos, endpoints o UI para recursos con visibilidad; la policy existe como
  regla pura no financiera hasta que una fase posterior introduzca un recurso real.
- Cuentas financieras, saldos, `FinancialTransaction`, ledger, dinero y migraciones financieras.
- Fases 3 en adelante, incluida IA, tools, presupuestos, tarjetas, conciliación y dashboard.
- PostgreSQL RLS, administración avanzada de integrantes, transferencia de Owner, expulsión,
  salida, `Admin` o co-owners.
- Despliegue productivo, publicación en tiendas, integraciones bancarias y pagos reales.
