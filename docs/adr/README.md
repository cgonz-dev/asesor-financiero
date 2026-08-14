# Registro de decisiones arquitectónicas

## Propósito

Los Architecture Decision Records (ADR) conservan el contexto, las alternativas, la decisión y las consecuencias de elecciones duraderas. Un ADR evita que una regla financiera, de seguridad o de arquitectura quede escondida en una conversación, ticket o comentario.

La tabla de decisiones muestra el estado de cada ADR. Solo un registro con estado **Aceptado** constituye una decisión vigente; las propuestas de [`04-architecture.md`](../04-architecture.md) siguen sujetas a revisión cuando su ADR correspondiente no esté aceptado.

## Cuándo crear un ADR

Se crea un ADR cuando una decisión:

- afecta varias capas o historias;
- cambia saldos, ledger, auditoría, idempotencia o exactitud;
- modifica autenticación, autorización, privacidad o tratamiento de datos;
- fija un contrato, proveedor, formato o dependencia difícil de cambiar;
- resuelve una ambigüedad con alternativas relevantes;
- modifica una decisión previamente aceptada.

No se usa ADR para decisiones locales y reversibles que pueden explicarse con código, prueba o documentación del módulo.

## Estados

- **Propuesto:** listo para discusión; no autoriza implementación dependiente.
- **Aceptado:** revisado y vigente.
- **Rechazado:** evaluado y no elegido.
- **Sustituido:** reemplazado por otro ADR enlazado.
- **Obsoleto:** ya no aplica sin que otra decisión lo reemplace.

Un ADR aceptado no se reescribe para ocultar el pasado. Una decisión nueva lo sustituye y enlaza.

## Convención

- Ruta: `docs/adr/NNNN-titulo-corto.md`.
- ID: secuencial de cuatro dígitos.
- Título: decisión concreta, no nombre genérico de módulo.
- Fecha: formato `AAAA-MM-DD`.
- Referencias: enlazar fase, historias, documentos, contratos y ADR relacionados.
- Idioma: español; términos de código se documentan según [ADR-001](0001-idioma-y-vocabulario-canonico.md).

Los IDs ADR-001 a ADR-020 usados en la documentación corresponden a archivos `0001` a `0020`. ADR-001, ADR-005 y ADR-007 están aceptados; los demás IDs permanecen reservados hasta que exista contexto, alternativas y una decisión revisable.

## Proceso

1. Confirmar la fase e historia que necesita la decisión.
2. Reunir restricciones de producto, dominio, seguridad y operación.
3. Describir al menos alternativas viables, incluida la opción de diferir cuando aplique.
4. Evaluar exactitud, auditoría, privacidad, costo, reversibilidad, pruebas y migración.
5. Proponer una opción sin presentarla como aceptada.
6. Obtener revisión de las personas responsables del impacto.
7. Marcar **Aceptado** solo después de resolver objeciones bloqueantes.
8. Actualizar arquitectura, dominio, alcance, roadmap, contratos y pruebas relacionadas.
9. Si cambia la decisión, crear otro ADR y marcar el anterior como **Sustituido**.

Una decisión que afecte saldos, auditoría, seguridad o privacidad requiere confirmación explícita antes de aceptarse.

## Índice de decisiones previstas

| ADR | Decisión | Fase límite | Estado |
|---:|---|---|---|
| [001](0001-idioma-y-vocabulario-canonico.md) | Idioma y vocabulario canónico de dominio, código y API | Antes de Fase 1 | Aceptado |
| 002 | Representación monetaria, moneda, redondeo y división | Antes de Fase 3 | Pendiente |
| 003 | Ledger, signos, cuentas técnicas e invariantes en base de datos | Antes de Fase 3 | Pendiente |
| 004 | Estados, vista previa, confirmación y correcciones | Antes de Fase 3 | Pendiente |
| [005](0005-autenticacion-y-ciclo-de-sesion-movil.md) | Autenticación y ciclo seguro de sesiones móviles | Antes de Fase 2 | Aceptado |
| 006 | Autorización, roles, visibilidad y aislamiento/RLS | Antes de Fase 2 | Pendiente |
| [007](0007-contratos-validacion-openapi-y-cliente.md) | Contratos compartidos, validación, OpenAPI, cliente tipado y versionado de API | Antes de Fase 1 | Aceptado |
| 008 | Idempotencia, concurrencia y alcance de claves | Antes de Fase 3 | Pendiente |
| 009 | Fechas efectivas, zona horaria y periodos | Antes de Fase 3 | Pendiente |
| 010 | Categorías, divisiones y reclasificación histórica | Antes de Fase 4 | Pendiente |
| 011 | Persistencia de borradores y expiración de previews | Antes de Fase 4 | Pendiente |
| 012 | Prompts, modelo, retención, redacción y evaluaciones de IA | Antes de Fase 6 | Pendiente |
| 013 | Tarjetas, deudas, MSI y asignación de pagos | Antes de Fase 7 | Pendiente |
| 014 | Recurrencias, tandas, scheduler, outbox, Redis y BullMQ | Antes de Fase 8 | Pendiente |
| 015 | Conciliación, snapshots y cuentas de diferencias | Antes de Fase 9 | Pendiente |
| 016 | Disponibilidad, presupuestos y proyecciones | Antes de Fase 10 | Pendiente |
| 017 | Offline, sincronización y conflictos | Después del MVP o antes si cambia el alcance | Pendiente |
| 018 | Clasificación, retención, exportación y eliminación de datos | Antes de beta | Pendiente |
| 019 | Observabilidad, auditoría y redacción | Baseline antes de Fase 3; completar antes de beta | Pendiente |
| 020 | Backups, restauración, RPO/RTO y continuidad | Antes de beta | Pendiente |

La fuente resumida de fase límite es [`04-architecture.md`](../04-architecture.md). Al crear o cambiar un ADR, ambas tablas deben permanecer coherentes.

## Plantilla

```markdown
# ADR-NNN: Título de la decisión

- Estado: Propuesto
- Fecha: AAAA-MM-DD
- Responsables:
- Fase/historia:
- Sustituye a:
- Sustituido por:

## Contexto

¿Qué problema debe resolverse, qué está en alcance y por qué se decide ahora?

## Restricciones y criterios

- dominio y exactitud financiera;
- seguridad y privacidad;
- auditoría, idempotencia y operación;
- compatibilidad, costo y reversibilidad;
- pruebas y migración.

## Opciones consideradas

### Opción A

Descripción, ventajas, riesgos y costo.

### Opción B

Descripción, ventajas, riesgos y costo.

## Decisión

Opción elegida y reglas concretas. Mientras el estado sea Propuesto, esta sección no autoriza implementación dependiente.

## Consecuencias

### Positivas

### Negativas y riesgos

### Trabajo derivado

## Validación

Pruebas, métricas, prototipos o evidencia que demostrarán que la decisión funciona.

## Plan de adopción o migración

Secuencia, compatibilidad, rollback y tratamiento de datos existentes.

## Referencias

- documentos, historias, contratos y ADR relacionados.
```

## Criterio de calidad

Un ADR está listo para aceptación cuando:

- el contexto y el alcance son comprensibles;
- las restricciones innegociables están identificadas;
- las alternativas son reales y comparables;
- las consecuencias y riesgos no están ocultos;
- existe estrategia de prueba y migración;
- las personas responsables del impacto lo revisaron;
- no contradice dominio, alcance o una norma superior sin actualizarla explícitamente.
