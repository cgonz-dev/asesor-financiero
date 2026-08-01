# AGENTS.md — Copiloto Financiero

## Antes de trabajar

1. Lee este archivo y [`docs/00-index.md`](docs/00-index.md) completos.
2. Lee los documentos relacionados con el módulo que modificarás.
3. Consulta el roadmap vigente en [`docs/05-roadmap.md`](docs/05-roadmap.md) y trabaja una sola fase o historia a la vez.
4. Antes de un cambio grande, presenta un plan breve y confirma cualquier decisión que pueda afectar saldos, auditoría, seguridad o privacidad.

## Objetivo del producto

Copiloto Financiero es una aplicación móvil de gestión financiera personal y de hogares, inicialmente enfocada en parejas. Convierte lenguaje natural en propuestas financieras estructuradas y explicaciones útiles, sin convertir a la IA en fuente de verdad.

> La IA interpreta, pregunta, propone y solicita acciones. El backend valida, calcula, persiste y conserva la verdad financiera.

## Principios innegociables

- El ledger financiero es la única fuente de verdad de movimientos y saldos; nunca la memoria libre de un modelo.
- Toda escritura financiera pasa por servicios de aplicación, validaciones de dominio, autorización y persistencia transaccional. La IA nunca escribe directamente en la base de datos.
- El dinero se representa de forma exacta: enteros en unidad mínima o decimal controlado; nunca `float`.
- Toda acción con impacto financiero se previsualiza y requiere confirmación explícita.
- Toda escritura financiera contempla idempotencia, trazabilidad y auditoría.
- Un movimiento confirmado no se elimina silenciosamente ni mediante hard delete; se corrige con reversión, ajuste o reemplazo enlazado al original.
- Los saldos históricos deben poder reconstruirse desde el ledger.
- El aislamiento por `household_id` y la propiedad/visibilidad de cada recurso se validan en el servidor.
- No se inventan reglas financieras, cuentas, movimientos ni datos faltantes.

## Reglas financieras críticas

Estas reglas son obligatorias; su explicación y ejemplos viven en [`docs/02-domain-rules.md`](docs/02-domain-rules.md).

1. El saldo mostrado proviene del ledger, no de cálculos improvisados por la IA.
2. El dinero se almacena exactamente y nunca como `float`.
3. Una transferencia entre cuentas propias no es gasto.
4. Retirar efectivo es una transferencia de banco a efectivo, no un gasto.
5. Pagar una tarjeta reduce banco y deuda; no crea un gasto nuevo.
6. Una compra a meses se registra una vez y genera compromisos futuros sin duplicar gasto.
7. Un depósito de renta recuperable es dinero restringido o activo, no renta.
8. Los vales son una cuenta restringida, no efectivo bancario.
9. Una prestación no líquida, como seguro médico empresarial, no aumenta automáticamente el efectivo disponible.
10. En tandas se distinguen aportaciones realizadas, aportaciones pendientes, dinero recibido y dinero aún no disponible.
11. Toda operación financiera importante conserva historial de auditoría.
12. Los movimientos confirmados no se eliminan silenciosamente.
13. Las correcciones confirmadas usan reversión, ajuste o reemplazo y conservan el original.
14. Una diferencia de efectivo desconocida puede registrarse como ajuste pendiente de conciliación.
15. El dinero faltante reduce el saldo disponible aunque su categoría aún sea desconocida.
16. La IA no inventa el origen de una diferencia; solo sugiere y mantiene el estado pendiente.
17. Todo cambio con impacto financiero muestra una vista previa antes de confirmarse.
18. Toda escritura financiera usa idempotencia para resistir reintentos y evitar duplicados.
19. Las operaciones relacionadas se ejecutan en una transacción de base de datos.
20. Los saldos históricos se pueden reconstruir a partir de los movimientos.

## Arquitectura inicial

Decisión de partida, sujeta a los ADR identificados en [`docs/04-architecture.md`](docs/04-architecture.md):

- monorepo con pnpm workspaces y TypeScript;
- aplicación móvil con React Native, Expo y Expo Router;
- API REST con NestJS y OpenAPI;
- PostgreSQL con Prisma y migraciones;
- contratos y esquemas de validación compartidos;
- OpenAI Responses API con tool calling y salidas estructuradas;
- Redis y BullMQ solo cuando existan recordatorios o procesos programados;
- autenticación pendiente de ADR;
- panel web, integraciones bancarias y pagos automáticos fuera del MVP.

Estructura prevista, no necesariamente creada aún: `apps/mobile`, `apps/api`, `packages/contracts`, `packages/domain`, `packages/config`, `packages/eslint-config`, `packages/typescript-config`, `docs/adr`.

El núcleo financiero usa un ledger inspirado en partida doble: `transaction` agrupa la operación y `ledger_entry` afecta cuentas mediante entradas balanceadas. Las categorías describen el uso del dinero, pero no sustituyen cuentas. Los compromisos futuros y recordatorios no alteran saldos realizados por sí solos.

## Forma de trabajo

- No asumas reglas financieras no documentadas; documenta o pregunta.
- Pregunta antes de resolver una ambigüedad que pueda afectar saldos, auditoría, seguridad o privacidad.
- Trabaja una fase o historia a la vez y no agregues alcance no solicitado.
- Mantén trazabilidad entre historia, implementación, prueba, contrato y documentación.
- Favorece archivos cohesivos, responsabilidades acotadas y nombres explícitos.
- Usa de forma consistente el vocabulario de dominio definido en la documentación; no mezcles sin criterio español e inglés en contratos o código.
- No incluyas secretos, credenciales, tokens ni datos financieros sensibles en código, fixtures, documentación o logs.
- Si agregas variables de entorno, actualiza `.env.example` sin valores secretos.
- Toda modificación de base de datos usa una migración nueva; nunca alteres una migración ya aplicada.
- No declares terminada una fase mientras falte cualquier criterio de aceptación.

## Contratos y límites entre capas

- `packages/contracts` será la fuente compartida de contratos de API y esquemas de validación; no contiene lógica de negocio ni acceso a datos.
- No modifiques un contrato sin actualizar consumidores, OpenAPI, pruebas y documentación relacionada.
- Si cambia backend, frontend o su interfaz, actualiza el contrato compartido y los documentos correspondientes en la misma tarea.
- Las herramientas de IA usan contratos tipados y solo invocan servicios de aplicación; no acceden a repositorios ni base de datos.
- Las reglas de dominio deben poder probarse sin depender del framework, la UI o el proveedor de IA.

## Validaciones obligatorias

Ejecuta los controles disponibles y aplicables antes de finalizar. El conjunto estándar futuro es:

- `lint`
- `format`
- `typecheck`
- `test`
- `test:unit`
- `test:integration`
- `test:e2e`
- `build`

Reporta con honestidad qué se ejecutó, qué falló y qué no estaba disponible. Revisa además, según el cambio: exactitud monetaria, balance del ledger, aislamiento por hogar, autorización, idempotencia, atomicidad, auditoría, manejo de errores, migraciones, contratos y ausencia de secretos. La Definition of Done completa está en [`docs/08-definition-of-done.md`](docs/08-definition-of-done.md).

## Reglas de Git

- No hagas `commit`, `push`, `pull`, rebase, merge ni crees/cambies ramas salvo solicitud explícita.
- No reescribas historial ni descartes cambios existentes del usuario.
- Inspecciona el worktree antes de editar y conserva cambios ajenos al alcance.
- Nunca incluyas secretos ni archivos locales sensibles en Git.

## Actualización de documentación

- Cambia la documentación en la misma tarea que cambia el comportamiento, contrato, dato o decisión.
- Actualiza [`docs/00-index.md`](docs/00-index.md) si agregas, renombras o retiras documentos.
- Registra decisiones arquitectónicas duraderas como ADR; no las ocultes en comentarios o conversaciones.
- Si cambia alcance, fases o criterios, actualiza [`docs/03-mvp-scope.md`](docs/03-mvp-scope.md) y/o [`docs/05-roadmap.md`](docs/05-roadmap.md).
- Si cambia una regla financiera, actualiza [`docs/02-domain-rules.md`](docs/02-domain-rules.md), sus ejemplos y pruebas.

## Mapa rápido

| Necesidad | Documento |
|---|---|
| Visión y usuarios | [`docs/01-product-vision.md`](docs/01-product-vision.md) |
| Reglas, ledger y operaciones | [`docs/02-domain-rules.md`](docs/02-domain-rules.md) |
| Alcance MVP | [`docs/03-mvp-scope.md`](docs/03-mvp-scope.md) |
| Arquitectura y decisiones pendientes | [`docs/04-architecture.md`](docs/04-architecture.md) |
| Fases e historias | [`docs/05-roadmap.md`](docs/05-roadmap.md) |
| Límites y herramientas de IA | [`docs/06-ai-behavior.md`](docs/06-ai-behavior.md) |
| Seguridad y privacidad | [`docs/07-security-and-privacy.md`](docs/07-security-and-privacy.md) |
| Calidad y Definition of Done | [`docs/08-definition-of-done.md`](docs/08-definition-of-done.md) |
| Registro de decisiones | [`docs/adr/README.md`](docs/adr/README.md) |

