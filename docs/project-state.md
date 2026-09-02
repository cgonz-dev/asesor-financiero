# Estado actual del proyecto

## Snapshot

- Fecha: 2026-09-02.
- Fase 1: cerrada.
- Fase 2: cerrada formalmente el 2 de septiembre de 2026.
- Historias 1 a 6 de Fase 2: completadas.
- La validación manual real de invitaciones con una segunda identidad/dispositivo Android fue
  completada correctamente; la deuda registrada de Historia 4 queda cerrada.
- Historia 6 completó la experiencia Google-only, su validación en Auth0/Android real y la matriz
  automática completa. Su [plan y evidencia](exec-plans/completed/phase-2-story-6.md) están
  archivados.
- El [plan de cierre formal](exec-plans/completed/phase-2-formal-closure.md) confirmó la evidencia
  de toda la fase; Fase 3 no se inicia con este cierre.
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
- Validación manual Android de una invitación dirigida con segunda identidad: después de conectar
  correctamente la Post Login Action de Auth0, el access token incluyó el correo verificado, la
  invitación vigente se aceptó y el flujo dejó la sesión activa sin debilitar la validación.
- Pantalla propia de acceso con una sola acción `Continuar con Google`; conexión
  `google-oauth2` fijada dentro del adaptador Auth0, botón oficial accesible y bloqueo de doble
  toque. Auth0 conserva PKCE, audience, Credentials Manager, refresh y logout.

## Baseline de calidad

Línea base verificada al completar Historia 5:

- 183 pruebas aprobadas en 33 archivos;
- Expo Doctor 21/21;
- lint, formato, typecheck, build web, OpenAPI, peers y `git diff --check` en verde;
- Auth0 Android, consulta de perfil, hogares e invitaciones cubiertos por pruebas automatizadas;
- GitHub Actions configurado con PostgreSQL efímero y sin depender de Auth0 real.

Validación automática de Historia 6 ejecutada el 28 de agosto de 2026:

- `pnpm install --frozen-lockfile`, pruebas enfocadas, `pnpm verify` y `pnpm verify:full` aprobados;
- 195 pruebas aprobadas en 37 archivos: 141 unitarias, 28 de integración y 26 E2E;
- migraciones al día, lint, formato, typecheck, builds, OpenAPI, peers, Expo Doctor 21/21 y
  `git diff --check` en verde;
- shell web revisado a 390 × 844 con una sola acción Google; Auth0 real continúa requiriendo
  development build Android.

Validación manual de Historia 6 registrada el 2 de septiembre de 2026:

- Auth0 mantiene únicamente Google habilitado para la Native Application y la Post Login Action
  permanece conectada;
- login, cancelación, reintento, restauración, logout y nuevo login funcionan en Android real;
- la sesión cerrada no se restaura y nunca aparece email/password ni el selector genérico de
  conexiones de Auth0.

Reverificación de cierre resuelta el 2 de septiembre de 2026:

- la inserción directa de la prueba de invitaciones tenía `expiresAt` derivado de `START`, pero
  recibía `createdAt` actual de la base de datos; por ello fallaba primero la constraint de
  expiración y Prisma exponía el `check_violation` `23514` como `P2039`;
- la corrección fija `createdAt` de las dos inserciones directas para que validen de forma
  determinista la unicidad (`P2002`) y la relación creadora cruzada (`P2003`) pretendidas;
- la prueba afectada aprobó 9/9 y `pnpm verify:full` aprobó 195/195 en 37 archivos, incluidas las
  dos migraciones, lint, formato, typecheck, builds, OpenAPI, peers, Expo Doctor 21/21 y diff.

La interfaz reutilizable de verificación se documenta en
[`docs/exec-plans/README.md`](exec-plans/README.md).

## Validación manual de invitaciones

La aceptación con una segunda identidad/dispositivo Android se completó correctamente. La
validación confirmó el camino Owner crea invitación dirigida → segunda identidad obtiene un access
token con correo verificado → aceptación → incorporación al Household. El incidente previo se
debía a que la Post Login Action existía en Auth0 pero todavía no estaba conectada al Login Flow;
al desplegarla y aplicarla al trigger, el flujo funcionó sin reiniciar API, base de datos o Metro.

Esta evidencia es manual e informada durante la validación real; las pruebas automáticas continúan
cubriendo expiración, revocación, reutilización, concurrencia y límites Owner/Member.

## Recomendación de cierre de Fase 2

Todos los criterios de Fase 2 están satisfechos y la fase está cerrada formalmente. Antes de crear
tablas financieras o iniciar Fase 3 debe planearse y ejecutarse el spike de RLS exigido por ADR-006.

## Todavía no implementado

- Persistencia, contratos, endpoints o UI para recursos con visibilidad; la policy existe como
  regla pura no financiera hasta que una fase posterior introduzca un recurso real.
- Cuentas financieras, saldos, `FinancialTransaction`, ledger, dinero y migraciones financieras.
- Fases 3 en adelante, incluida IA, tools, presupuestos, tarjetas, conciliación y dashboard.
- PostgreSQL RLS, administración avanzada de integrantes, transferencia de Owner, expulsión,
  salida, `Admin` o co-owners.
- Spike de RLS previo a las primeras tablas financieras de Fase 3; Fase 3 no está iniciada.
- Despliegue productivo, publicación en tiendas, integraciones bancarias y pagos reales.
