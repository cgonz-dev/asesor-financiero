# Reglas del dominio financiero

## Propósito

Este documento define el lenguaje y las invariantes financieras de Copiloto Financiero. Es la fuente de verdad para interpretar operaciones; la implementación, los contratos y la IA deben ajustarse a él.

No es un diseño contable definitivo. Las decisiones técnicas o semánticas aún abiertas se marcan como **pendientes de ADR**.

## Principio rector

> La IA interpreta, pregunta, propone y solicita acciones. El backend valida, calcula, persiste y conserva la verdad financiera.

El saldo nunca se obtiene de memoria conversacional ni de sumar respuestas del modelo. Toda consulta financiera se calcula desde datos persistidos y movimientos confirmados del ledger, aplicando reglas de disponibilidad explícitas.

## Reglas financieras innegociables

1. El saldo mostrado proviene del ledger, no de cálculos improvisados por la IA.
2. El dinero se almacena exactamente como entero en unidad mínima o decimal controlado; nunca como `float`.
3. Una transferencia entre cuentas propias no es gasto.
4. Retirar efectivo es una transferencia de banco a efectivo, no un gasto.
5. Pagar una tarjeta reduce banco y deuda; no crea un gasto nuevo.
6. Una compra a meses se registra una vez y genera compromisos futuros sin duplicar gasto.
7. Un depósito de renta recuperable es dinero restringido o un activo, no renta.
8. Los vales son una cuenta restringida, no efectivo bancario.
9. Una prestación no líquida no aumenta automáticamente el efectivo disponible.
10. Una tanda distingue aportaciones realizadas, aportaciones pendientes, dinero recibido y dinero aún no disponible.
11. Toda operación financiera importante conserva historial de auditoría.
12. Un movimiento confirmado no se elimina silenciosamente.
13. Una corrección confirmada usa reversión, ajuste o reemplazo y conserva el original.
14. Una diferencia de efectivo desconocida puede registrarse como ajuste pendiente de conciliación.
15. El dinero faltante reduce el saldo disponible aunque su categoría siga desconocida.
16. La IA no inventa el origen de una diferencia; solo puede sugerir y mantenerla pendiente.
17. Todo cambio con impacto financiero muestra una vista previa antes de confirmarse.
18. Toda escritura financiera usa idempotencia para resistir reintentos y evitar duplicados.
19. Las operaciones relacionadas se ejecutan en una transacción de base de datos.
20. Los saldos históricos se pueden reconstruir a partir de los movimientos.

Las secciones siguientes desarrollan estas reglas, sus conceptos y ejemplos. Cambiarlas exige
actualizar pruebas, referencias operativas y cualquier ADR relacionado en la misma tarea; no se
mantiene una copia paralela dentro de `AGENTS.md`.

## Vocabulario base

| Término | Significado |
|---|---|
| Hogar (`household`) | Límite de colaboración, autorización y aislamiento de datos para uno o más integrantes |
| Integrante (`member`) | Persona con una membresía, rol y permisos dentro de un hogar |
| Cuenta (`account`) | Contenedor financiero real o virtual cuyo saldo se deriva del ledger |
| Transacción (`transaction`) | Encabezado atómico de una operación financiera con estado, contexto e identidad |
| Entrada (`ledger_entry`) | Afectación firmada e inmutable de una transacción sobre una cuenta |
| Categoría | Clasificación analítica de un movimiento; no guarda dinero ni sustituye cuentas |
| Contraparte | Cuenta o entidad que balancea el origen/destino económico de una operación |
| Compromiso | Obligación futura prevista que todavía no es un movimiento realizado |
| Recordatorio | Aviso sin efecto financiero por sí mismo |
| Borrador | Propuesta editable que aún no afecta saldos |
| Vista previa | Resultado validado que muestra efectos antes de confirmar |
| Confirmado | Movimiento contabilizado en el ledger |
| Reversión | Transacción que neutraliza entradas confirmadas y referencia al original |
| Ajuste | Movimiento explícito que reconoce una diferencia o cambio sin ocultar el pasado |
| Conciliación | Comparación entre el saldo derivado y una observación externa |
| Idempotency key | Identificador estable de una intención de escritura usado para evitar duplicados |

El [ADR-001](adr/0001-idioma-y-vocabulario-canonico.md) aceptado establece documentación y UX en español de México, con código, API y persistencia en inglés. Esta tabla conserva el vocabulario funcional en español; el glosario técnico canónico y su adopción gradual viven en el ADR.

## Invariantes

### Fuente de verdad y exactitud

1. Solo entradas confirmadas del ledger afectan saldos realizados.
2. Cada transacción confirmada produce dos o más entradas balanceadas dentro de la misma unidad y moneda.
3. La suma algebraica de las entradas de una transacción por moneda debe ser cero.
4. Un saldo histórico se reconstruye desde el ledger hasta un instante o secuencia determinada.
5. Los agregados o snapshots son optimizaciones verificables, nunca una fuente independiente que pueda contradecir el ledger.
6. El dinero se almacena como entero en unidad mínima o decimal controlado; nunca como `float`.
7. Importe, moneda y precisión se validan en el backend.
8. No se mezclan monedas dentro de una transacción sin una operación de conversión explícita y una política aprobada por ADR.

### Atomicidad, idempotencia y concurrencia

1. El encabezado, las entradas, la auditoría y los cambios de compromisos relacionados se escriben en una única transacción de base de datos.
2. Toda intención de escritura tiene una clave idempotente con alcance definido.
3. Repetir la misma petición devuelve el resultado previo y no duplica entradas.
4. Reutilizar una clave con contenido incompatible produce conflicto, no una segunda operación.
5. Las validaciones sensibles al saldo consideran concurrencia; la estrategia de bloqueo/versionado requiere ADR.

### Historial y correcciones

1. Un borrador se puede editar o descartar porque no afecta saldos.
2. Una transacción confirmada no se modifica destructivamente ni se elimina con hard delete.
3. Una corrección conserva el original y usa:
   - **reversión**, cuando debe neutralizarse la operación;
   - **reemplazo**, cuando se revierte y registra una versión correcta enlazada;
   - **ajuste**, cuando se reconoce una diferencia posterior;
   - **reclasificación auditada**, cuando solo cambia información analítica sin cambiar entradas.
4. Cada relación entre original, reversión y reemplazo es navegable.
5. La bitácora registra actor, instante, intención, canal, resultado y correlación; no registra datos sensibles innecesarios.

### Propiedad y privacidad

1. Toda entidad de negocio pertenece a un `household_id`.
2. Toda cuenta tiene propiedad y visibilidad explícitas: personal, compartida u otra política aprobada.
3. Una membresía de hogar no concede acceso automático a todas las cuentas personales.
4. La autorización y propiedad se validan en servidor en cada lectura y escritura.
5. Una transacción que afecte cuentas incompatibles con el hogar o permisos se rechaza.

## Representación del dinero

La opción de partida es almacenar importes como enteros en la unidad mínima de la moneda, por ejemplo `1,262,070` centavos para `MXN 12,620.70`. El ADR de dinero debe decidir:

- soporte inicial de monedas y monedas sin dos decimales;
- tipo en base de datos y TypeScript;
- reglas de redondeo;
- formato de API;
- conversiones y tipos de cambio;
- asignación de residuos al dividir importes;
- límites máximos y prevención de overflow.

En cualquier alternativa se mantiene la prohibición de `float`.

## Modelo conceptual de cuentas

Una cuenta representa dónde está el valor o frente a quién existe una obligación. Una categoría solo responde para qué se usó.

### Tipos mínimos

| Tipo | Ejemplos | Naturaleza / disponibilidad |
|---|---|---|
| Banco | débito, nómina, ahorro | Activo líquido, salvo restricciones explícitas |
| Efectivo | cartera de cada integrante, caja doméstica | Activo líquido sujeto a conciliación |
| Apartado o reserva | renta, emergencia, seguro anual | Activo restringido por finalidad |
| Vales | despensa | Beneficio restringido; no efectivo bancario |
| Tarjeta de crédito | tarjeta personal o compartida | Pasivo revolvente |
| Deuda | caja popular, crédito personal | Pasivo con condiciones |
| Ahorro/fondo | fondo de ahorro laboral | Activo, posiblemente restringido y no disponible aún |
| Activo recuperable | depósito de renta | Derecho recuperable, no gasto de renta |
| Beneficio no líquido | seguro médico empresarial | Valor informativo; excluido del efectivo disponible |
| Virtual/contraparte | ingreso externo, comercio, ajuste de conciliación | Cuenta técnica para balancear y explicar origen/destino |

La semántica exacta de cuentas técnicas, beneficios no líquidos, tandas y fondos de ahorro queda pendiente de ADR. Las cuentas del sistema deben ser distinguibles de las cuentas visibles al usuario.

## Ledger inspirado en partida doble

### Encabezado `transaction`

Conceptualmente incluye:

- identificador y `household_id`;
- tipo de operación;
- estado;
- fecha efectiva y fecha de registro;
- moneda;
- descripción y evidencia opcional;
- actor y canal de origen;
- clave idempotente y correlación;
- relación con operación original, si corrige o revierte;
- metadatos de propiedad, alcance personal/compartido y categoría;
- versión o datos de concurrencia;
- marcas de auditoría.

### Entrada `ledger_entry`

Conceptualmente incluye:

- identificador, `transaction_id`, `household_id` y `account_id`;
- importe firmado exacto;
- moneda;
- secuencia estable;
- contexto de propietario o participante cuando aplique.

No debe existir una entrada huérfana ni una entrada con hogar diferente al de la transacción o cuenta.

### Convención usada en los ejemplos

Los ejemplos usan `+` para aumentar el saldo económico de una cuenta y `−` para reducirlo. En un pasivo, una deuda puede mostrarse como saldo negativo para patrimonio. La convención final de débitos/créditos, signos y presentación requiere ADR; la invariante que no cambia es que las entradas se balancean.

### Ejemplos balanceados

#### Ingreso de nómina

“Hoy me depositaron MXN 12,620.70.”

| Cuenta | Afectación |
|---|---:|
| Banco nómina | + MXN 12,620.70 |
| Contraparte: ingreso laboral | − MXN 12,620.70 |

Se adjunta categoría/fuente “nómina”, integrante y periodo. En un modelo mixto se registran componentes identificables sin inventar la composición.

#### Gasto desde banco

“Gasté MXN 650 de gasolina.”

| Cuenta | Afectación |
|---|---:|
| Banco origen | − MXN 650.00 |
| Contraparte: comercio/consumo externo | + MXN 650.00 |

“Gasolina” es categoría, no cuenta de dinero. Faltando la cuenta origen, el borrador no se confirma sin una regla explícita o pregunta.

#### Transferencia a efectivo

“Retiré MXN 1,000.”

| Cuenta | Afectación |
|---|---:|
| Banco | − MXN 1,000.00 |
| Efectivo | + MXN 1,000.00 |

No se crea gasto. Los gastos aparecen cuando el efectivo sale hacia una contraparte.

#### Apartado o reserva

“Aparta MXN 2,500 para el seguro anual.”

| Cuenta | Afectación |
|---|---:|
| Banco disponible | − MXN 2,500.00 |
| Apartado: seguro | + MXN 2,500.00 |

El patrimonio no cambia; cambia la disponibilidad. Liberar el apartado invierte la transferencia.

#### Depósito recuperable de renta

“Pagué MXN 8,000 de depósito.”

| Cuenta | Afectación |
|---|---:|
| Banco | − MXN 8,000.00 |
| Activo recuperable: depósito de vivienda | + MXN 8,000.00 |

No se categoriza como renta mientras exista derecho a recuperación. Si se pierde parte del depósito, una operación posterior reclasifica ese importe con evidencia y auditoría.

#### Compra con tarjeta

“Pagué MXN 900 de despensa con la tarjeta.”

| Cuenta | Afectación |
|---|---:|
| Tarjeta de crédito | − MXN 900.00 |
| Contraparte: comercio/consumo externo | + MXN 900.00 |

El gasto ocurre al comprar. El pasivo aumenta y la categoría es “despensa”.

#### Pago de tarjeta

“Ya pagué MXN 900 de la tarjeta.”

| Cuenta | Afectación |
|---|---:|
| Banco | − MXN 900.00 |
| Tarjeta de crédito | + MXN 900.00 |

El pago reduce banco y deuda; no genera un gasto nuevo.

#### Compra a meses sin intereses

“Compramos una televisión de MXN 12,000 a 12 meses sin intereses.”

Movimiento realizado una sola vez:

| Cuenta | Afectación |
|---|---:|
| Tarjeta de crédito | − MXN 12,000.00 |
| Contraparte: comercio | + MXN 12,000.00 |

Se crea además un plan con 12 compromisos de MXN 1,000.00 y fechas definidas. Los compromisos no son entradas realizadas. Cada pago posterior transfiere dinero del banco a la tarjeta y satisface/asocia compromisos sin volver a reconocer la compra.

#### Reembolso

Un reembolso debe enlazarse con la compra cuando sea posible:

| Cuenta | Afectación |
|---|---:|
| Banco o tarjeta | + MXN 650.00 |
| Contraparte: comercio | − MXN 650.00 |

La categoría y el presupuesto reciben un tratamiento explícito; si el reembolso cruza periodos, su política queda pendiente de ADR.

#### Diferencia de efectivo no identificada

Saldo esperado: MXN 1,000.00. Conteo real: MXN 570.00.

| Cuenta | Afectación |
|---|---:|
| Efectivo | − MXN 430.00 |
| Contraparte: diferencia pendiente de conciliación | + MXN 430.00 |

El disponible baja inmediatamente. La causa y categoría quedan pendientes. La IA puede sugerir búsquedas, pero no afirmar un origen. Al resolver, se registra una reclasificación o ajuste enlazado y auditado.

## Semántica obligatoria de casos especiales

### Transferencias

- Entre cuentas propias o compartidas compatibles no son ingreso ni gasto.
- Comisiones asociadas son operaciones de gasto separables y explícitas.
- La cuenta origen y destino deben conocerse antes de confirmar.

### Tarjetas y deudas

- La compra reconoce el consumo y aumenta el pasivo.
- El pago amortiza pasivo y reduce una cuenta de activo.
- Intereses, comisiones y seguros del crédito sí pueden ser gastos, registrados de forma explícita.
- Un pago parcial no marca liquidada una obligación completa.
- El estado de cuenta es evidencia de conciliación, no reemplaza el ledger.

### Compras a meses

- La compra se registra exactamente una vez por su importe total.
- El calendario separa capital, intereses y cargos cuando existan.
- Los compromisos futuros alimentan proyecciones, no saldos realizados.
- Cancelaciones, devoluciones, pagos anticipados y redondeos requieren reglas auditables.

### Vales y beneficios

- Los vales se registran en una cuenta restringida.
- Depositar vales no aumenta el efectivo bancario.
- Una compra con vales disminuye esa cuenta y puede clasificarse como gasto.
- Beneficios no líquidos no se suman al saldo disponible ni al efectivo.

### Fondos de ahorro

- Se distinguen aportación del empleado, aportación patronal, rendimientos, restricciones y fecha de disponibilidad.
- Retener parte de nómina puede ser transferencia a un activo restringido, no gasto.
- La aportación patronal puede ser ingreso restringido, sujeta a condiciones.
- La adquisición del derecho y su valuación requieren ADR.

### Tandas

El modelo debe distinguir:

- calendario y participantes;
- aportaciones realizadas y pendientes;
- turno;
- importe recibido y por recibir;
- dinero recibido pero restringido o todavía no disponible;
- incumplimientos, adelantos y ajustes.

Una aportación no debe clasificarse automáticamente como gasto si crea o satisface un derecho/obligación. Recibir la tanda no debe contarse automáticamente como ingreso ordinario. La representación contable exacta requiere ADR antes de implementarse.

### Ingresos variables y bonos

- Se identifican por fuente, integrante, fecha y sostenibilidad.
- Un bono temporal puede formar parte del saldo actual sin elevar el ingreso sostenible usado para presupuestos recurrentes.
- El sistema no proyecta que un ingreso variable se repetirá sin una regla explícita.

### Renta, servicios, seguro y recurrentes

- Una obligación prevista no afecta el saldo actual hasta que se realice el movimiento.
- Sí puede reducir el saldo disponible planificado mediante la definición de compromiso.
- Un recordatorio solo avisa; no crea ni confirma una transacción.
- Pagar una obligación debe enlazar movimiento y compromiso sin duplicarlos.

## Tipos mínimos de operación

| Operación | Efecto esencial |
|---|---|
| Ingreso | Aumenta un activo y reconoce origen |
| Gasto | Reduce activo o aumenta pasivo frente a consumo |
| Transferencia | Mueve valor entre cuentas sin crear gasto |
| Compra con tarjeta | Reconoce compra y aumenta pasivo |
| Pago de tarjeta | Reduce activo y pasivo |
| Creación de deuda | Reconoce fondos/activo y pasivo según el caso |
| Pago de deuda | Reduce activo y pasivo; separa cargos |
| Compra a meses | Registra una compra y crea compromisos futuros |
| Reembolso | Revierte total o parcialmente el efecto económico enlazado |
| Ajuste | Reconoce una diferencia explícita |
| Conciliación | Compara saldo derivado con observación y resuelve diferencias |
| Aportación a tanda | Registra aportación y estado del plan |
| Recepción de tanda | Registra recepción sin asumir ingreso ordinario |
| Apartado o reserva | Mueve valor disponible a restringido |
| Liberación de apartado | Devuelve valor restringido a disponible |
| Corrección o reversión | Conserva historial y modifica efecto mediante nueva evidencia |

Cada tipo necesita contrato, validaciones, permisos, entradas esperadas, eventos de auditoría, idempotencia y pruebas de balance antes de implementarse.

## Estados de una operación

Modelo conceptual inicial:

1. `draft`: incompleta o aún editable; no afecta saldos.
2. `ready_for_preview`: tiene datos mínimos y validaciones preliminares.
3. `previewed`: muestra efecto calculado y versión de la intención.
4. `confirmed`: persistida atómicamente; afecta ledger.
5. `failed`: intento sin efecto confirmado, con error seguro y reintentable cuando aplique.
6. `reversed`: el original sigue inmutable y existe una reversión confirmada asociada.
7. `replaced`: existe reemplazo confirmado enlazado.

La expiración de vistas previas, transiciones y relación entre estado del original y transacciones correctivas requieren ADR. No debe existir un estado que permita editar entradas ya confirmadas.

## Conciliación

1. Se captura un snapshot: cuenta, importe observado, moneda, instante y fuente.
2. El backend calcula el saldo del ledger al mismo instante.
3. Si coinciden, se registra evidencia de conciliación sin mover dinero.
4. Si difieren, se muestra la diferencia y se solicita revisión.
5. Si el usuario confirma que el dinero falta o sobra, se crea un ajuste pendiente de conciliación.
6. La diferencia afecta el saldo disponible desde su confirmación.
7. Resolver la causa no borra el ajuste; lo enlaza con reclasificación, reversión o movimiento de reemplazo.

Los snapshots no sustituyen el ledger ni reescriben su historia.

## Presupuestos y disponibilidad

### Estrategias requeridas

- regla 50/30/20;
- porcentajes configurables;
- categorías;
- integrante y hogar;
- periodos quincenales y mensuales;
- dinero personal libre;
- reparto proporcional a ingresos;
- reparto 50/50;
- reparto manual;
- exclusión de bonos del ingreso sostenible;
- metas de ahorro;
- fondo de emergencia.

Una distribución propuesta no mueve dinero hasta convertirse en operaciones confirmadas.

### Conceptos que no deben confundirse

| Concepto | Definición conceptual |
|---|---|
| Saldo actual | Saldo realizado del ledger a un instante |
| Saldo restringido | Parte del activo que existe pero no está libre para cualquier uso |
| Saldo comprometido | Importe asociado a obligaciones futuras consideradas en la planificación |
| Saldo disponible | Parte utilizable bajo reglas explícitas después de restricciones y compromisos aplicables |
| Saldo proyectado | Escenario futuro que combina actual, compromisos e hipótesis identificadas |
| Patrimonio neto | Activos menos pasivos bajo reglas de inclusión y valuación |

Las fórmulas exactas, horizontes, tratamiento de sobregiros, tarjetas, fondos, beneficios y dobles reservas requieren ADR. La interfaz debe poder explicar qué componentes produjeron cada cifra.

### Regla 50/30/20

Debe ser una plantilla configurable, no una verdad universal:

- 50 % necesidades;
- 30 % deseos;
- 20 % ahorro o pago de deuda.

El denominador —ingreso neto recibido, ingreso sostenible u otro— se configura y explica. Los residuos por redondeo se asignan determinísticamente. Bonos temporales pueden excluirse de la base sostenible y distribuirse mediante una regla distinta.

## Decisiones pendientes de ADR del dominio

- representación monetaria, monedas, redondeo y división;
- convención de signos/débitos/créditos y cuentas técnicas;
- estados, vistas previas, expiración y correcciones;
- semántica de fechas efectivas, zonas horarias y periodos;
- modelado de tandas;
- adquisición y disponibilidad de fondos de ahorro/prestaciones;
- fórmulas de disponible, comprometido, proyectado y patrimonio;
- políticas de presupuestos, reembolsos y traspasos entre periodos;
- taxonomía y gobierno de categorías;
- concurrencia e idempotencia;
- tratamiento futuro de divisas y tipos de cambio.
