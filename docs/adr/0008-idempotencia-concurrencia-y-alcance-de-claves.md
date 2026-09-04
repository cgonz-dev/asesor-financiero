# ADR-008: Idempotencia, concurrencia y alcance de claves

- Estado: Aceptado
- Fecha: 2026-09-03
- Aceptado el: 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — fundamentos financieros
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Una operación financiera puede llegar más de una vez por doble toque, pérdida de respuesta, retry
HTTP, recuperación móvil o un agente futuro. Repetir la intención no debe repetir el efecto; usar
la misma clave para otra intención tampoco debe devolver un éxito engañoso.

Idempotencia no reemplaza autenticación, autorización, validación, balance ni control de
concurrencia sobre recursos. Debe formar parte del mismo commit que el ledger y funcionar dentro
del patrón RLS aceptado.

Este ADR depende de las representaciones canónicas aceptadas por ADR-002/ADR-009 y de la unidad
atómica aceptada por ADR-003. Su aceptación fija la estrategia arquitectónica, pero no inicia Fase
3 ni autoriza por sí sola un header, contrato, tabla o endpoint nuevo.

## Restricciones y criterios

- Requests no autenticados o no autorizados nunca reservan una clave.
- Una clave identifica una intención dentro de un scope; no se deriva del payload.
- Misma clave e intención producen un solo efecto y un resultado estable.
- Misma clave con intención distinta falla con conflicto estable.
- La deduplicación se sostiene bajo concurrencia real de PostgreSQL, no en memoria de proceso.
- Idempotencia, ledger y auditoría se confirman en una sola transacción tenant-aware.
- Un rollback permite un retry legítimo; una respuesta perdida después de commit no duplica.
- No se guardan secretos ni payloads financieros completos para deduplicar.

## Opciones consideradas

### A. Clave en header generada por cliente/orquestador

Usar `Idempotency-Key` como header opaco de alta entropía.

Ventajas: separa metadata de transporte del comando, puede reutilizarse tras timeout y funciona
para móvil o IA.

Riesgos: el cliente debe conservar la clave para la misma intención; el nombre se inspira en un
Internet-Draft expirado y no debe presentarse como estándar RFC vigente.

### B. Clave dentro del body

Ventajas: queda junto al comando y puede formar parte de tipos de request.

Riesgos: contamina todos los schemas de dominio, dificulta middlewares uniformes y puede entrar
accidentalmente al fingerprint de sí misma.

### C. Clave derivada por servidor desde el payload

Ventajas: no exige estado del cliente y agrupa payloads idénticos.

Riesgos: dos intenciones legítimas idénticas se fusionan; campos equivalentes pueden serializarse
de forma distinta; una corrección menor cambia la identidad de operación.

## Decisión aceptada

Adoptar la **opción A**, con una clave opaca generada por quien inicia la operación y un
fingerprint separado calculado por el servidor.

### Formato y scope

- Header futuro: `Idempotency-Key`.
- Valor canónico: UUIDv4 aleatorio válido generado con CSPRNG, no secuencial
  ni derivado de datos financieros/personales.
- Longitud y formato se validan antes de persistir; la clave no se interpreta como autorización.
- Scope único de base de datos:

```text
(household_id, actor_user_id, operation_kind, idempotency_key)
```

`operation_kind` es un identificador estable de caso de uso, no la ruta HTTP textual. La clave
puede repetirse en otro actor u operación sin colisión. Esto evita interferencia accidental, pero
no detecta dos actores enviando intencionalmente el mismo hecho; esa deduplicación semántica es un
problema distinto.

### Fingerprint de la intención

Después de validar y normalizar el comando, el servidor calcula SHA-256 sobre JSON canónico según
RFC 8785. El documento canónico incluye:

- versión del esquema semántico;
- `householdId`, actor interno y `operationKind`;
- importes minor-unit como strings y moneda de ADR-002;
- instantes/fechas/zonas canónicos de ADR-009;
- IDs opacos, cuentas, enlaces y versión de preview relevantes;
- valores por defecto ya materializados y arrays cuyo orden sea semántico.

Excluye access token, header de clave, correlation ID, timestamps de transporte, texto de UI y
campos no semánticos. Antes de hashear se rechazan propiedades desconocidas conforme a ADR-007.
No se registra el documento canónico ni el payload completo; se almacena solo el digest y la
versión.

### Orden del caso de uso

```text
parseo seguro del transporte
→ autenticación
→ autorización de household/recurso
→ validación y normalización semántica
→ fingerprint
→ withRlsContext(..., { intent: 'write' })
   → READ COMMITTED + lock de membership Active
   → reclamar/consultar clave idempotente
   → posting de cabecera + entries + auditoría
   → commit único
```

Una denegación no crea rastro idempotente que revele o bloquee el scope. Los valores autorizados
se revalidan dentro de la transacción según ADR-021.

### Concurrencia y resultados

Una constraint única no diferible sobre el scope serializa contendientes. La fila de idempotencia
y el efecto financiero viven en la misma transacción:

- primer request válido inserta la clave no confirmada y ejecuta el posting;
- un contendiente con el mismo scope espera al desenlace de la unicidad;
- si el primero confirma y el fingerprint coincide, el segundo devuelve el resultado confirmado
  sin ejecutar el efecto;
- si confirma con fingerprint distinto, devuelve `409 idempotency_conflict` sin revelar el
  payload original;
- si el primero revierte, su fila desaparece y el siguiente puede reclamar la clave;
- si se pierde la respuesta después del commit, el retry obtiene la referencia y status originales.

El registro completado conserva referencia opaca al resultado y código de éxito original, no una
copia indiscriminada de la respuesta. La API reconstruye una respuesta actual solo después de
volver a autorizar al actor.

La implementación fijará `lock_timeout`/timeout del caso de uso. Si el primer request continúa más
allá del límite, el contendiente responde un error estable y reintentable (“operación en curso”),
sin reclamar otra clave ni ejecutar el posting. El código HTTP exacto y `Retry-After` se fijarán en
el contrato de la primera operación.

### Estados, errores y retención

Para el posting síncrono inicial no se usará una fila duradera `InProgress`: la inserción queda
sin confirmar y es invisible hasta compartir commit con el ledger. Solo `Completed` sobrevive.
Una futura operación asíncrona requerirá estados/outbox y su propio ADR.

- Errores de parseo, autenticación, autorización, validación o rollback no se almacenan.
- Fallos transitorios revierten toda la transacción y permiten retry con la misma clave.
- Un éxito confirmado se conserva al menos mientras exista la transacción financiera y su
  auditoría. La decisión es no expirar por tiempo claves de efectos financieros confirmados.
- La eliminación/retención final debe alinearse con ADR-018; nunca se elimina solo para ahorrar
  espacio si eso permite duplicar un efecto histórico.

### Doble toque, HTTP e IA

El móvil bloquea visualmente doble toque, pero la base es la defensa autoritativa. Retries por red o
timeout reutilizan la clave original. Una intención nueva, incluso con payload idéntico, obtiene
otra clave.

Un agente de IA futuro podrá preparar comandos, pero el backend valida todo. Si reintenta la misma
intención confirmada, reutiliza la clave; si el usuario cambia o vuelve a confirmar una intención,
usa otra. La clave no reemplaza el ciclo de preview: ADR-004 define identidad, versión y caducidad
de la vista previa, que formarán parte del fingerprint.

### RLS y privacidad

La tabla futura será tenant-scoped, con `household_id`, RLS forzado y relaciones compuestas según
ADR-021. El runtime no consulta claves globalmente. Constraints de unicidad incluyen el hogar para
evitar canales laterales cross-household. Conforme al baseline aceptado de
[ADR-019](0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md), logs omiten clave,
fingerprint y payload y usan correlation ID; métricas solo admiten dimensiones agregadas de baja
cardinalidad, sin IDs ni hashes de la operación.

## Consecuencias

### Positivas

- Doble submit y retries concurrentes producen un solo commit financiero.
- Un cliente puede recuperar el resultado después de perder la respuesta.
- El fingerprint distingue reutilización accidental o maliciosa de una clave.
- La deduplicación comparte atomicidad, autorización y aislamiento con el ledger.

### Negativas y riesgos

- Cada operación confirmable necesita gestión de clave en cliente y almacenamiento adicional.
- La canonicalización debe versionarse; un cambio puede alterar fingerprints.
- Una transacción lenta mantiene locks y conexiones; el diseño exige posting corto.
- Retener claves por la vida del efecto aumenta almacenamiento.
- La idempotencia por actor no evita duplicados semánticos creados por actores distintos.
- El comportamiento exacto del error “en curso” queda por fijar con el primer contrato.

## Evidencia y validación

Un probe efímero con conexiones concurrentes sobre PostgreSQL 18.4 demostró:

| Caso | Resultado |
|---|---|
| Misma clave, mismo fingerprint concurrente | un efecto; el perdedor esperó y recuperó el resultado |
| Misma clave, fingerprint distinto | conflicto detectado, sin segundo efecto |
| Transacción original en rollback | la clave quedó disponible para retry |
| Respuesta simulada como perdida tras commit | retry recuperó el mismo ID de resultado |
| Misma clave en otro actor | scope independiente |

Antes de implementar deben probarse además timeouts, cancelación de request, muerte de proceso,
autorización revocada durante espera, RLS/PgBouncer y canonicalización equivalente de cada contrato
financiero.

## Plan de adopción

1. **Completado:** aceptar ADR-002, ADR-009 y ADR-003.
2. **Completado:** ADR-004 incorpora preview/version al fingerprint.
3. **Completado:** aceptar este ADR, UUIDv4 y la retención ligada al efecto. El contrato de la
   primera operación definirá el código público y la ventana de retry para “operación en curso”.
4. Implementar canonicalización/fingerprint como funciones puras versionadas y con vectores de
   prueba compartidos.
5. Crear una migración nueva con tabla tenant-scoped, constraint única e índices según ADR-021.
6. Integrar el claim y el posting en una sola transacción corta; probar concurrencia directa y con
   PgBouncer.
7. Incorporar métricas redactadas conforme al baseline de ADR-019, aceptado el 2026-09-04.

Una futura sustitución de formato mantiene la versión de fingerprint histórica. No se rehashean ni
expiran claves confirmadas sin una migración y análisis de duplicación.

## Decisiones aceptadas y trabajo derivado

- Se acepta retener una clave completada mientras exista su efecto financiero/auditoría.
- Se acepta UUIDv4 como forma canónica inicial del header.
- Se acepta un resultado público estable y reintentable para “operación en curso”; el código HTTP
  y la ventana de retry se fijarán en el contrato de la primera operación.
- ADR-004 fija los campos y versiones exactos de preview que entran al fingerprint.

## Referencias

- [ADR-002](0002-representacion-monetaria-moneda-redondeo-y-division.md)
- [ADR-003](0003-ledger-signos-cuentas-tecnicas-e-invariantes.md)
- [ADR-004](0004-estados-preview-confirmacion-y-correcciones.md)
- [ADR-007](0007-contratos-validacion-openapi-y-cliente.md)
- [ADR-009](0009-fechas-financieras-zona-horaria-y-periodos.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [RFC 8785 — JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785)
- [IETF HTTPAPI Idempotency-Key draft, expirado y archivado](https://datatracker.ietf.org/doc/html/draft-ietf-httpapi-idempotency-key-header)
- [PostgreSQL 18 — INSERT / ON CONFLICT](https://www.postgresql.org/docs/18/sql-insert.html)
- [PostgreSQL 18 — Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
