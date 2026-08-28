# Definition of Done

## Propósito

Esta Definition of Done (DoD) establece la evidencia mínima para considerar terminada una historia, cambio o fase. Se aplica de forma proporcional al alcance: “no aplica” debe justificarse; “no disponible” debe reportarse y convertirse en trabajo pendiente cuando sea un criterio necesario.

Terminar código no equivale a terminar una historia. Tampoco una fase está completa por porcentaje, fecha o intención.

## Reglas universales

Todo cambio debe:

- pertenecer a una fase e historia identificables;
- satisfacer criterios de aceptación verificables;
- mantenerse dentro del alcance solicitado;
- respetar [`02-domain-rules.md`](02-domain-rules.md), [`03-mvp-scope.md`](03-mvp-scope.md) y los ADR aceptados;
- conservar cambios ajenos y no incluir secretos;
- actualizar comportamiento, contratos, pruebas y documentación en conjunto;
- declarar riesgos, supuestos y trabajo diferido;
- reportar con honestidad validaciones ejecutadas, fallidas y no disponibles.

Una ambigüedad que pueda afectar saldos, auditoría, seguridad o privacidad impide cerrar el cambio hasta que exista una decisión documentada.

## Criterios para documentación

- El documento tiene propósito, alcance y fuente de verdad claros.
- No contradice reglas de dominio, alcance, arquitectura o ADR aceptados.
- Enlaces relativos y referencias existen.
- Terminología y ejemplos son consistentes.
- Las decisiones no resueltas están marcadas como pendientes de ADR.
- Cambios de alcance actualizan `03-mvp-scope.md` y/o `05-roadmap.md`.
- Cambios de regla financiera actualizan dominio, ejemplos y pruebas previstas.
- Documentos agregados, renombrados o retirados actualizan `00-index.md`.
- No se presentan propuestas como funciones ya implementadas.

Para una tarea exclusivamente documental no se exige instalar herramientas ni crear código para simular controles futuros.

## Criterios para código y configuración

Cuando exista código:

- compila y construye para los objetivos afectados;
- tiene responsabilidades acotadas y nombres explícitos;
- no duplica reglas de dominio en capas de presentación;
- maneja errores y estados esperados;
- conserva compatibilidad o documenta la estrategia de cambio;
- evita credenciales, datos reales y configuración local sensible;
- actualiza `.env.example` si agrega variables, sin valores secretos;
- usa versiones y dependencias justificadas;
- no deja código muerto, bypasses o banderas inseguras sin seguimiento;
- cumple accesibilidad y localización aplicables.

## Controles estándar

El workspace deberá exponer desde Fase 1:

- `lint`;
- `format`;
- `typecheck`;
- `test`;
- `test:unit`;
- `test:integration`;
- `test:e2e`;
- `build`.

Harness 1.0 agrupa estos controles sin retirar sus comandos individuales:

- `pnpm verify`: baseline sin PostgreSQL ni Auth0 real;
- `pnpm verify:full`: matriz completa con PostgreSQL local/CI configurado.

Antes de finalizar se ejecutan los controles disponibles y relevantes. El reporte indica comando, alcance y resultado. Si un control requerido falla, la historia no está terminada. Si aún no existe por la fase actual, se registra como no disponible y no se inventa evidencia.

## Pruebas

- Cada criterio de aceptación tiene evidencia o una prueba asociada.
- Las reglas puras se prueban sin framework, UI, base de datos ni proveedor de IA.
- Errores, límites y casos negativos reciben cobertura proporcional al riesgo.
- Los bugs corregidos agregan una prueba de regresión cuando sea viable.
- Las pruebas son deterministas; tiempo, zona horaria, aleatoriedad y proveedores se controlan.
- Fixtures son ficticios y no contienen datos sensibles.
- E2E se reserva para flujos críticos y contratos entre capas.
- Las pruebas no se deshabilitan para obtener una ejecución verde sin justificación y seguimiento.

## Contratos y API

Si cambia una interfaz:

- `packages/contracts` es la fuente compartida de DTO, esquemas y errores públicos;
- entradas, salidas, ejemplos y códigos de error están actualizados;
- OpenAPI coincide con el comportamiento implementado;
- consumidores afectados se actualizan en la misma tarea;
- validación de límites no reemplaza invariantes del dominio;
- cambios incompatibles tienen versionado o estrategia de migración;
- tipos monetarios, moneda, fechas, IDs e idempotency key son inequívocos;
- existen pruebas de contrato y compatibilidad aplicables;
- los errores no revelan existencia de recursos ni datos sensibles.

## Datos y migraciones

Si cambia persistencia:

- existe una migración nueva, revisable y con nombre explícito;
- no se modifica una migración ya aplicada;
- esquema, índices, claves y constraints soportan invariantes y aislamiento;
- la migración considera datos existentes, despliegue y rollback operativo;
- operaciones relacionadas son atómicas;
- seeds y fixtures no contienen información real;
- se prueba migración en una base representativa cuando el riesgo lo exige;
- documentación y modelo conceptual se actualizan.

Un cambio destructivo o irreversible requiere decisión explícita, plan de respaldo y estrategia de recuperación.

## Exactitud financiera

Todo cambio que toque dinero demuestra:

- ausencia de `float` en contratos, cálculos y persistencia monetaria;
- moneda, precisión y redondeo definidos;
- balance por transacción y moneda;
- reconstrucción de saldos actuales e históricos;
- categorías separadas de cuentas;
- transferencias, retiros y pagos de tarjeta sin gasto duplicado;
- compromisos y recordatorios separados de movimientos realizados;
- correcciones sin hard delete ni mutación silenciosa;
- idempotencia y conflicto por reutilización incompatible;
- atomicidad ante fallas parciales;
- concurrencia tratada;
- auditoría enlazada;
- propiedad, visibilidad y `household_id` validados.

Las pruebas incluyen casos de borde, importes mínimos/máximos, división con residuos, reintentos y fallas intermedias cuando apliquen.

## Seguridad y privacidad

Todo cambio sensible demuestra:

- autenticación y autorización en servidor;
- denegación por defecto;
- aislamiento entre hogares y validación por recurso;
- protección de cuentas personales;
- manejo seguro de tokens y secretos;
- cifrado en tránsito;
- redacción de logs, trazas, prompts, errores y notificaciones;
- mínimo privilegio y datos mínimos;
- auditoría de acciones sensibles;
- dependencias y configuración revisadas;
- retención, exportación, eliminación y backups consideradas cuando cambie el tratamiento de datos.

Las pruebas negativas incluyen IDOR, enumeración, membresía revocada, recurso de otro hogar y argumentos manipulados.

## IA y herramientas

Si participa IA:

- la IA no accede directamente a repositorios ni base de datos;
- cada tool tiene contrato tipado, versión, permisos y errores;
- argumentos del modelo se validan como no confiables;
- herramientas llaman servicios de aplicación;
- escrituras generan borrador y preview antes de confirmación;
- la confirmación se vincula a una vista previa vigente;
- reintentos y timeouts no duplican;
- saldos y proyecciones provienen del backend;
- contexto y respuestas se minimizan y redactan;
- existe evaluación versionada de casos felices, ambiguos y adversariales;
- un fallo del modelo no puede saltarse autorización, invariantes o auditoría;
- limitaciones y naturaleza no garantizada de escenarios/recomendaciones son comprensibles.

## Aplicación móvil

Si cambia la app:

- muestra hogar, cuenta, moneda y estado relevantes;
- distingue personal/compartido y actual/restringido/comprometido/disponible;
- presenta vista previa antes de una escritura financiera;
- evita confirmación o duplicación accidental;
- cubre carga, vacío, error, reintento y conectividad interrumpida;
- almacena la sesión de forma segura;
- cumple accesibilidad en plataformas objetivo;
- no contiene reglas financieras autoritativas duplicadas;
- tiene pruebas de presentación, integración y E2E proporcionales.

## Operación y observabilidad

Cuando aplique:

- health/readiness reflejan dependencias reales sin filtrar secretos;
- correlation IDs unen cliente, API, tools y jobs;
- métricas, logs y trazas permiten diagnosticar sin datos sensibles;
- alertas cubren fallos críticos de balance, autorización, duplicación y jobs;
- jobs son idempotentes y tienen política de reintento/dead-letter;
- runbooks, responsables y rollback están documentados;
- backups y restauración cumplen RPO/RTO definidos;
- cambios de despliegue tienen monitoreo y criterio de reversión.

## Revisión del cambio

Antes del cierre se revisa:

- alcance y archivos modificados;
- compatibilidad con cambios preexistentes;
- errores, TODO y decisiones abiertas;
- contratos, migraciones y documentación;
- ausencia de secretos y datos financieros reales;
- riesgos de exactitud, autorización, privacidad, idempotencia y atomicidad;
- evidencia de pruebas y cualquier limitación del entorno.

## Evidencia de cierre de historia

El reporte final incluye:

1. fase e historia trabajadas;
2. criterios de aceptación satisfechos;
3. archivos, contratos y migraciones relevantes;
4. controles ejecutados con resultados;
5. controles no ejecutados y motivo;
6. riesgos o decisiones pendientes;
7. trabajo expresamente fuera de alcance;
8. siguiente historia recomendada.

## Cierre de fase

Además del cierre de cada historia, una fase requiere:

- todas sus historias y criterios satisfechos;
- entregables enlazados;
- pruebas requeridas y evidencia;
- ADR bloqueantes aceptados o sustituidos;
- riesgos críticos/altos resueltos o aceptados con responsable y fecha;
- documentación, contratos y migraciones sincronizados;
- revisión de seguridad, privacidad y accesibilidad proporcional;
- trabajo diferido registrado;
- recomendación de la fase o historia siguiente.

No se declara cerrada una fase mientras falte cualquiera de estos elementos.

## Excepciones

Una excepción a la DoD:

- es explícita y acotada;
- explica impacto y mitigación;
- tiene responsable y fecha de revisión;
- no viola una regla financiera innegociable;
- no permite liberar un hallazgo crítico sin tratamiento;
- queda registrada en el mecanismo de seguimiento vigente.
