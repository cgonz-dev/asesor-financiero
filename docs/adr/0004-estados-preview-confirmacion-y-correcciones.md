# ADR-004: Estados, preview, confirmación y correcciones financieras

- Estado: Aceptado
- Fecha: 2026-09-04
- Aceptado el: 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — preview y confirmación
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Una intención todavía editable no puede afectar saldos. Antes de confirmar, la persona debe ver el
efecto exacto que el backend validó; durante la confirmación, ni el cliente, ni un retry, ni una IA
pueden sustituir ese efecto por otro. Recalcular silenciosamente entre ambas etapas introduce una
ventana TOCTOU y rompe la relación entre lo mostrado y lo contabilizado.

ADR-002 fija Money e identidad estable de operación para residuos; ADR-003 fija ledger inmutable y
correcciones aditivas; ADR-008 fija idempotencia; ADR-009 fija fechas; ADR-021 exige autorización,
RLS y locking de membership dentro de transacciones `READ COMMITTED`. Este ADR define el vínculo
entre esas decisiones. Su aceptación fija la arquitectura, pero no autoriza contratos, tablas,
endpoints, UI ni el inicio de Fase 3.

## Restricciones y criterios

- El preview no afecta ledger, saldos ni obligaciones confirmadas.
- La persona confirma los datos significativos que finalmente se ejecutan: “what you see is what
  you confirm”.
- Una versión mostrada nunca cambia; cualquier variación semántica crea otra versión.
- Expiración, autorización, dependencias e idempotencia se verifican en servidor.
- El preview no es una credencial bearer ni concede acceso por conocer su ID.
- Solo una confirmación puede consumir una versión.
- Reintentos de la misma confirmación no duplican; otra intención no reutiliza la clave.
- IA, red y espera de usuario ocurren fuera de la transacción de posting.
- Una corrección de un hecho confirmado agrega historia enlazada; nunca lo reescribe.

## Opciones consideradas

### A. Snapshot inmutable persistido por el servidor

El backend conserva cada versión canónica, su digest, dependencias, vigencia y estado. Confirmar
referencia esa versión y el servidor la bloquea/revalida antes de posting.

Ventajas:

- conserva exactamente lo mostrado y permite auditoría/recovery;
- serializa consumo, superseding e idempotencia con constraints y locks;
- permite invalidación por cambios de recursos sin confiar en el cliente;
- el request de confirmación no repite campos económicos modificables.

Costos y riesgos:

- añade almacenamiento y lifecycle;
- exige separar expiración de uso y retención de evidencia;
- requiere índices, RLS, cleanup y límites para evitar abuso.

### B. Token firmado autocontenido

El servidor firma el preview y el cliente lo devuelve al confirmar.

Ventajas: reduce lecturas y puede evitar persistir previews no consumidos.

Costos y riesgos: el token se aproxima a una credencial replayable, revocar/superseder exige estado
adicional, la rotación de claves complica compatibilidad y la invalidación de dependencias termina
requiriendo recálculo o persistencia. Firmar integridad no prueba autorización vigente ni consumo
único.

### C. Recalcular al confirmar

El cliente conserva la intención y el backend vuelve a derivar el resultado al confirmar.

Ventajas: menos estado intermedio.

Costos y riesgos: lo ejecutado puede diferir de lo mostrado por cambios en datos, reglas o tiempo;
la equivalencia completa es difícil de demostrar y una comparación tardía reconstruye de facto un
snapshot sin sus garantías de lifecycle.

## Decisión

Adoptar la **opción A: snapshot inmutable persistido por el servidor**. Los tokens firmados no
sustituyen estado/autorización y el recálculo no podrá ejecutar silenciosamente una intención
distinta. Se podrá recalcular para detectar staleness o construir una nueva versión, nunca para
mutar la que la persona confirmó.

### Identidades, versiones y contenido

Cada intención confirmable tendrá:

- `operationId`: UUIDv4 opaco y estable durante todas sus revisiones y retries;
- `previewId`: UUIDv4 opaco nuevo para cada snapshot inmutable;
- `previewVersion`: entero positivo y creciente dentro de `operationId`;
- `schemaVersion`: versión de la forma canónica;
- `rulesVersion`: versión de las reglas/constructores que derivaron el efecto;
- `contentDigest`: SHA-256 sobre JSON canónico RFC 8785;
- `createdAt` y `expiresAt`: instantes UTC generados por el servidor;
- actor interno y `householdId` a los que está ligado;
- referencias/versiones de todas las dependencias que pueden cambiar la validez.

`operationId` no cambia al corregir un borrador porque ADR-002 lo necesita para que un reparto de
residuos sea reproducible y no manipulable regenerando IDs. Una intención distinta, incluida una
corrección posterior a un posting, recibe otro `operationId`.

El contenido canónico incluirá como mínimo operación, Money, fechas, cuentas/recursos, ownership,
visibilidad, participantes, entradas derivadas, enlaces de corrección, warnings confirmables y
versiones de reglas/dependencias. No incluirá textos puramente visuales, access tokens,
correlation IDs, `Idempotency-Key` ni timestamps de transporte.

El preview presentado será una proyección segura de ese snapshot. La API nunca serializará el
snapshot de persistencia completo ni relaciones que el actor no deba ver.

### Lifecycle

| Estado | Entrada permitida | Salida permitida | Efecto financiero |
|---|---|---|---|
| `Active` | creación de versión | `Superseded`, `Expired`, `Cancelled`, `Consumed` | ninguno |
| `Superseded` | nueva versión de la misma operación | terminal | ninguno |
| `Expired` | reloj del servidor supera `expiresAt` | terminal | ninguno |
| `Cancelled` | cancelación explícita autorizada | terminal | ninguno |
| `Consumed` | commit único de confirmación | terminal | referencia al resultado confirmado |

El contenido económico es inmutable en todos los estados; solo lifecycle y enlace al resultado
pueden avanzar. Crear una versión nueva marca `Superseded` la activa anterior dentro de la misma
transacción. Los estados terminales no se reactivan.

La vigencia inicial es **15 minutos**, medida exclusivamente por el servidor y sin
renovación deslizante. Un preview expirado requiere una versión nueva, aunque la intención siga
siendo idéntica. El TTL podrá parametrizarse por clase de operación solo mediante una regla
documentada y acotada; el cliente no lo elige.

Expirar para uso no equivale a borrar. Un preview consumido se conserva junto con su efecto y
auditoría. La retención física de previews no consumidos corresponde a ADR-011/ADR-018 y no puede
reabrirlos ni permitir replay.

### Invalidación y cambios

Una modificación de cualquier dato persistido o mostrado como parte de la decisión crea otra
versión. Esto incluye:

- tipo de operación, importe, moneda, cuentas o entradas derivadas;
- `occurredAt`, `effectiveDate`, `dueDate` o zona efectiva;
- participantes, ownership, visibilidad, categoría o descripción persistida;
- operación original, tipo de corrección o resultado before/after;
- warnings, reglas o resultados contables.

Al confirmar, la versión falla como `PREVIEW_STALE` si cambió una precondición: estado/versión de
cuenta, moneda habilitada, permisos, visibilidad, membresía, configuración financiera, operación
original o cualquier recurso usado para derivarla. La autorización siempre se reevalúa aunque no
exista una versión explícita que comparar.

Sin crear otra versión solo pueden cambiar navegación, expansión de secciones, formato de
presentación y otras preferencias locales que no viajen al posting, auditoría o fingerprint. La
allowlist inicial de metadata editable después de confirmar es vacía. Una historia futura puede
permitir campos descriptivos concretos con actualización auditada; ante duda se usa replacement,
adjustment, reversal o reclasificación conforme al caso.

### Operaciones que requieren confirmación

Requieren preview todas las acciones que:

- crean entradas del ledger, incluido un opening balance;
- revierten, reemplazan o ajustan un hecho confirmado;
- crean una diferencia de conciliación con efecto;
- crean o alteran una obligación/instrucción que pueda producir efectos financieros futuros.

No requieren este flujo las lecturas, la edición de un borrador todavía no validado, preferencias
visuales y configuración sin efecto financiero. Crear/editar una cuenta sin saldo utilizará una
acción explícita normal; si incluye saldo inicial, entra al flujo confirmable. Toda operación
financiera futura declara `confirmationPolicy`; el default seguro para una escritura con efecto es
`Required` y omitirla no equivale a `None`.

### Confirmación desde UI y futura IA

El actor que confirma debe ser el mismo `User` interno para quien se creó el preview. Aprobación
por otro integrante, firmas múltiples o delegación quedan fuera del MVP.

La UI mostrará operación, importe/moneda, cuentas o contrapartidas comprensibles, fecha efectiva,
alcance, corrección, efecto y warnings significativos. La acción será explícita y permanecerá
vinculada a `previewId + previewVersion`; no se acepta un submit genérico con campos económicos.

La IA puede interpretar, completar un borrador y solicitar un preview, pero no confirmarlo por
iniciativa propia. Una respuesta conversacional solo cuenta si la aplicación la vincula de forma
estructurada e inequívoca con un único preview visible, activo y vigente. El backend registra
actor, canal, versión y resultado, no razonamiento interno ni conversación completa.

### Fingerprint e idempotencia

El request futuro de confirmación transportará `previewId`, `previewVersion` y el header
`Idempotency-Key`. `contentDigest` podrá devolverse para diagnóstico/integridad del cliente, pero
el servidor usa como autoridad el valor persistido y no acepta un digest alternativo.

El fingerprint de ADR-008 incluirá de forma canónica:

```text
schemaVersion + householdId + actorUserId + operationKind
+ operationId + previewId + previewVersion + contentDigest
```

- misma clave y misma versión: recupera el mismo resultado;
- misma clave con otra versión/digest: `409 IDEMPOTENCY_CONFLICT`;
- claves diferentes contra la misma versión concurrente: una consume; la otra recibe
  `409 PREVIEW_ALREADY_CONFIRMED`;
- si la respuesta se pierde después del commit, el retry usa la clave original;
- si toda la transacción revierte, no sobreviven consumo, posting ni claim idempotente y se puede
  reintentar mientras el preview siga activo/vigente.

El consumo único del preview es una barrera adicional a la clave idempotente. Un preview consumido
con otra clave nunca vuelve a ejecutar; tras reautorizar puede devolver una referencia segura al
resultado existente junto con el conflicto.

### Orden de confirmación y atomicidad

Fuera de la transacción se validan únicamente forma, sesión y datos suficientes para localizar la
intención. La ejecución autoritativa será:

```text
withRlsContext(actor, household, { intent: 'write' })
  → READ COMMITTED
  → lock FOR SHARE de HouseholdMembership Active
  → cargar preview por actor/hogar y bloquearlo FOR UPDATE
  → reautorizar recursos, ownership y visibilidad
  → comprobar estado, versión, TTL, digest y dependencias
  → calcular/consultar fingerprint y claim de idempotencia
  → posting de ledger + relaciones de corrección + auditoría
  → marcar preview Consumed y enlazar resultado
  → commit único
```

Solo el `TransactionClient` tenant-aware cruza repositorios. Espera humana, red e IA no viven en
esta transacción. Si membership, preview o dependencia fue bloqueada primero por otra operación,
se observa el estado confirmado al adquirir el lock y se falla cerrado.

### Correcciones

Una transacción confirmada no vuelve a estado editable:

- `reversal` crea un preview que muestra la neutralización exacta;
- `replacement` muestra como una unidad la reversión y el nuevo posting, y ambos confirman o
  revierten juntos;
- `adjustment` muestra únicamente la diferencia y su efecto;
- una reclasificación sin cambio económico será auditada y se decidirá con ADR-010.

Cada corrección usa nueva intención, preview e idempotency key y enlaza el resultado original. El
preview debe mostrar claramente original, cambio y resultado esperado sin exponer recursos
privados no autorizados.

### Errores y seguridad contra replay

Errores públicos conceptuales, sujetos al primer contrato:

| Condición | HTTP/código propuesto |
|---|---|
| inexistente, otro hogar/actor o existencia no revelable | `404 PREVIEW_NOT_AVAILABLE` |
| expirado | `409 PREVIEW_EXPIRED` |
| superseded, cancelado o dependencia modificada | `409 PREVIEW_STALE` |
| consumido con otra clave | `409 PREVIEW_ALREADY_CONFIRMED` |
| misma clave con fingerprint distinto | `409 IDEMPOTENCY_CONFLICT` |
| confirmación concurrente todavía bloqueada | error reintentable y `Retry-After` según ADR-008 |

Los IDs son opacos pero no secretos. Conocerlos no concede lectura/confirmación. El servidor
aplica rate limits, errores no enumerables, RLS forzado, actor/hogar exactos y una transición única
de `Active` a `Consumed`. Logs no contienen payload, digest completo, clave idempotente ni datos
financieros; ADR-019, aceptado el 2026-09-04, fija allowlists, métricas y auditoría operacional.

## Evidencia

Un harness desechable independiente del schema productivo validó la hipótesis sobre Node 24.18.0,
PostgreSQL 18.4, `pg` 8.23.0 y PgBouncer 1.25.2 en `pool_mode=transaction`.

| Caso | Directo | PgBouncer |
|---|---:|---:|
| Inmutabilidad, superseding y TTL de servidor | PASS | PASS |
| Expired/superseded fail-closed | PASS | PASS |
| Misma clave/preview produce un resultado | PASS | PASS |
| Misma clave con otro preview produce conflicto | PASS | PASS |
| Claves distintas no consumen dos veces | PASS | PASS |
| Respuesta perdida y rollback completo | PASS | PASS |
| Dependencia modificada invalida | PASS | PASS |
| RLS, actor binding y cross-household | PASS | PASS |
| Revocación ordenada por lock de membership | PASS | PASS |
| Reversal/replacement/adjustment enlazados y balanceados | PASS | PASS |

Resultado: `PREVIEW_CONFIRMATION_DIRECT=10/10 PASS` y
`PREVIEW_CONFIRMATION_POOLER=10/10 PASS`. Cada ejecución eliminó schema, roles, contenedores,
volúmenes e imagen local. Los probes no generaron cliente Prisma ni alteraron migraciones; las
suites aceptadas de ADR-021 cubren adicionalmente el `TransactionClient` de Prisma.

La evidencia coincide con las guías de autorización transaccional de OWASP: datos significativos
generados/protegidos en servidor, invalidación al cambiar y un control final ligado a la ejecución.

## Consecuencias

### Positivas

- Lo confirmado corresponde exactamente a una versión mostrada y auditable.
- Preview e idempotencia se complementan: uno fija contenido/consumo y la otra recupera retries.
- Los cambios de dependencias fallan cerrado sin recalcular silenciosamente.
- UI e IA comparten el mismo servicio y ninguna se convierte en autoridad financiera.
- Correcciones preservan historia y atomicidad del ledger.

### Negativas y riesgos

- Persistir cada versión añade almacenamiento, índices y cleanup.
- El TTL puede interrumpir una revisión lenta; regenerar debe ser claro y conservar la intención.
- Versionar todas las dependencias relevantes exige disciplina en constructores y repositorios.
- Un actor puede producir previews no consumidos; se necesitan límites y retención posterior.
- La allowlist vacía de metadata obliga inicialmente a generar correcciones para cualquier cambio
  persistido, privilegiando seguridad sobre comodidad.
- Los contratos exactos e instrumentación se implementarán en la historia correspondiente conforme
  al baseline aceptado de ADR-019.

## Plan de adopción

1. **Completado:** aceptar este ADR.
2. **Completado:** aceptar el baseline de
   [ADR-019](0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md) el 2026-09-04.
3. Definir tipos puros de lifecycle, clasificación de operaciones y canonicalización en dominio.
4. Publicar contratos Zod/OpenAPI con errores estables conforme a ADR-007/ADR-008.
5. Diseñar una migración nueva tenant-scoped con FKs compuestas, RLS, índices y consumo único según
   ADR-021; no modificar migraciones aplicadas.
6. Implementar creación/confirmación en servicios separados y posting dentro de una sola
   transacción corta.
7. Añadir pruebas de propiedad, concurrencia, RLS/PgBouncer, replay, autorización y compatibilidad
   móvil antes de exponer la primera operación.

Un cambio posterior de TTL o metadata no reinterpreta previews consumidos. Un cambio incompatible
de forma/reglas incrementa su versión y conserva lectores para evidencia histórica soportada.

## Decisiones aceptadas

- snapshot inmutable persistido frente a token firmado o recálculo;
- TTL inicial de 15 minutos sin renovación deslizante;
- confirmación limitada al mismo actor en el MVP;
- conflicto seguro para un preview consumido con otra clave;
- allowlist inicial vacía de metadata editable;
- confirmación obligatoria para todo posting, corrección y obligación financiera futura.

## Referencias

- [Reglas de dominio](../02-domain-rules.md)
- [Comportamiento de IA](../06-ai-behavior.md)
- [ADR-002](0002-representacion-monetaria-moneda-redondeo-y-division.md)
- [ADR-003](0003-ledger-signos-cuentas-tecnicas-e-invariantes.md)
- [ADR-006](0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [ADR-007](0007-contratos-validacion-openapi-y-cliente.md)
- [ADR-008](0008-idempotencia-concurrencia-y-alcance-de-claves.md)
- [ADR-009](0009-fechas-financieras-zona-horaria-y-periodos.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [OWASP Transaction Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Transaction_Authorization_Cheat_Sheet.html)
- [RFC 8785 — JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [PostgreSQL 18 — Explicit Locking](https://www.postgresql.org/docs/18/explicit-locking.html)
- [PostgreSQL 18 — Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
