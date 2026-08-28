# Execution plans

## Propósito

Un execution plan convierte una historia del roadmap en trabajo operacional verificable. Define el
objetivo, alcance, criterios, pruebas y documentación de una sola tarea sin copiar el contexto que
ya vive en ADR, roadmap, seguridad, diseño o estado del proyecto.

## Estructura

- [`active/`](active/): únicamente planes vigentes y todavía no completados.
- [`completed/`](completed/README.md): planes terminados y un registro mínimo del trabajo anterior.
- [`template.md`](template.md): estructura corta para planes nuevos.

Un plan no sustituye:

- los [ADR](../adr/README.md), que conservan decisiones aceptadas;
- el [roadmap](../05-roadmap.md), que conserva dirección y secuencia;
- [`project-state.md`](../project-state.md), que conserva el estado real actual;
- la [Definition of Done](../08-definition-of-done.md), que fija la barra de calidad.

## Uso

1. Mantén un solo plan aplicable al trabajo actual.
2. Enlaza fuentes de verdad y escribe únicamente detalles operacionales.
3. Marca con honestidad validación manual y evidencia no disponible.
4. Al completar todos sus criterios, actualiza `project-state.md` y mueve el archivo a
   `completed/`. No lo muevas solo porque terminó una sesión de trabajo.

## Verification harness

- `pnpm verify`: controles que no requieren PostgreSQL ni un tenant Auth0 real: lint, formato,
  typecheck, pruebas unitarias, build, OpenAPI, peer dependencies, Expo Doctor y diff whitespace.
- `pnpm verify:full`: añade migraciones/estado de Prisma y las suites general, integración y E2E;
  requiere PostgreSQL local o el servicio efímero de CI con `DATABASE_URL` permitida por los tests.

Expo Doctor se ejecuta con una versión fijada y contra el mapa de compatibilidad incluido en el
SDK instalado. Así, un parche publicado posteriormente en el registro no cambia por sí solo el
resultado de un checkout con lockfile congelado.

Ambos comandos son secuenciales, conservan el primer exit code fallido, no despliegan, no publican
y no modifican una base de producción. Los scripts individuales permanecen disponibles para
diagnóstico. La instalación reproducible (`pnpm install --frozen-lockfile`) sigue siendo un paso de
preparación, no se ejecuta implícitamente en cada verificación.
