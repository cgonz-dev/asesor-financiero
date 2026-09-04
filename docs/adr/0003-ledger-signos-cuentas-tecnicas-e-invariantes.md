# ADR-003: Ledger, signos, cuentas técnicas e invariantes

- Estado: Aceptado
- Fecha: 2026-09-03
- Aceptado el: 2026-09-04
- Responsables: Responsable del proyecto
- Fase/historia: Gate arquitectónico previo a Fase 3 — fundamentos financieros
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Los saldos, transferencias, pagos de tarjeta y correcciones solo pueden ser coherentes si proceden
de una historia contable única. Guardar un saldo mutable junto a registros independientes de gasto
o ingreso permite divergencias, doble contabilización y pérdida de trazabilidad.

Las reglas de dominio ya establecen un ledger inspirado en doble entrada, balance por moneda e
inmutabilidad de movimientos confirmados. Falta fijar la convención de signos, las cuentas
técnicas, el enforcement transaccional y la relación entre cabecera, entradas y saldos derivados.

Este ADR depende de las decisiones aceptadas en [ADR-002](0002-representacion-monetaria-moneda-redondeo-y-division.md)
y [ADR-009](0009-fechas-financieras-zona-horaria-y-periodos.md). Su aceptación fija el modelo
arquitectónico, pero no inicia Fase 3 ni autoriza por sí sola modelos, migraciones u operaciones
financieras.

## Restricciones y criterios

- El ledger confirmado es la única fuente de verdad de movimientos y saldos.
- Toda transacción contiene al menos dos afectaciones no nulas y balancea exactamente a cero por
  moneda.
- Una transferencia no es gasto; retirar efectivo y pagar una tarjeta tampoco duplican gasto.
- Correcciones preservan la historia mediante nuevos hechos enlazados.
- Cabecera, entradas, idempotencia y auditoría se confirman o revierten juntas.
- La base de datos debe impedir estados desbalanceados aun si se omite una validación de aplicación.
- ADR-006 conserva autorización fina y ADR-021 impone aislamiento RLS, claves compuestas por hogar,
  `READ COMMITTED` y lock de membresía para escrituras.
- Las transacciones de base son cortas: no incluyen red, IA ni espera de usuario.

## Opciones consideradas

### A. Importe firmado por entrada

Cada `LedgerEntry` tiene un `amountMinor` firmado. Positivo aumenta la posición firmada de la
cuenta y negativo la reduce; la transacción balancea cuando la suma es cero.

Ventajas:

- una columna monetaria y una invariante simple;
- transferencias y agregados se expresan naturalmente;
- coincide con la regla ya documentada de saldo como suma de entradas.

Riesgos:

- la presentación de pasivos requiere conocer la naturaleza de cuenta;
- el signo de “gasto” no debe confundirse con el movimiento económico de una cuenta;
- exige nombres y pruebas muy explícitos.

### B. Columnas `debit` y `credit`

Cada entrada llena exactamente una de dos columnas no negativas.

Ventajas: vocabulario contable reconocible y validaciones locales visibles.

Riesgos: duplica campos y estados inválidos; débito/crédito no es intuitivo para usuarios; todavía
se necesita naturaleza de cuenta para interpretar el saldo.

### C. Lado explícito más magnitud positiva

Cada entrada tiene `side: Debit | Credit` y una magnitud positiva.

Ventajas: evita importes negativos y separa lado de magnitud.

Riesgos: agrega una conversión obligatoria para sumas, consultas y UI; expone lenguaje contable en
capas que no lo necesitan y no elimina la naturaleza de cuenta.

## Decisión aceptada

Adoptar la **opción A: importe firmado por entrada**, acompañada de una naturaleza de cuenta
explícita y funciones de dominio que oculten la convención a la UI.

### Cabecera y entradas

`FinancialTransaction` será la cabecera atómica de un hecho confirmado. Como mínimo identificará
hogar, moneda, estado confirmado, descripción, fechas de ADR-009, actor, idempotencia y enlaces de
corrección. No contendrá un saldo mutable.

`LedgerEntry` será cada afectación inmutable a una `FinancialAccount`. Como mínimo tendrá:

- `householdId` repetido y protegido por FK compuesta;
- `financialTransactionId` y `financialAccountId` dentro del mismo hogar;
- `sequence` positiva y única dentro de la transacción;
- `amountMinor` firmado y distinto de cero según ADR-002;
- `currency` compatible con cabecera y cuenta;
- metadatos contables mínimos, sin usar categoría como cuenta.

Una transacción confirmada exige:

1. al menos dos entradas;
2. al menos dos cuentas distintas;
3. todas las entradas dentro del mismo `householdId`;
4. una sola moneda en el MVP;
5. suma exacta de `amountMinor` igual a cero;
6. ningún importe fuera del límite de ADR-002.

El modelo no soportará FX implícito. Una operación multi-moneda futura necesitará una decisión
separada que registre ambos lados, tasa, precisión, fuente y residuos.

### Convención de signos y naturaleza

`amountMinor > 0` aumenta la **posición firmada** de la cuenta; `amountMinor < 0` la reduce.

- Una cuenta de activo normalmente tiene posición positiva cuando posee valor.
- Una cuenta de pasivo normalmente tiene posición negativa cuando existe deuda.
- La magnitud presentada de una deuda se deriva conociendo la naturaleza; la UI no adivina por
  signo.
- Ingreso, gasto, transferencia y pago son tipos de hecho/interpretación, no signos universales.

El dominio ofrecerá constructores nominados (`postExpense`, `postTransfer`, etc.) y proyecciones
para evitar que consumidores armen signos manualmente.

### Cuentas técnicas y categorías

Los hechos que intercambian valor con el exterior necesitan una contrapartida. Se adoptan cuentas
técnicas del sistema por hogar y moneda para fuentes/destinos económicos que no sean una cuenta
financiera del usuario. Tendrán identidad estable, propósito tipado y visibilidad ordinaria
oculta; no serán un cajón genérico editable.

Las categorías describen análisis (“comida”, “salario”), pero no poseen dinero ni sustituyen la
contrapartida. Su diseño y reclasificación histórica pertenecen a ADR-010.

La taxonomía exacta y qué cuentas técnicas serán visibles requieren revisión humana antes de la
primera migración.

### Enforcement en dominio y PostgreSQL

Se compararon tres niveles:

- **solo aplicación:** feedback temprano, pero una ruta defectuosa puede confirmar desbalance;
- **trigger diferible:** observa todas las filas al final de la transacción y puede impedir commit;
- **función controlada de posting:** reduce superficies de escritura, pero acopla más lógica a SQL y
  no sustituye constraints ante futuras rutas privilegiadas.

La decisión aceptada combina:

1. validación pura de dominio antes de abrir la transacción;
2. constraints locales (`amount_minor <> 0`, secuencia, moneda, estado) y FKs/uniques compuestas
   por `household_id`;
3. un constraint trigger `DEFERRABLE INITIALLY DEFERRED`, endurecido y probado, que al commit
   verifica cantidad, cuentas distintas, moneda y suma cero;
4. prohibición de DML directo al runtime fuera del repositorio transaccional autorizado.

Un `CHECK` ordinario no puede validar de forma segura otras filas. El trigger debe cubrir cambios
en cabecera y entradas, incluida una cabecera sin entradas, usar nombres cualificados,
`search_path` fijo y errores públicos opacos. Su owner/privilegios y cada consulta respetarán
ADR-021; las pruebas de catálogo serán obligatorias.

### Inmutabilidad y correcciones

Después de confirmar:

- no se actualizan ni eliminan cabecera o entradas económicas;
- una anulación crea una `reversal` enlazada que invierte exactamente las entradas originales;
- un reemplazo enlaza reversión y nueva transacción corregida;
- un ajuste agrega únicamente la diferencia explicable y enlaza el hecho base;
- la auditoría conserva actor, razón, referencias y tiempos, sin reescribir el original.

Los estados previos, preview, caducidad y qué metadatos pueden corregirse sin reversal quedan
definidos por ADR-004 y deberán aplicarse al implementar el flujo.

### Semántica de operaciones comunes

- **Transferencia entre cuentas:** disminuye una cuenta y aumenta otra; no crea gasto/ingreso.
- **Retiro de efectivo:** transferencia de cuenta bancaria a cuenta de efectivo.
- **Compra con tarjeta:** reconoce el gasto al comprar y aumenta la obligación en la cuenta de
  pasivo mediante su contrapartida.
- **Pago de tarjeta:** transfiere posición de un activo hacia el pasivo; no vuelve a reconocer el
  gasto.
- **Reembolso:** reversión o ajuste enlazado al hecho original; su presentación analítica no altera
  el requisito contable.

Cada escenario debe producir entradas que balanceen por moneda sin crear categorías monetarias.

### Saldos y snapshots

El saldo actual o histórico es una proyección de entradas confirmadas dentro del corte solicitado.
No existe una columna editable de saldo como autoridad. Un snapshot futuro puede acelerar lecturas
si registra checkpoint, versión y rango cubierto, y si siempre puede reconstruirse y reconciliarse
contra el ledger. Una discrepancia invalida el snapshot, no el ledger.

### Atomicidad, RLS y concurrencia

La confirmación futura seguirá este límite:

```text
withRlsContext(actor, household, { intent: 'write' })
  → READ COMMITTED
  → lock FOR SHARE de HouseholdMembership Active
  → validar/obtener idempotencia
  → insertar cabecera + entradas + enlaces + auditoría
  → verificar invariantes diferidas
  → commit único
```

Solo el `TransactionClient` cruza repositorios tenant-scoped. Todas las claves y relaciones
incluyen `household_id`. La autorización de propiedad/visibilidad sigue en aplicación conforme a
ADR-006; RLS solo refuerza hogar y membership activa.

## Consecuencias

### Positivas

- Saldo, historial y correcciones proceden de una fuente reconstruible.
- Transferencias y pagos no duplican gasto.
- La base impide confirmar una transacción parcial o desbalanceada.
- Los signos tienen una regla matemática única y la UI recibe proyecciones comprensibles.

### Negativas y riesgos

- El trigger diferible requiere SQL manual, revisión de seguridad y pruebas de catálogo.
- Las cuentas técnicas añaden conceptos que deben permanecer ocultos o explicados apropiadamente.
- Consultar saldos desde el ledger puede requerir índices y snapshots posteriores.
- Una reversión incorrecta también es historia permanente; los constructores y enlaces son
  críticos.
- La taxonomía contable inicial y visibilidad de cuentas técnicas siguen abiertas.

## Evidencia y validación

Un probe efímero en PostgreSQL 18.4, separado del schema Prisma productivo, demostró:

| Caso | Resultado |
|---|---|
| Cabecera con dos entradas cuya suma es cero | commit exitoso |
| Transacción desbalanceada | trigger diferible rechaza commit, SQLSTATE `23514` |
| Fallo intermedio | cabecera y entradas revierten juntas |
| Relación entre hogares distintos | FK compuesta rechaza, SQLSTATE `23503` |
| Transferencia, retiro y pago de tarjeta | balance cero sin segundo gasto |
| Reversión | entradas inversas y saldo neto cero |

Antes de implementar se requiere revisar el SQL candidato para cabecera sin entradas,
updates/deletes privilegiados, concurrencia y mensajes no enumerables. También se añadirán pruebas
de reconstrucción, secuencias aleatorias, reversals y revocación RLS concurrente.

## Plan de adopción

1. **Completado:** aceptar ADR-002 y ADR-009.
2. **Completado:** aceptar la convención de signos, las cuentas técnicas y el enforcement de este
   ADR. La taxonomía mínima concreta se definirá antes de la primera migración financiera.
3. **Completado:** resolver ADR-004 y el baseline de
   [ADR-019](0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md), aceptado el 2026-09-04.
4. Implementar primero reglas/constructores puros y pruebas en `packages/domain`.
5. Diseñar schema con `household_id`, FKs compuestas, índices tenant-leading y políticas de
   ADR-021; crear una migración nueva con trigger diferible y pruebas de catálogo.
6. **ADR-008 aceptado:** añadir contratos y casos de uso solo después de resolver los gates
   restantes y autorizar un execution plan de implementación.
7. Ejecutar reconstrucción y reconciliación antes de habilitar cualquier optimización de saldo.

No existe rollback destructivo una vez confirmada historia. Los cambios posteriores se harán con
reversals o migraciones aditivas y reconciliables.

## Decisiones aceptadas y trabajo derivado

- Se acepta que positivo aumenta la posición firmada y que la naturaleza determina cómo se
  presenta activo/deuda.
- Se acepta usar cuentas técnicas tipadas y ocultas en la experiencia ordinaria. Su taxonomía
  mínima concreta deberá definirse antes de la primera migración financiera.
- Se acepta el trigger diferible como segunda barrera obligatoria además del dominio.
- ADR-004 define una allowlist inicialmente vacía para correcciones de metadata posteriores al
  posting.

## Referencias

- [Reglas de dominio](../02-domain-rules.md)
- [ADR-002](0002-representacion-monetaria-moneda-redondeo-y-division.md)
- [ADR-004](0004-estados-preview-confirmacion-y-correcciones.md)
- [ADR-006](0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [ADR-009](0009-fechas-financieras-zona-horaria-y-periodos.md)
- [ADR-021](0021-postgresql-rls-para-aislamiento-multi-household.md)
- [PostgreSQL 18 — Constraints](https://www.postgresql.org/docs/18/ddl-constraints.html)
- [PostgreSQL — CREATE TRIGGER](https://www.postgresql.org/docs/current/sql-createtrigger.html)
- [PostgreSQL 18 — Trigger behavior](https://www.postgresql.org/docs/18/trigger-definition.html)
