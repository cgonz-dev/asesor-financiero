# ADR-002: Representación monetaria, moneda, redondeo y división

- Estado: Aceptado
- Fecha: 2026-09-03
- Aceptado el: 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — fundamentos financieros
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Antes de persistir una cuenta o un movimiento debe existir una representación exacta y común de
dinero. JavaScript `number` y los tipos binarios de punto flotante no garantizan aritmética decimal
exacta; además, JSON no transporta `bigint`. PostgreSQL ofrece tanto enteros exactos como
`numeric`, Prisma los representa de forma distinta y las monedas no comparten necesariamente dos
decimales.

El MVP se dirige principalmente a MXN, pero fijar dos decimales en el tipo impediría incorporar de
forma segura monedas cuyo exponente es 0 o 3. La conversión entre monedas y los tipos de cambio
siguen fuera de alcance.

Esta decisión fue aceptada explícitamente el 4 de septiembre de 2026. Su aceptación fija las reglas
de Money, pero no inicia Fase 3 ni autoriza por sí sola contratos, modelos o migraciones
financieras.

## Restricciones y criterios

- Ningún importe se representa ni calcula con `number`, `float`, `double precision` o `real`.
- Cada importe lleva una moneda explícita; no se infiere por usuario, hogar o cuenta.
- La representación debe hacer round-trip exacto entre TypeScript, JSON, Zod, OpenAPI, Prisma y
  PostgreSQL.
- Las sumas y comparaciones solo operan sobre una moneda homogénea.
- Todo límite y redondeo falla de forma explícita; no se trunca silenciosamente.
- Los agregados deben detectar overflow antes de volver al tipo de dominio.
- Las divisiones deben conservar el total mediante una asignación determinista del residuo.
- ADR-007 gobierna los contratos; ADR-021 exige `household_id`, transacciones tenant-aware y
  aislamiento fail-closed cuando estos importes se persistan.

## Opciones consideradas

### A. Entero en minor units

El importe se expresa como el número entero de la unidad mínima de su moneda. MXN 126.20 se vuelve
`12620`; una moneda con exponente 0 no acepta fracción y una de exponente 3 multiplica por 1000.

Ventajas:

- suma, resta, comparación y balance son enteros exactos;
- `BIGINT` tiene soporte nativo en PostgreSQL y Prisma;
- el ledger no depende de una escala decimal configurable;
- el formato canónico para fingerprint e idempotencia es pequeño y estable.

Costos y riesgos:

- los límites de `BIGINT` deben protegerse en cada frontera;
- TypeScript `bigint` requiere serialización explícita;
- el exponente correcto depende de un catálogo de monedas versionado;
- una división todavía necesita una regla de redondeo y reparto.

### B. Decimal exacto controlado

El dominio y la persistencia usan un decimal exacto con escala suficiente, por ejemplo
`NUMERIC(30, 9)` y `Prisma.Decimal`.

Ventajas:

- representa importes decimales y cálculos intermedios sin convertir unidades;
- permite escalas mayores para tasas o conversiones futuras.

Costos y riesgos:

- una escala declarada puede redondear al guardar;
- `numeric` es más lento que enteros y requiere una librería decimal en dominio;
- permite estados que no son importes válidos para una moneda concreta;
- es más difícil obtener una representación canónica única para contratos y fingerprints.

### C. Representación híbrida según moneda

Cada importe puede ser entero o decimal según exponente y caso de uso.

Ventajas:

- se aproxima a la forma de entrada humana;
- puede acomodar activos o tasas de mayor precisión.

Costos y riesgos:

- bifurca contratos, aritmética, índices e invariantes;
- el mismo concepto puede tener dos representaciones;
- aumenta el riesgo de conversiones y redondeos implícitos.

## Decisión aceptada

### Tipo de dominio y persistencia

Adoptar la **opción A: entero en minor units** para importes financieros confirmables.

La forma interna futura será conceptualmente:

```ts
type Money = Readonly<{
  amountMinor: MoneyMinor; // bigint branded, nunca number
  currency: CurrencyCode; // código alfabético ISO 4217 validado
}>;
```

La persistencia futura usará:

- PostgreSQL `BIGINT` para `amount_minor`;
- Prisma `BigInt` para el mismo campo;
- un código alfabético de tres caracteres para `currency`, validado además contra una allowlist
  mantenida por la aplicación;
- moneda repetida en cabecera y entradas cuando una constraint de base de datos necesite impedir
  relaciones incompatibles.

El MVP habilitará escritura en **MXN**. El tipo y el catálogo admitirán exponentes ISO 4217 0, 2 o
3 para no cerrar el diseño; habilitar otra moneda será un cambio explícito de configuración,
contratos y pruebas. Un cambio en el catálogo de ISO 4217 se versionará y no reinterpretará
historia.

### Contratos JSON, Zod y OpenAPI

La forma pública aceptada será un objeto:

```json
{ "amountMinor": "12620", "currency": "MXN" }
```

`amountMinor` es un string entero decimal canónico:

- patrón `^-?(0|[1-9][0-9]*)$`;
- sin signo `+`, exponente, separadores, espacios, ceros iniciales ni `-0`;
- parseado a `bigint` únicamente después de validar formato y límites;
- serializado desde `bigint` mediante conversión explícita a string.

OpenAPI lo describirá como `type: string`, patrón y ejemplos, no como `integer` ni `number`.
Zod validará primero la forma canónica y después los refinamientos de moneda, límite y signo del
caso de uso. Las entradas de gasto/ingreso normalmente exigirán magnitud positiva; el ledger podrá
usar importes firmados.

### Límites y overflow

Aunque PostgreSQL `BIGINT` admite de -9,223,372,036,854,775,808 a
9,223,372,036,854,775,807, el límite inicial aceptado es:

```text
abs(amountMinor) <= 9_000_000_000_000_000
```

Este margen es suficiente para el dominio doméstico, deja espacio operacional por debajo del
límite de `BIGINT` y coincide con una magnitud representable exactamente por herramientas que
accidentalmente inspeccionen el dato como entero JSON. Esto **no** autoriza usar `number`.

Cada operación aritmética valida el resultado contra el límite. PostgreSQL devuelve `numeric` para
`SUM(bigint)`; el adaptador debe comprobar que el agregado sea entero y esté dentro del límite
antes de convertirlo a `bigint`. Un overflow es un error de dominio/operación, nunca saturación.

### Precisión y redondeo

- Un importe introducido por una persona puede tener como máximo el exponente de la moneda. Un
  exceso de decimales se rechaza; no se redondea silenciosamente.
- Suma, resta y balance de minor units no redondean.
- Tasas, conversiones y prorrateos calculan con decimal exacto/racional como valor intermedio y
  redondean **una sola vez** al producir minor units.
- La política aceptada es `ROUND_HALF_EVEN` (empates al entero par). No se delegará a
  `round(numeric)` de PostgreSQL, cuyo empate se aleja de cero.
- Cada regla de negocio que origine un cálculo debe identificar la base, precisión intermedia y el
  único punto de redondeo; una política genérica no inventa la semántica de impuestos o FX.

### División y residuos

Para dividir un total entero entre participantes:

1. calcular cociente entero y residuo sin punto flotante;
2. asignar inicialmente el cociente a cada parte;
3. distribuir una unidad mínima a tantas partes como indique el residuo;
4. ordenar primero los participantes por su ID canónico únicamente para construir una lista base
   reproducible;
5. calcular una rotación desde `SHA-256` sobre una tupla canónica y delimitada que incluya versión
   de regla, ID inmutable de la operación e ID de la división; los primeros 64 bits sin signo del
   digest, módulo el número de participantes, determinan la posición inicial;
6. rotar la lista base por esa posición y entregar las unidades residuales consecutivamente desde
   allí;
7. persistir o poder reconstruir la versión de regla y los identificadores usados, y vincular el
   resultado exacto a la vista previa/operación confirmada;
8. aplicar la misma regla simétrica a importes negativos.

La suma de partes debe ser exactamente el total. El ID de operación se asigna una sola vez y no
cambia durante retries de la misma intención; ADR-004/ADR-008 fijan ese vínculo.
Ningún participante tiene una primera posición permanente: para IDs de operación independientes,
cada posición de la lista tiene la misma oportunidad de iniciar el reparto. La regla elimina el
sesgo estructural de usar siempre UUID ascendente, aunque no promete que una muestra pequeña quede
perfectamente equilibrada.

### Operaciones entre monedas

- Igualdad de valor, suma, resta, comparación, balance y agregación exigen la misma `currency`.
- Una colección multi-moneda produce subtotales separados; nunca un total mezclado.
- Monedas incompatibles generan un error estable.
- Conversión exige una operación futura explícita con importe origen, importe destino, tasa,
  precisión, instante/fuente y residuo auditables; este ADR no define FX.

## Consecuencias

### Positivas

- La fuente de verdad usa aritmética entera exacta y una representación canónica.
- El exponente de la moneda se valida sin contaminar el ledger con decimales inválidos.
- Contratos y claves idempotentes no dependen del redondeo binario de JavaScript.
- La división conserva el total y puede reproducirse.

### Negativas y riesgos

- Se necesita un catálogo ISO 4217 versionado y un adaptador de entrada/salida monetaria.
- `bigint` no se serializa automáticamente en JSON.
- El límite doméstico aceptado podría revisarse mediante otro ADR para productos empresariales.
- `BIGINT` no basta para tasas, porcentajes o FX intermedios; esos valores necesitarán tipos
  decimales separados y reglas propias.
- La rotación debe conservar versión e ID de operación/división para poder auditarse. Si se permite
  regenerar IDs hasta obtener un resultado favorable, la regla puede manipularse; preview,
  confirmación e idempotencia deben reutilizar la identidad original.

## Evidencia y validación

El probe desechable ejecutado sobre PostgreSQL 18.4 demostró:

| Caso | Resultado |
|---|---|
| `0.1::numeric + 0.2::numeric` | `0.3` exacto |
| `SUM(bigint)` cerca del máximo | resultado exacto de tipo `numeric` |
| Parseo de `12620.70` con exponente 2 | `1262070` minor units |
| Entrada `1.001` con exponente 2 | rechazada |
| División de 100 entre 3 | `34 + 33 + 33 = 100` |
| Empates half-even | `2.5 → 2`, `3.5 → 4` |
| Prisma/adapter: `BIGINT` máximo | JS `bigint` exacto |
| `JSON.stringify(bigint)` | `TypeError`, como exige resolver el contrato string |

Antes de implementar deberán existir pruebas de propiedad para round-trip, límites, negativos,
exponentes 0/2/3, overflow, sumas por moneda, división y determinismo del residuo.

## Plan de adopción

1. **Completado:** aceptar este ADR y ADR-009 antes de diseñar el schema financiero.
2. Crear tipos branded y operaciones puras en `packages/domain` con pruebas de propiedad.
3. Crear schemas Zod y OpenAPI compartidos según ADR-007.
4. Introducir columnas `BIGINT` y `currency` mediante una migración nueva, junto con constraints de
   formato/moneda y `household_id` según ADR-021.
5. Probar round-trip de Prisma, agregaciones y errores públicos.
6. Habilitar inicialmente solo MXN; cualquier moneda adicional requiere catálogo y matriz de
   pruebas explícitos.

El rollback previo a datos confirmados consiste en retirar los contratos/modelos mediante una
migración posterior. Una vez existan movimientos no se reinterpretarán importes: cualquier cambio
de representación requerirá migración verificable y reconciliación.

## Decisiones aceptadas

- El MVP restringe la escritura financiera a MXN, manteniendo el tipo currency-aware.
- `ROUND_HALF_EVEN` es la política predeterminada para cálculos derivados.
- El límite inicial permanece en `9_000_000_000_000_000` minor units de valor absoluto.
- Los residuos usan la rotación determinista por operación descrita arriba, no una prioridad fija
  por UUID.

## Referencias

- [Reglas de dominio](../02-domain-rules.md)
- [ADR-007](0007-contratos-validacion-openapi-y-cliente.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [PostgreSQL 18 — Numeric Types](https://www.postgresql.org/docs/18/datatype-numeric.html)
- [PostgreSQL 18 — Aggregate Functions](https://www.postgresql.org/docs/18/functions-aggregate.html)
- [Prisma — PostgreSQL type mapping](https://www.prisma.io/docs/orm/overview/databases/postgresql)
- [Prisma — Special fields and types](https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types)
- [ECMAScript — JSON serialization](https://tc39.es/ecma262/multipage/structured-data.html#sec-json.stringify)
- [OpenAPI 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [SIX — ISO 4217 maintenance agency](https://www.six-group.com/en/products-services/financial-information/market-reference-data/data-standards.html)
