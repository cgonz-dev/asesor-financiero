# ADR-019: Observabilidad, auditoría y redacción de datos sensibles

- Estado: Aceptado
- Fecha: 2026-09-04
- Aceptación explícita: Responsable del proyecto, 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — auditoría y observabilidad financiera
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Una operación financiera debe poder reconstruirse y atribuirse sin convertir logs, métricas o
trazas en una segunda base de datos financiera. También debe ser posible investigar fallos y
reintentos sin afirmar como hecho durable algo que la transacción revirtió.

La auditoría actual es deliberadamente mínima: `AuditEvent` registra únicamente éxitos de creación
de Household e invitaciones, con actor, hogar, acción, resultado, recurso e instante. Se persiste en
la misma transacción que el cambio funcional y las pruebas demuestran que un fallo de auditoría
revierte la operación. Todavía no existen correlation middleware, tracing ni métricas financieras.

ADR-003 exige atomicidad entre ledger y auditoría; ADR-004 vincula intención, preview y posting;
ADR-008 fija idempotencia; ADR-021 exige RLS, `READ COMMITTED`, lock de membership y roles sin
bypass. Este ADR fija el baseline aceptado que deberá acompañar esas decisiones. Su aceptación
cierra el último gate arquitectónico previo a Fase 3; la implementación requiere un execution plan
posterior autorizado.

## Restricciones y criterios

- Audit trail, logs, métricas y tracing tienen propósitos, retenciones y consumidores distintos.
- Un hecho financiero confirmado debe compartir commit con su auditoría durable.
- Un rollback no puede dejar una auditoría que afirme que el efecto financiero ocurrió.
- Fallos y denegaciones deben poder investigarse sin revelar la existencia de recursos ajenos.
- La cadena preview → idempotencia → ledger → corrección debe reconstruirse mediante referencias.
- El audit trail es append-only para runtimes y jobs ordinarios.
- RLS y autorización de aplicación protegen las lecturas y escrituras de auditoría tenant-scoped.
- Ninguna señal contiene secretos, tokens, payloads o datos financieros innecesarios.
- Métricas y alertas operacionales no se convierten en analytics de hábitos o importes.
- IA, jobs y soporte conservan una identidad causal explícita y nunca reciben bypass implícito.

## Opciones consideradas

### A. Registro unificado para auditoría y telemetría

Una sola tabla o plataforma recibe hechos durables, errores, logs, spans y datos de métricas.

Ventajas:

- menos componentes conceptuales;
- una búsqueda puede encontrar todas las señales.

Costos y riesgos:

- mezcla evidencia de negocio con diagnóstico mutable y muestreado;
- obliga a compartir retención, permisos y sensibilidad incompatibles;
- la cardinalidad de tracing/métricas degrada el audit trail;
- incentiva copiar payloads financieros para facilitar debugging;
- un fallo revertido no puede ser atómico con la transacción que lo produjo.

### B. Audit trail durable más telemetría técnica separada

Los hechos confirmados viven en un registro tenant-scoped append-only. Logs, spans y métricas usan
canales separados, estructurados y redactados, unidos por `correlationId` y referencias opacas.

Ventajas:

- preserva atomicidad e integridad del historial financiero;
- permite políticas de acceso, retención y cardinalidad adecuadas a cada señal;
- los retries no duplican hechos y los fallos no se confunden con postings;
- minimiza información sensible fuera de la base autoritativa.

Costos y riesgos:

- investigar exige correlacionar fuentes;
- la cobertura depende de catálogos y allowlists consistentes;
- una caída de telemetría puede ocultar un fallo aunque no corrompa el ledger;
- requiere procedimientos distintos para soporte y respuesta a incidentes.

### C. Auditoría externa o event-sourced mediante outbox

Cada transición publica un evento hacia un almacén inmutable o WORM. El ledger o el stream externo
puede convertirse en la fuente del audit trail.

Ventajas:

- separación física y mejores opciones de tamper evidence;
- facilita integración futura con SIEM o análisis operacional.

Costos y riesgos:

- un outbox sigue necesitando una fila local atómica y entrega idempotente;
- agrega operación, esquemas evolutivos, retención y recuperación distribuida;
- convertir la auditoría en event sourcing duplicaría responsabilidades del ledger;
- es prematuro para un monolito modular sin infraestructura de eventos aceptada.

## Decisión aceptada

Adoptar la **opción B**. El audit trail financiero será evidencia durable de transiciones
confirmadas. Logs, tracing y métricas serán telemetría operacional separada, redactada y no
autoritativa. Una futura copia externa puede añadirse mediante outbox, pero no sustituirá el commit
local ni convertirá el ledger en un sistema de logging.

### Separación de señales

| Señal | Propósito | Durabilidad inicial | Identificadores | Datos financieros |
|---|---|---|---|---|
| Audit trail | atribuir y reconstruir hechos confirmados | ligada al efecto financiero | referencias opacas completas | no duplica contenido |
| Logs técnicos | diagnóstico y errores ordinarios | temporal, acotada por política operacional | `correlationId`, `traceId` y refs pseudónimas solo si son necesarias | prohibidos |
| Tracing | recorrido, dependencias y latencia | muestreada y temporal | `traceId`, `spanId`, `correlationId` | prohibidos |
| Métricas | salud, SLO y alertas | series agregadas | ninguna referencia de instancia | prohibidos |

Las señales comparten nombres versionados y una taxonomía de resultado, no el mismo payload. Un
nivel de log más verboso nunca desactiva redacción ni habilita request bodies, SQL parametrizado o
contenido financiero.

Solo fallos y denegaciones con relevancia real de seguridad se conservan además como evidencia
durable en un registro de seguridad separado del audit trail financiero. Los errores operativos
ordinarios permanecen en telemetría temporal. El registro de seguridad usa códigos controlados,
correlación y referencias mínimas autorizadas, con las mismas prohibiciones de datos sensibles.

### Eventos financieros durables

Catálogo mínimo aceptado:

| Evento | Cuándo se crea | Referencias mínimas |
|---|---|---|
| `financial.preview.created` | nueva versión confirmable | operación, preview/versión, actor, hogar |
| `financial.preview.superseded` | otra versión reemplaza la activa | operación, previews anterior/nuevo |
| `financial.preview.cancelled` | cancelación explícita autorizada | operación y preview |
| `financial.operation.confirmed` | posting ordinario confirmado | operación, preview, idempotencia y transacción |
| `financial.transaction.reversed` | reversión confirmada | transacción nueva y original |
| `financial.transaction.replaced` | reversal y posting sustituto atómicos | transacciones nuevas y original |
| `financial.transaction.adjusted` | diferencia confirmada | transacción de ajuste y original |
| `financial.job.effect_confirmed` | job autorizado produce un efecto | principal de job, causa y transacción |

`Consumed` queda representado por `financial.operation.confirmed` o el evento correctivo
correspondiente; no se duplica con otro evento de posting. Una expiración derivable de
`expiresAt` no genera por sí sola una fila masiva. Si una transición `Expired` se persiste por una
necesidad posterior, será idempotente y no financiera.

Los retries que recuperan un resultado existente, conflictos de idempotencia, previews stale o
expired, denegaciones, fallos de validación y rollbacks no son hechos financieros confirmados. Se
registran como telemetría redactada y métricas agregadas. Solo aquellos con relevancia real de
seguridad —por ejemplo, intento de acceso cruzado, manipulación o abuso— generan además evidencia
durable separada. La clasificación se hará mediante un catálogo de códigos y criterios explícitos;
un timeout, validación ordinaria o retry no adquiere esa relevancia automáticamente. La evidencia
de seguridad se persiste fuera de la transacción financiera revertida y nunca afirma un posting.

### Identidad y trazabilidad

Cada fila futura de auditoría tendrá:

- `auditEventId`, `eventName`, `eventVersion`, `recordedAt` y `resultCode` controlado;
- `actorType: User | Service`, `actorUserId` cuando corresponda y principal estable para jobs;
- `householdId` obligatorio;
- `operationId` obligatorio para flujos financieros;
- `previewId` y `previewVersion` cuando exista confirmación;
- `transactionId` para el efecto confirmado;
- `idempotencyRecordId`, nunca la clave o fingerprint;
- `correlationId` generado o validado en el límite del servidor;
- `channel: mobile | api | job | ai`;
- referencia a evento/transacción causal u original para correcciones.

Los campos condicionales se validarán por tipo/version de evento. IDs conocidos no conceden acceso.
`correlationId` relaciona audit trail y telemetría de una ejecución; `operationId` e idempotencia
relacionan retries que pueden tener correlaciones distintas. El `traceId` permanece en telemetría y
no es requisito durable del audit trail.

Cuando la IA prepare una intención, el `actorUserId` continúa siendo el usuario autorizado y el
canal es `ai`; ADR-004 impide que la IA confirme autónomamente. Un job autónomo usa
`actorType=Service`, principal de servicio, hogar explícito y referencia causal a la obligación o
acción que lo originó. Nunca se registra al modelo como actor legal ni se guarda razonamiento
interno, prompt o conversación.

### Atomicidad, failures y retries

La confirmación sigue este orden dentro de `withRlsContext(..., { intent: 'write' })`:

```text
lock de membership activa
→ lock/revalidación de preview
→ claim idempotente
→ posting y relaciones de corrección
→ audit event durable
→ consumo de preview y resultado idempotente
→ commit único
```

Si falla la auditoría, se revierten posting, preview e idempotencia. Después del rollback se emite
telemetría técnica con `correlationId`, etapa y código normalizado; esa señal no afirma que ocurrió
un efecto. La imposibilidad de emitir telemetría no permite confirmar sin audit trail, pero tampoco
debe reemplazar el error original ni filtrar datos al fallback.

Misma clave y fingerprint recuperan la transacción y el mismo audit event; no crean otra fila
financiera. Una clave distinta contra un preview consumido produce conflicto y telemetría, sin otro
evento durable. Reversal, replacement y adjustment crean nuevos eventos append-only enlazados; el
original no se actualiza.

### Redacción y allowlists

El audit trail conserva referencias, no copias del hecho. Quedan prohibidos en las cuatro señales:

- access/refresh tokens, cookies, passwords, secrets, API keys y connection strings;
- `Idempotency-Key`, fingerprint y digest completo de preview;
- importe, saldo, número/nombre de cuenta, tarjeta o instrumento;
- nombre, correo, descripción, categoría libre, nota, ubicación o contraparte;
- request/response body, argumentos de tools, prompts, conversación o razonamiento;
- SQL con parámetros, documentos, adjuntos y stack traces sin sanitizar.

Los errores usan `reasonCode` enumerado, etapa y clase, nunca mensajes internos o datos del recurso.
Una denegación no registra el `householdId` o recurso solicitado si el actor no estaba autorizado a
conocerlo. Cuando una investigación de seguridad necesite correlación entre intentos, logs pueden
usar una referencia pseudónima HMAC con clave operativa separada; no se usa como métrica ni se
considera anonimización irreversible.

Cada serializer de señal tendrá allowlist y pruebas negativas. Debug, desarrollo y soporte siguen
las mismas prohibiciones; los fixtures usan datos ficticios.

### RLS, append-only y acceso

- La tabla financiera de auditoría será tenant-scoped, con `household_id`, FKs compuestas, índices
  tenant-leading, `ENABLE` y `FORCE ROW LEVEL SECURITY` conforme a ADR-021.
- El runtime obtiene solo `INSERT` y las lecturas estrictamente necesarias; no recibe `UPDATE`,
  `DELETE`, `TRUNCATE` ni `BYPASSRLS`.
- Ningún Owner de Household obtiene bypass por su rol: no equivale a owner de tabla ni permite leer
  recursos privados ajenos o su auditoría.
- Los jobs usan rol separado, hogar explícito y policy/grants por capacidad.
- El owner PostgreSQL es `NOLOGIN`; el administrador/migrador no sirve tráfico.
- Una función/trigger endurecido puede reforzar append-only, pero no sustituye grants ni RLS.
- El acceso futuro break-glass requiere identidad de soporte individual, justificación obligatoria,
  privilegio temporal y acotado, y auditoría durable del propio acceso. Queda fuera del runtime
  ordinario y no se habilita si no puede garantizarse esa evidencia. El operador no puede editar
  ordinariamente el registro de su acceso; un rol Owner no concede esta capacidad.
- Cualquier purge futuro usa rol de retención separado y política aprobada por ADR-018; nunca se
  concede `DELETE` al runtime para conveniencia.

Append-only protege frente a la aplicación ordinaria, no frente a un administrador de base de
datos. Tamper evidence criptográfica o copia WORM externa se evaluará antes de beta junto con
ADR-018/020 y el modelo operacional; no se promete con una tabla relacional por sí sola.

### Retención

Como política provisional, un audit event de un efecto confirmado se conserva mientras exista el efecto financiero o su
historia correctiva. Su retención no se acorta por expirar el preview ni por cerrar la clave
idempotente. La retención exacta, anonimización y eliminación legal se fijarán en ADR-018; hasta
entonces no se permite hard delete operacional.

Los previews no consumidos siguen ADR-011/018. Logs y traces tendrán retenciones temporales por
ambiente y finalidad; métricas solo conservan agregados. El registro durable de seguridad y de
accesos de soporte tendrá su política explícita en ADR-018, sin heredar el TTL de logs. Ninguna
extracción, backup o ticket puede prolongar retención informalmente.

### Métricas y tracing mínimos

Métricas iniciales aceptadas, con labels enumerados y de baja cardinalidad:

- `financial_confirmation_total{operation_kind,outcome,channel}`;
- `financial_confirmation_duration_seconds{operation_kind,outcome}`;
- `financial_preview_total{outcome}`;
- `financial_idempotency_total{outcome}`;
- `financial_posting_rollback_total{reason_class}`;
- `financial_authorization_denial_total{operation_kind}`;
- `financial_balance_invariant_failure_total`;
- `financial_job_total{job_kind,outcome}`.

No son labels actor, hogar, cuenta, operación, preview, transacción, correlation ID, importe,
descripción ni categoría. No se suman importes ni saldos. Cualquier métrica de producto/analytics
requiere finalidad y tratamiento separados.

Spans futuros cubrirán validación, contexto/lock RLS, preview, claim idempotente, posting y escritura
de auditoría. Sus atributos se limitan a operación, resultado, etapa, versión y tiempos. No capturan
payload, SQL parametrizado, bodies ni eventos de ledger. Logs incluyen automáticamente
`traceId`/`spanId` cuando existan y siempre conservan `correlationId`.

### Investigación y operación

El flujo de diagnóstico será:

```text
correlationId del incidente
→ logs/traces redactados
→ operationId/transactionId si existe un hecho confirmado
→ consulta autorizada del audit trail bajo RLS
→ consulta separada de la fuente financiera solo si es necesaria
```

El acceso de soporte se limita por caso, tiempo y household; toda exportación se redacta. No se
copian filas, prompts o payloads a tickets. Cambiar niveles de logging, allowlists, sampling o
retención usa change management y no puede desactivar eventos críticos. La ausencia de auditoría o
un fallo de balance dispara alerta; perder telemetría no altera el ledger, pero se trata como
degradación operacional visible.

### Historial visible para el usuario

Se prevé un historial financiero como proyección UX del audit trail. Mostrará acciones y
correcciones comprensibles mediante consultas autorizadas por hogar, recurso y visibilidad; cualquier
dato financiero se obtendrá de su fuente autorizada. No expondrá directamente filas, campos
técnicos, security events ni registros de soporte. Owner no obtiene bypass. Esta decisión no crea
ahora una pantalla, endpoint o contrato y no convierte la proyección en fuente de saldos.

## Evidencia

Un harness desechable independiente del schema productivo validó la propuesta sobre Node 24.18.0,
PostgreSQL 18.4, `pg` 8.23.0 y PgBouncer 1.25.2 en `pool_mode=transaction`.

| Caso | Directo | PgBouncer |
|---|---:|---:|
| Roles, `FORCE RLS` y grants append-only | PASS | PASS |
| Preview, idempotencia, posting y auditoría en un commit | PASS | PASS |
| Fallo de auditoría revierte todo el efecto | PASS | PASS |
| Runtime sin `UPDATE`, `DELETE` o `TRUNCATE` | PASS | PASS |
| Aislamiento actor/hogar y fail-closed | PASS | PASS |
| Owner forzado y job con hogar explícito | PASS | PASS |
| Retry/respuesta perdida sin duplicar hecho | PASS | PASS |
| Reversal enlazado sin mutar el original | PASS | PASS |
| Allowlists separadas y sin datos prohibidos | PASS | PASS |
| Rollback visible sin crear un hecho financiero falso | PASS | PASS |

Resultado: `AUDIT_OBSERVABILITY_DIRECT=10/10 PASS` y
`AUDIT_OBSERVABILITY_POOLER=10/10 PASS`. Cada ejecución eliminó schema, roles, contenedores,
volúmenes e imagen local. No se modificaron Prisma ni migraciones productivas.

La propuesta sigue la separación de audit/transaction logs y security logging de OWASP, la
correlación de señales de OpenTelemetry y el modelo fail-closed/least-privilege de PostgreSQL.

## Consecuencias

### Positivas

- La auditoría confirma exactamente los hechos que llegaron a commit.
- La trazabilidad es reconstruible sin duplicar importes, descripciones o payloads.
- Un retry o rollback no crea movimientos ni audit events financieros falsos.
- RLS, grants y roles separan hogares, jobs, soporte y administración.
- Telemetría puede evolucionar o cambiar de proveedor sin reescribir historia financiera.

### Negativas y riesgos

- Investigar requiere correlacionar fuentes con retenciones distintas.
- Fallos anteriores a commit no quedan en el audit trail financiero; los relevantes para seguridad
  requieren persistencia separada y un catálogo explícito de clasificación.
- Referencias pseudónimas siguen siendo datos sensibles y requieren gestión de claves/retención.
- Append-only relacional no impide alteración por un administrador privilegiado.
- El catálogo, allowlists y reason codes deben versionarse junto con cada operación.
- El volumen de previews requiere límites y política de retención todavía pendiente.
- Proveedor, sampling, SLO, alertas y almacenamiento concreto se decidirán al implementar y antes de
  beta sin debilitar este baseline.

## Plan de adopción

1. **Completado:** aceptación humana explícita el 2026-09-04.
2. Diseñar en la primera historia financiera el catálogo versionado, serializers allowlist y
   propagación de `correlationId` antes de exponer endpoints.
3. Crear una migración nueva tenant-scoped para auditoría con RLS, FKs compuestas, índices y grants
   append-only; no modificar la tabla actual ni migraciones aplicadas sin estrategia explícita.
4. Insertar el audit event en la misma transacción corta que preview, idempotencia y ledger.
5. Incorporar logs/traces/métricas mediante adaptadores separados y pruebas de redacción; conservar
   separadamente los fallos/denegaciones de seguridad relevantes de forma durable.
6. Probar atomicidad, aislamiento, retries, correcciones y degradación de cada sink directamente y
   detrás de PgBouncer.
7. Antes de beta, resolver ADR-018/020, implementar los controles aceptados de soporte/break-glass,
   alertas/runbooks y evaluar una copia externa tamper-evident. Planear la proyección UX del
   historial en la historia correspondiente.

Una sustitución de proveedor de telemetría no migra ni reinterpreta el audit trail. Un cambio de
schema de evento incrementa `eventVersion` y conserva lectores históricos soportados.

## Registro de aceptación humana — 2026-09-04

- Audit trail, logs, tracing y métricas permanecen separados.
- Solo fallos/denegaciones con relevancia real de seguridad se almacenan durablemente en un registro
  separado; errores operativos ordinarios quedan en telemetría temporal.
- Audit trail reference-only, sin duplicar importes, saldos, descripciones, prompts ni secretos.
- Retención provisional ligada a la vida del efecto financiero hasta ADR-018.
- Break-glass futuro exige identidad de soporte, justificación, privilegio temporal y auditoría
  durable del propio acceso.
- Ningún Owner obtiene bypass por su rol.
- Actor causal y canal son distintos: la IA no sustituye al usuario que confirma; jobs autónomos
  usan service principal y conservan su cadena causal.
- El historial financiero visible será una proyección UX autorizada, nunca exposición directa del
  registro técnico.

Estas decisiones cierran la revisión humana del baseline. Los periodos legales de ADR-018 y la
operación de beta siguen pendientes en sus fases; no son gates arquitectónicos previos a Fase 3.
La evidencia técnica anterior corresponde al harness de investigación, no a una implementación
productiva de estos controles.

## Referencias

- [Arquitectura](../04-architecture.md)
- [Comportamiento de IA](../06-ai-behavior.md)
- [Seguridad y privacidad](../07-security-and-privacy.md)
- [Definition of Done](../08-definition-of-done.md)
- [ADR-003](0003-ledger-signos-cuentas-tecnicas-e-invariantes.md)
- [ADR-004](0004-estados-preview-confirmacion-y-correcciones.md)
- [ADR-008](0008-idempotencia-concurrencia-y-alcance-de-claves.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OpenTelemetry Logs](https://opentelemetry.io/docs/specs/otel/logs/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/general/)
- [PostgreSQL 18 — Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL 18 — Privileges](https://www.postgresql.org/docs/18/ddl-priv.html)
- [PostgreSQL 18 — Trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
