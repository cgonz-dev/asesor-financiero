# AGENTS.md — Copiloto Financiero

## Propósito

Copiloto Financiero es una aplicación móvil de gestión financiera personal y de hogares. La IA
interpreta y propone; el backend valida, autoriza, calcula y persiste. El repositorio es la memoria
compartida entre producto, arquitectura e implementación.

## Fuentes de verdad

| Pregunta | Fuente |
|---|---|
| ¿Qué está implementado y qué sigue pendiente? | [`docs/project-state.md`](docs/project-state.md) |
| ¿Cuál es el orden del producto? | [`docs/05-roadmap.md`](docs/05-roadmap.md) |
| ¿Qué decisiones duraderas están aceptadas? | [`docs/adr/`](docs/adr/README.md) |
| ¿Qué trabajo operacional está autorizado ahora? | [`docs/exec-plans/active/`](docs/exec-plans/README.md) |
| ¿Cómo debe verse y comportarse mobile? | [`docs/mobile/design-system.md`](docs/mobile/design-system.md) |
| ¿Qué evidencia exige el cierre? | [`docs/08-definition-of-done.md`](docs/08-definition-of-done.md) |
| ¿Dónde está el mapa documental completo? | [`docs/00-index.md`](docs/00-index.md) |

Para semántica financiera prevalece [`docs/02-domain-rules.md`](docs/02-domain-rules.md); para
seguridad y privacidad, [`docs/07-security-and-privacy.md`](docs/07-security-and-privacy.md).

## Workflow obligatorio

1. Lee este archivo, `docs/00-index.md`, `docs/project-state.md` y el `AGENTS.md` más cercano al
   área que modificarás.
2. Localiza el único execution plan aplicable en `docs/exec-plans/active/` y lee sus referencias.
3. Trabaja solo la fase/historia y el alcance de ese plan. Si falta, contradice la solicitud o hay
   más de uno aplicable, detente y corrige/aclara el plan antes de implementar.
4. Inspecciona `git status --short` y conserva todo cambio preexistente.
5. Antes de un cambio grande, presenta un plan breve. Pregunta antes de resolver ambigüedades que
   afecten saldos, auditoría, seguridad o privacidad.
6. Actualiza pruebas, contratos y documentación junto con el comportamiento correspondiente.
7. Ejecuta la verificación exigida por el plan y reporta resultados reales, pendientes y riesgos.
8. Al terminar una historia, actualiza `docs/project-state.md` y mueve su plan de `active/` a
   `completed/` solo si cumple la Definition of Done.

## Reglas globales

- No inventes reglas financieras ni adelantes fases. El ledger futuro será la única fuente de
  verdad de movimientos y saldos; nunca uses `float` para dinero.
- Toda autorización se decide en el servidor y se aísla por `householdId`; un ID del cliente nunca
  concede acceso.
- No incluyas secretos, tokens, datos reales ni información financiera sensible en código, Git,
  fixtures, documentación o logs.
- No modifiques una migración aplicada. Todo cambio de persistencia usa una migración nueva.
- `packages/contracts` define formas públicas; `packages/domain` conserva reglas independientes de
  frameworks.
- No trabajes fuera del execution plan activo ni agregues alcance conveniente pero no solicitado.
- No descartes cambios existentes ni uses comandos destructivos.
- No hagas `commit`, `push`, `pull`, merge, rebase ni cambies/crees ramas salvo solicitud explícita.

## Verificación

- `pnpm verify`: baseline reproducible sin PostgreSQL ni Auth0 real.
- `pnpm verify:full`: matriz completa; requiere PostgreSQL local/CI configurado y migraciones
  aplicables, pero nunca un tenant Auth0 real.
- Ejecuta además cualquier prueba manual o control específico indicado por el execution plan.

Los scripts conservan los controles individuales (`lint`, `typecheck`, `test:*`, `build`, OpenAPI,
Expo Doctor y peers) para diagnóstico y CI.
