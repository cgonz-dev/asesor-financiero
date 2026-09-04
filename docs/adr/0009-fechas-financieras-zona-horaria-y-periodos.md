# ADR-009: Fechas financieras, zona horaria y periodos

- Estado: Aceptado
- Fecha: 2026-09-03
- Aceptado el: 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — fundamentos financieros
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Un instante y una fecha civil contestan preguntas distintas. “¿Cuándo ocurrió?” puede requerir una
línea temporal global; “¿a qué quincena pertenece?” y “¿cuándo vence?” son decisiones de calendario
local. Convertir toda fecha a medianoche UTC desplaza días en algunas zonas, mientras almacenar
solo hora local pierde el instante y hace ambiguos los cambios de horario de verano.

Esta decisión fue aceptada explícitamente el 4 de septiembre de 2026, antes de persistir un
movimiento, vencimiento o recurrencia. No implementa scheduler o recurrencias, no inicia Fase 3 y
no autoriza por sí sola cambios de contratos, schema o producto.

## Restricciones y criterios

- Un instante se ordena globalmente; una fecha civil conserva el día elegido por la persona.
- Los formatos públicos deben ser estrictos, canónicos y compatibles con ADR-007.
- El backend no infiere autoridad financiera desde la zona configurada en un dispositivo.
- Gaps y folds de DST se resuelven explícitamente, no por normalización silenciosa del runtime.
- Cambiar la zona del hogar no reescribe historia confirmada.
- Periodos y recurrencias se calculan con calendario, no con duraciones fijas en milisegundos.
- Idempotencia y ledger deben usar los mismos valores temporales normalizados.

## Opciones consideradas

### A. Solo instantes UTC

Todos los conceptos se convierten a `timestamptz`.

Ventajas: orden total sencillo y una sola forma de persistencia.

Riesgos: una fecha de vencimiento no tiene un instante natural; medianoche UTC puede cambiar de día
al presentarse; periodos y fin de mes dependen de una zona que ya no quedó registrada.

### B. Solo fecha/hora local y zona

Se conserva el texto local junto con una zona IANA.

Ventajas: mantiene intención de calendario y permite recalcular reglas futuras.

Riesgos: no siempre identifica un instante por gaps/folds; dificulta orden, auditoría y correlación
entre sistemas; una actualización del tzdb puede cambiar la resolución histórica.

### C. Modelo híbrido

Usar instantes UTC para hechos reales/auditoría, fechas civiles para efectos de calendario y una
zona IANA persistida cuando intervino en la derivación.

Ventajas: cada campo conserva la semántica que representa y evita conversiones destructivas.

Costos: existen varios tipos temporales y los adaptadores deben impedir que se mezclen.

## Decisión aceptada

Adoptar la **opción C: modelo híbrido**.

### Semántica de campos

| Campo | Semántica | PostgreSQL futuro | Contrato público |
|---|---|---|---|
| `occurredAt` | Instante real conocido en que ocurrió el hecho | `timestamptz(3)`, nullable si solo se conoce fecha | RFC 3339 con offset; respuesta canónica UTC `Z` |
| `recordedAt` | Instante inmutable en que el servidor aceptó/persistió el registro | `timestamptz(3) NOT NULL`, generado por servidor | RFC 3339 UTC `Z` |
| `effectiveDate` | Fecha civil que asigna el hecho al periodo financiero | `date NOT NULL` | `YYYY-MM-DD` estricto |
| `dueDate` | Fecha civil de vencimiento, sin hora implícita | `date`, nullable según recurso | `YYYY-MM-DD` estricto |
| `effectiveTimeZone` | Zona usada al derivar/explicar la fecha efectiva | identificador IANA validado | string IANA |

`occurredAt` y `recordedAt` son conceptos distintos y nunca se sustituyen entre sí. Consultas
históricas distinguirán al menos:

- vista económica “efectiva a fecha”, basada en `effectiveDate`;
- vista de conocimiento/auditoría “registrado hasta instante”, basada en `recordedAt`.

Cuando solo se conoce un día, `occurredAt` permanece `null` y se conserva `effectiveDate`; no se
inventa mediodía o medianoche. Cuando existe un instante, el backend puede derivar
`effectiveDate` en la zona financiera vigente, pero la fecha resultante se persiste y no se vuelve
a calcular silenciosamente.

### Autoridad de zona

La precedencia aceptada es:

1. zona IANA financiera del `Household`, validada por servidor;
2. zona IANA elegida explícitamente para una operación, si una regla futura la permite y audita;
3. zona del usuario/dispositivo únicamente como sugerencia de captura o presentación.

El cliente nunca concede autoridad enviando una zona. El hogar debe tener una zona financiera
explícita antes de confirmar su primer dato financiero. El valor se guarda como identificador IANA
(`America/Mexico_City`), no como abreviatura ni offset fijo.

Cambiar esa zona es una operación auditada y solo afecta nuevas derivaciones. Los instantes,
fechas efectivas y snapshots de zona históricos no se reescriben. Reportes futuros pueden mostrar
qué zona se usó.

### Contratos y adaptadores

- Instantes: perfil RFC 3339 estricto, offset obligatorio, precisión máxima de milisegundos y
  respuesta canónica UTC terminada en `Z`.
- Fechas civiles: `YYYY-MM-DD`, validación calendario real; no se aceptan timestamps.
- Zonas: allowlist proveniente de IANA tzdb; no se aceptan `CST`, `GMT-6` ni zonas inventadas.
- No se aceptan timestamps locales sin offset.
- Zod usará tipos branded separados (`Instant`, `LocalDate`, `IanaTimeZone`) y refinamientos
  explícitos; no un único `Date` de JavaScript.
- Prisma mapea `date` a `DateTime @db.Date`, pero el adaptador de persistencia lo convertirá de
  inmediato a `LocalDate` canónica. El dominio y los contratos nunca usarán ese objeto `Date` como
  fecha civil.

### Gaps y folds de DST

Si el producto captura fecha y hora locales para convertirlas en instante:

- debe incluir zona IANA;
- un gap (hora inexistente) se rechaza y pide otra hora; no se desplaza automáticamente;
- un fold (hora repetida) exige un offset explícito que corresponda a una de las dos alternativas;
- el valor confirmado conserva instante, offset de entrada y zona cuando sean necesarios para
  explicación/auditoría.

La base no decide por defecto cuál alternativa quiso la persona. Actualizar tzdb puede cambiar
reglas futuras, pero no modifica el instante ya confirmado.

### Periodos, cierres y recurrencias

Los periodos se modelan como intervalos civiles semiabiertos `[inicio, fin)`:

- día: una fecha a la siguiente fecha civil;
- mes: primer día del mes a primer día del mes siguiente;
- configuración predeterminada del MVP para un ciclo semi-monthly: días 1–15 como
  `[día 1, día 16)` y día 16–fin de mes como `[día 16, primer día del mes siguiente)`;
- años bisiestos y longitud de mes provienen del calendario gregoriano, no de tablas de 30 días.

La división 1–15/16–fin de mes es un valor predeterminado de configuración, **no una invariante del
dominio**. El modelo futuro distinguirá el tipo de ciclo y sus parámetros para admitir sin
reinterpretar historia: `semi-monthly`, cada 14 días desde una fecha ancla, semanal con día de
inicio, mensual y personalizado. Cada periodo materializado conservará la versión/configuración que
lo produjo. Cambiar el ciclo solo afecta periodos futuros y requiere una frontera efectiva
explícita; no reagrupa movimientos confirmados silenciosamente.

Una recurrencia futura conservará regla civil, zona IANA, hora local si aplica y política explícita
de fin de mes. No sumará `24h`, `15 días` o `30 días` en milisegundos para avanzar calendarios. La
ejecución, catch-up, outbox y jobs corresponden a ADR-014.

### Anclaje de fin de mes

Una regla mensual conserva su ancla original y calcula cada ocurrencia directamente sobre el mes
objetivo; nunca usa como nueva ancla la fecha ajustada del mes anterior.

- `dayOfMonth(N)`: usa el día `N` cuando existe; en un mes más corto usa temporalmente su último
  día. Una regla anclada al 31 produce 31 de enero → 28/29 de febrero → 31 de marzo, sin derivar
  permanentemente al 28/29. Una regla al 30 vuelve al 30 cuando sea posible.
- `endOfMonth`: siempre usa el último día real del mes, incluso después de meses de distinta
  longitud.

El tipo de ancla y su valor se persisten como parte de la regla. La fecha ajustada es una ocurrencia,
no una mutación de la regla. Si además existe una hora local, su conversión aplica las reglas
estrictas de gap/fold y la zona IANA financiera.

## Consecuencias

### Positivas

- Vencimientos y periodos no cambian de día al serializarse.
- La auditoría conserva una línea temporal UTC independiente del efecto financiero.
- Los cambios de zona y tzdb no reinterpretan historia.
- Ledger e idempotencia disponen de valores temporales canónicos.

### Negativas y riesgos

- Adaptadores y desarrolladores deben distinguir tres tipos temporales.
- La zona financiera del hogar se convierte en configuración sensible y auditada.
- Los cambios regulatorios del tzdb requieren actualización operacional.
- La ejecución de ciclos personalizados y recurrencias sigue pendiente, aunque la forma aceptada
  evita fijar la quincena del MVP como regla universal y evita el drift de fin de mes.
- El tratamiento de gaps/folds añade una interacción explícita en captura avanzada.

## Evidencia y validación

El probe desechable sobre PostgreSQL 18.4 validó:

| Caso | Resultado |
|---|---|
| Round-trip `date` de `2024-02-29` | conserva `2024-02-29` |
| Fold `2024-11-03 01:30` en Nueva York | dos instantes válidos separados por 3600 segundos |
| Gap `2024-03-10 02:30` en Nueva York | PostgreSQL lo normaliza; confirma que debe rechazarse antes |
| `2024-01-31 + 1 month` | `2024-02-29`; exige política de anclaje para recurrencias |
| Prisma `@db.Date` | objeto JS a medianoche UTC; exige adaptador civil |
| Prisma `timestamptz` | conserva el instante UTC exacto |

Antes de implementar se deben agregar pruebas de propiedad para serialización civil, límites de
mes, bisiestos, todas las zonas soportadas, gaps/folds y cálculo de periodos. La matriz de anclaje
debe incluir 31 de enero → 28/29 de febrero → 31 de marzo, `dayOfMonth(30)` y `endOfMonth`. La
validación de IANA debe probarse con la versión de tzdb desplegada.

## Plan de adopción

1. **Completado:** aceptar este ADR junto con ADR-002 antes del schema de ledger.
2. Definir tipos temporales puros y funciones calendario en `packages/domain`.
3. Publicar schemas Zod/OpenAPI según ADR-007, con tests de round-trip.
4. Incorporar la zona financiera del hogar mediante una migración nueva y un flujo auditado antes
   del primer movimiento.
5. Crear columnas `timestamptz(3)`/`date` apropiadas, índices tenant-leading y policies de ADR-021.
6. Registrar la versión operacional de tzdb y pruebas de actualización.

Una migración de zona o fecha nunca reescribe historia confirmada sin un procedimiento explícito,
reconciliación y auditoría.

## Decisiones aceptadas

- La zona IANA del Household es la autoridad financiera; usuario/dispositivo solo ayudan en captura
  o presentación.
- El MVP usa 1–15/16–fin de mes como configuración semi-monthly predeterminada, no como invariante;
  la arquitectura admite ciclos configurables posteriores.
- Los gaps DST se rechazan y los folds requieren un offset válido explícito.
- Las recurrencias mensuales conservan su ancla original mediante `dayOfMonth(N)` o `endOfMonth` y
  no derivan permanentemente después de un mes corto.

## Referencias

- [Reglas de dominio](../02-domain-rules.md)
- [ADR-007](0007-contratos-validacion-openapi-y-cliente.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [RFC 3339 — Date and Time on the Internet](https://www.rfc-editor.org/rfc/rfc3339)
- [IANA Time Zone Database](https://www.iana.org/time-zones)
- [IANA tz database theory](https://data.iana.org/time-zones/tzdb/theory.html)
- [PostgreSQL 18 — Date/Time Types](https://www.postgresql.org/docs/18/datatype-datetime.html)
- [Prisma schema reference — DateTime mappings](https://www.prisma.io/docs/orm/reference/prisma-schema-reference)
