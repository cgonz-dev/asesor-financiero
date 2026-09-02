# Índice de documentación

## Propósito

Este índice define la fuente de verdad documental de Copiloto Financiero. Evita que una decisión quede únicamente en conversaciones, tickets o código.

## Orden de lectura

Toda persona o agente que contribuya debe leer primero:

1. [`../AGENTS.md`](../AGENTS.md): reglas permanentes de trabajo.
2. Este índice.
3. [`project-state.md`](project-state.md): snapshot operacional vigente.
4. El `AGENTS.md` y el documento del área que va a modificar.
5. El único plan aplicable en [`exec-plans/active/`](exec-plans/README.md).
6. [`05-roadmap.md`](05-roadmap.md) y los ADR aplicables en [`adr/`](adr/README.md).

## Mapa documental

| Documento | Fuente de verdad para | Cuándo actualizarlo |
|---|---|---|
| [`../README.md`](../README.md) | Presentación, estado y punto de entrada | Cuando cambien el estado o la orientación inicial |
| [`../AGENTS.md`](../AGENTS.md) | Mapa, workflow y guardarraíles globales para agentes | Cuando cambie la forma transversal de trabajo |
| [`project-state.md`](project-state.md) | Estado real actual, baseline y deuda visible | Después de cada historia o cambio material de estado |
| [`01-product-vision.md`](01-product-vision.md) | Problema, usuarios, propuesta de valor y resultados | Cuando cambie la dirección del producto |
| [`02-domain-rules.md`](02-domain-rules.md) | Vocabulario, invariantes, ledger y operaciones | Con cualquier cambio de semántica financiera |
| [`03-mvp-scope.md`](03-mvp-scope.md) | Dentro/fuera del MVP y supuestos | Cuando se apruebe un cambio de alcance |
| [`04-architecture.md`](04-architecture.md) | Límites, componentes, datos y decisiones técnicas | Cuando cambie la arquitectura o se acepte un ADR |
| [`05-roadmap.md`](05-roadmap.md) | Secuencia de fases, historias, pruebas y entregables | Al iniciar/cerrar fases o replanificar |
| [`06-ai-behavior.md`](06-ai-behavior.md) | Capacidades, prohibiciones y herramientas de IA | Cuando cambien prompts, tools o confirmaciones |
| [`07-security-and-privacy.md`](07-security-and-privacy.md) | Amenazas, controles y tratamiento de datos | Con cualquier cambio de identidad, acceso o datos |
| [`08-definition-of-done.md`](08-definition-of-done.md) | Barra de calidad y evidencia de cierre | Cuando cambie el proceso de entrega |
| [`adr/README.md`](adr/README.md) | Proceso, índice y plantilla de decisiones | Al proponer, aceptar o sustituir decisiones |
| [`exec-plans/README.md`](exec-plans/README.md) | Trabajo operacional activo/completado | Al planear, iniciar o completar una historia |
| [`mobile/design-system.md`](mobile/design-system.md) | Sistema visual móvil implementado | Al cambiar tokens, componentes, navegación o movimiento |

## Jerarquía ante conflictos

1. Una regla legal o de seguridad vigente prevalece sobre el resto.
2. Los ADR aceptados prevalecen sobre propuestas antiguas de arquitectura.
3. [`02-domain-rules.md`](02-domain-rules.md) prevalece para semántica financiera.
4. [`03-mvp-scope.md`](03-mvp-scope.md) prevalece para alcance aprobado.
5. [`05-roadmap.md`](05-roadmap.md) determina orden y dirección; no redefine dominio o alcance.
6. [`project-state.md`](project-state.md) registra el estado actual y el plan activo concreta el
   trabajo, sin sustituir fuentes superiores.
7. Si dos fuentes siguen en conflicto, se detiene la decisión con impacto financiero y se documenta la resolución.

## Estado de la documentación

| Área | Estado inicial | Próxima acción |
|---|---|---|
| Visión y alcance | Propuesta fundacional documentada | Validar con usuarios de la pareja piloto |
| Dominio financiero | Modelo conceptual documentado; no implementado | Resolver ADR de dinero y ledger antes de Fase 3 |
| Arquitectura | Fases 1 y 2 cerradas; Historias 1 a 6 y validaciones Android satisfechas, con matriz completa verde; navegación con protección raíz, visibilidad pura y auditoría básica implementadas; ADR-001, ADR-005, ADR-006 y ADR-007 aceptados | Planear y ejecutar el spike de RLS antes de iniciar Fase 3 |
| IA | Límites, política y catálogo futuro documentados | Resolver ADR-012 y contratos durante Fase 6 |
| Seguridad y privacidad | Baseline documentado; Auth0 y límites Household/invitaciones de ADR-006 implementados; invitaciones y Google-only validados en Android real; conexión Google fijada en el cliente móvil | Ejecutar spike de RLS antes de datos financieros y ampliar autorización solo mediante una historia aprobada |
| Roadmap | Vigente | Ejecutar de forma secuencial |

## Convenciones documentales

- Las cantidades de ejemplos son ilustrativas y se expresan con moneda explícita.
- “Debe” indica requisito obligatorio; “puede” indica opción.
- Una decisión “pendiente de ADR” no se considera cerrada.
- Los documentos describen comportamiento; los ADR explican por qué se eligió una solución duradera.
- `project-state.md` es un snapshot, no un historial; los execution plans enlazan contexto sin duplicarlo.
- Cada cambio funcional debe enlazar historia, criterios de aceptación, pruebas y documentación.
