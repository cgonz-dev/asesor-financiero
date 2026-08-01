# Índice de documentación

## Propósito

Este índice define la fuente de verdad documental de Copiloto Financiero. Evita que una decisión quede únicamente en conversaciones, tickets o código.

## Orden de lectura

Toda persona o agente que contribuya debe leer primero:

1. [`../AGENTS.md`](../AGENTS.md): reglas permanentes de trabajo.
2. Este índice.
3. El documento del área que va a modificar.
4. [`05-roadmap.md`](05-roadmap.md): fase e historia activa.
5. Los ADR aplicables en [`adr/`](adr/README.md).

## Mapa documental

| Documento | Fuente de verdad para | Cuándo actualizarlo |
|---|---|---|
| [`../README.md`](../README.md) | Presentación, estado y punto de entrada | Cuando cambien el estado o la orientación inicial |
| [`../AGENTS.md`](../AGENTS.md) | Guardarraíles permanentes para agentes | Cuando cambien reglas transversales de trabajo |
| [`01-product-vision.md`](01-product-vision.md) | Problema, usuarios, propuesta de valor y resultados | Cuando cambie la dirección del producto |
| [`02-domain-rules.md`](02-domain-rules.md) | Vocabulario, invariantes, ledger y operaciones | Con cualquier cambio de semántica financiera |
| [`03-mvp-scope.md`](03-mvp-scope.md) | Dentro/fuera del MVP y supuestos | Cuando se apruebe un cambio de alcance |
| [`04-architecture.md`](04-architecture.md) | Límites, componentes, datos y decisiones técnicas | Cuando cambie la arquitectura o se acepte un ADR |
| [`05-roadmap.md`](05-roadmap.md) | Secuencia de fases, historias, pruebas y entregables | Al iniciar/cerrar fases o replanificar |
| [`06-ai-behavior.md`](06-ai-behavior.md) | Capacidades, prohibiciones y herramientas de IA | Cuando cambien prompts, tools o confirmaciones |
| [`07-security-and-privacy.md`](07-security-and-privacy.md) | Amenazas, controles y tratamiento de datos | Con cualquier cambio de identidad, acceso o datos |
| [`08-definition-of-done.md`](08-definition-of-done.md) | Barra de calidad y evidencia de cierre | Cuando cambie el proceso de entrega |
| [`adr/README.md`](adr/README.md) | Proceso, índice y plantilla de decisiones | Al proponer, aceptar o sustituir decisiones |

## Jerarquía ante conflictos

1. Una regla legal o de seguridad vigente prevalece sobre el resto.
2. Los ADR aceptados prevalecen sobre propuestas antiguas de arquitectura.
3. [`02-domain-rules.md`](02-domain-rules.md) prevalece para semántica financiera.
4. [`03-mvp-scope.md`](03-mvp-scope.md) prevalece para alcance aprobado.
5. [`05-roadmap.md`](05-roadmap.md) determina el orden de ejecución, no redefine dominio o alcance.
6. Si dos fuentes siguen en conflicto, se detiene la decisión con impacto financiero y se documenta la resolución.

## Estado de la documentación

| Área | Estado inicial | Próxima acción |
|---|---|---|
| Visión y alcance | Propuesta fundacional documentada | Validar con usuarios de la pareja piloto |
| Dominio financiero | Modelo conceptual documentado; no implementado | Resolver ADR de dinero y ledger antes de Fase 3 |
| Arquitectura | Propuesta inicial documentada; ADR-001 y ADR-007 aceptados; no implementada | Iniciar Fase 1 únicamente en una tarea expresamente autorizada |
| IA | Límites, política y catálogo futuro documentados | Resolver ADR-012 y contratos durante Fase 6 |
| Seguridad y privacidad | Baseline documentado | Resolver identidad/aislamiento antes de Fase 2 y modelar amenazas antes de beta |
| Roadmap | Vigente | Ejecutar de forma secuencial |

## Convenciones documentales

- Las cantidades de ejemplos son ilustrativas y se expresan con moneda explícita.
- “Debe” indica requisito obligatorio; “puede” indica opción.
- Una decisión “pendiente de ADR” no se considera cerrada.
- Los documentos describen comportamiento; los ADR explican por qué se eligió una solución duradera.
- Cada cambio funcional debe enlazar historia, criterios de aceptación, pruebas y documentación.
