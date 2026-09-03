# Mantenimiento CI — ciclo de vida estable del servidor E2E

Status: Completed — 2026-09-03
Scope: Harness HTTP E2E de `apps/api`

## Goal

Eliminar el `ECONNRESET` intermitente de GitHub Actions causado por peticiones Supertest
concurrentes contra un mismo `http.Server` aún no enlazado, sin cambiar comportamiento funcional,
Auth0, contratos ni persistencia.

## Changes

- Hacer que cada aplicación Nest E2E escuche una sola vez en `127.0.0.1` y un puerto efímero antes
  de emitir peticiones.
- Mantener las aserciones concurrentes que reprodujeron la carrera para cubrir la regresión.
- Cerrar cada aplicación mediante el lifecycle normal de Nest al finalizar la suite.

## Verification

1. Ejecutar repetidamente la suite E2E afectada.
2. Ejecutar `pnpm test:e2e`.
3. Ejecutar `pnpm verify:full`.
4. Ejecutar `git diff --check`.

## Limits

- Sin cambios de producción, endpoints, seguridad, contratos o datos.
- Sin Fase 3 ni funcionalidad financiera.
- Sin commit ni push.

## Completion

- Causa: Supertest recibía un `http.Server` no enlazado. La primera petición concurrente lo abría
  y lo cerraba al terminar, reseteando sockets todavía activos del mismo `Promise.all`.
- Corrección: cada aplicación Nest E2E escucha una sola vez en `127.0.0.1` y un puerto efímero
  durante toda la suite; `app.close()` conserva el cierre normal.
- Regresión enfocada: 10 ejecuciones consecutivas, 70/70 casos aprobados.
- `pnpm test:e2e`: PASS, 26/26.
- `pnpm verify:full`: PASS, incluidas 195/195 pruebas generales, 141/141 unitarias, 28/28 de
  integración, 26/26 E2E, builds, OpenAPI, peers y Expo Doctor 21/21.
- `git diff --check`: PASS; sin cambios funcionales ni de producción.
