# ADR-001: Idioma y vocabulario canónico del dominio, código y API

- Estado: Aceptado
- Fecha: 2026-07-30
- Responsables: Responsable del proyecto
- Fase/historia: Fase 0 — decisión bloqueante antes de Fase 1
- Sustituye a: No aplica
- Sustituido por: No aplica

## Contexto

Copiloto Financiero se diseña inicialmente para personas de habla española en México. La documentación, los ejemplos financieros y la experiencia conversacional deben ser naturales para ese mercado. Al mismo tiempo, TypeScript, React Native, Expo, NestJS, Prisma, PostgreSQL, OpenAPI y OpenAI usan ecosistemas cuyas convenciones y documentación técnica están principalmente en inglés.

Antes de crear el monorepo se necesita una convención estable para evitar:

- identificadores que mezclen español e inglés sin una regla;
- clases, tablas, DTO, endpoints y tools que nombren de forma distinta el mismo concepto;
- traducciones literales que oculten la semántica financiera;
- colisiones como transacción financiera frente a transacción de base de datos;
- confusión entre una cuenta financiera y una cuenta de identidad;
- códigos públicos dependientes del texto mostrado al usuario;
- nombres físicos de PostgreSQL inconsistentes con TypeScript;
- búsquedas, logs, trazas y OpenAPI difíciles de correlacionar;
- una futura localización que obligue a cambiar contratos o datos.

Los documentos actuales están en español y muestran algunos términos técnicos en inglés o `snake_case` de forma conceptual. Este ADR establece la convención canónica futura. Su aceptación no autoriza renombrados masivos ni inicia implementación; la adopción ocurre de forma acotada en las tareas posteriores que correspondan.

## Restricciones y criterios

- La documentación debe seguir siendo comprensible para responsables de producto, dominio y seguridad en México.
- La primera interfaz debe usar español de México (`es-MX`).
- Los identificadores técnicos deben integrarse de forma natural con el ecosistema TypeScript y evitar caracteres problemáticos.
- Los contratos, estados, eventos, errores y herramientas necesitan valores estables que no cambien al traducir la UI.
- El ledger, la exactitud monetaria, la auditoría y el aislamiento por hogar no pueden depender de traducciones.
- PostgreSQL debe tener una convención física única y Prisma debe hacer explícita la correspondencia.
- Los nombres deben ayudar a generar OpenAPI y clientes sin transformaciones ambiguas.
- Logs, métricas y trazas deben poder buscarse con el mismo vocabulario técnico.
- Los conceptos culturales pueden conservarse si una traducción pierde precisión, pero deben definirse.
- La aceptación no cambia por sí sola contratos ni datos existentes; todavía no existen código, API o esquema que migrar.

### Criterios de evaluación

Las alternativas se comparan por claridad, mantenimiento, compatibilidad con el ecosistema, onboarding, consistencia, localización futura, OpenAPI, herramientas de IA, base de datos, búsqueda/observabilidad, riesgo de mezcla y capacidad de incorporar desarrolladores internacionales.

## Opciones consideradas

### Alternativa A: todo en español

Documentación, UX, código, API y base de datos usarían español.

Ventajas:

- correspondencia directa con el lenguaje del mercado inicial;
- menor traducción mental para especialistas de dominio hispanohablantes;
- términos culturales como “tanda” se conservan naturalmente.

Desventajas:

- fricción con librerías, documentación y ejemplos del ecosistema;
- traducciones técnicas poco naturales o variables;
- identificadores sin acentos no siempre coinciden con el español correcto;
- menor accesibilidad para colaboradores internacionales;
- mayor riesgo de mezclar inglés cuando una librería imponga sus propios términos.

### Alternativa B: todo en inglés

Documentación, UX, código, API y persistencia usarían inglés.

Ventajas:

- máxima afinidad con herramientas, librerías y comunidad técnica;
- onboarding más sencillo para desarrollo internacional;
- búsquedas técnicas y ejemplos homogéneos.

Desventajas:

- documentación y UX menos naturales para el mercado piloto;
- riesgo de perder matices de conceptos mexicanos;
- mayor barrera para responsables de producto y dominio;
- la interfaz inicial incumpliría el supuesto aprobado de español.

### Alternativa C: documentación y UX en español; código, API y persistencia en inglés

La documentación de producto, dominio y decisiones, así como la UI inicial, usarían español. Los identificadores técnicos, contratos, API y persistencia usarían inglés estable. Un glosario mantendría la correspondencia.

Ventajas:

- lenguaje natural para usuarios y responsables del mercado inicial;
- compatibilidad con el ecosistema técnico;
- contratos independientes de la localización;
- separación clara entre conceptos mostrados e identificadores persistentes;
- incorporación más sencilla de otros idiomas y colaboradores internacionales.

Desventajas:

- exige mantener un glosario y revisar traducciones;
- puede haber términos cuya equivalencia no sea exacta;
- requiere disciplina para no mezclar capas;
- las búsquedas desde una expresión de UI hasta código necesitan la correspondencia documentada.

### Alternativa D: modelo mixto libre por módulo

Cada módulo elegiría español o inglés según sus responsables.

Ventajas:

- mínima coordinación inicial;
- permite usar el término que parezca más cómodo localmente.

Desventajas:

- contratos, tablas y tools inconsistentes;
- alto costo de mantenimiento y búsqueda;
- OpenAPI y observabilidad fragmentados;
- onboarding dependiente del módulo;
- renombrados y errores de integración inevitables;
- difícil localización y escasa capacidad de aplicar reglas automáticas.

### Comparación

| Criterio | A: todo español | B: todo inglés | C: español funcional / inglés técnico | D: mezcla libre |
|---|---|---|---|---|
| Claridad para mercado inicial | Alta | Baja/media | Alta | Variable |
| Mantenimiento técnico | Medio | Alto | Alto con glosario | Bajo |
| Ecosistema TypeScript/Prisma/OpenAPI | Medio/bajo | Alto | Alto | Variable |
| Onboarding de dominio | Alto para hispanohablantes | Medio/bajo | Alto | Bajo |
| Consistencia | Media; librerías fuerzan excepciones | Alta | Alta por límite de capa | Baja |
| Localización futura | Media; códigos ligados al idioma | Media; UX ya acoplada | Alta | Baja |
| OpenAPI y clientes | Posible, con términos menos estándar | Natural | Natural y estable | Inconsistente |
| Herramientas de IA | Claras al usuario, menos estándar técnicamente | Estándar, menos cercanas al dominio local | Estables con presentación localizada | Difíciles de gobernar |
| PostgreSQL/Prisma | Posible, con transliteraciones | Natural | Natural con mapeo explícito | Inconsistente |
| Búsqueda y observabilidad | Media | Alta | Alta en lo técnico; glosario para UX | Baja |
| Riesgo de mezcla conceptual | Medio | Bajo para código, alto para términos culturales | Bajo si se aplica el glosario | Muy alto |
| Desarrollo internacional | Bajo/medio | Alto | Alto | Bajo |

## Decisión

Se acepta la **Alternativa C**.

### Idioma por capa

1. La documentación de producto, dominio, arquitectura, seguridad, calidad y ADR se escribe en español.
2. La interfaz inicial y los mensajes al usuario se presentan en español de México.
3. Código TypeScript, módulos, archivos, clases, tipos, variables, funciones, entidades, DTO, esquemas, campos JSON, endpoints, eventos, errores técnicos, herramientas de IA y persistencia usan inglés.
4. Los identificadores expresan la intención del dominio; no se traducen palabra por palabra si el resultado es ambiguo o poco natural.
5. Un identificador no mezcla idiomas, salvo un término cultural aprobado en el glosario y tratado como préstamo canónico.
6. Identificadores técnicos no usan acentos, `ñ`, espacios ni otros caracteres especiales.
7. Texto presentado o ingresado por una persona sí conserva Unicode, acentos y ortografía natural.

### Convenciones de nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Clases, tipos, interfaces, entidades, componentes, DTO y nombres de enum | `PascalCase` | `FinancialTransaction`, `HouseholdMember`, `TransactionPreviewResponse` |
| Módulos y servicios de framework | nombre de dominio en inglés más sufijo explícito | `HouseholdsModule`, `ReconciliationService` |
| Funciones, métodos, variables, propiedades y campos JSON | `camelCase` | `createTransactionDraft`, `householdId`, `availableBalance` |
| Archivos y directorios de código | `kebab-case` en inglés | `financial-transaction.service.ts`, `household-members/` |
| Rutas REST | segmentos plurales en `kebab-case` e inglés | `/financial-transactions`, `/household-members` |
| Contratos de entrada y salida | `PascalCase` con rol explícito | `CreateTransactionDraftRequest`, `TransactionPreviewResponse` |
| Herramientas de IA | `camelCase`, verbo más objeto de dominio | `createTransactionDraft`, `getAvailableBalance` |
| Tipo de evento en código | `PascalCase` con sufijo `Event` | `FinancialTransactionConfirmedEvent` |
| Nombre serializado de evento | segmentos ingleses estables y versionados | `financial-transaction.confirmed.v1` |
| Errores técnicos en código | `PascalCase` con sufijo `Error` | `FinancialTransactionNotFoundError` |
| Constantes y variables de entorno | `SCREAMING_SNAKE_CASE` | `DEFAULT_CURRENCY`, `DATABASE_URL` |
| Tipo de estado/enum | `PascalCase` | `FinancialTransactionStatus` |
| Miembros de enum en TypeScript | `PascalCase` | `ReadyForPreview`, `Confirmed` |
| Valores serializados de estado | `camelCase` estable | `readyForPreview`, `confirmed` |
| Códigos públicos de error | `SCREAMING_SNAKE_CASE` estable | `FINANCIAL_TRANSACTION_NOT_FOUND` |
| Tablas, columnas, índices y constraints de PostgreSQL | `snake_case` en inglés | `financial_transaction`, `household_id`, `idx_ledger_entry_account_id` |

`snake_case` queda reservado para nombres físicos de PostgreSQL. `SCREAMING_SNAKE_CASE` es una convención distinta y se limita a constantes, variables de entorno y códigos públicos. Los nombres serializados que tengan una sintaxis de protocolo —por ejemplo un evento con puntos— se documentan como tales y no se copian como identificadores TypeScript.

### PostgreSQL y Prisma

- Las tablas físicas usan nombres singulares en `snake_case`.
- Las columnas físicas usan `snake_case`.
- Modelos y enums Prisma usan `PascalCase`.
- Campos Prisma usan `camelCase`.
- Cada diferencia entre el nombre Prisma y el nombre físico se expresa mediante mapeo explícito.
- Se evitan palabras reservadas y nombres ambiguos. Se prefieren nombres expandidos como `financial_transaction` y `financial_account`.
- Índices, claves y constraints usan prefijos consistentes y nombres en inglés; el detalle se cerrará con el esquema correspondiente sin cambiar esta convención.
- Los valores de enums físicos usan inglés en `snake_case`; Prisma los mapea al miembro TypeScript correspondiente cuando sea necesario.

Ejemplos de correspondencia, no de esquema:

| TypeScript/Prisma | PostgreSQL |
|---|---|
| `FinancialTransaction` | `financial_transaction` |
| `FinancialAccount` | `financial_account` |
| `LedgerEntry` | `ledger_entry` |
| `HouseholdMember` | `household_member` |
| `householdId` | `household_id` |
| `effectiveAt` | `effective_at` |

Este ADR decide la convención física, no las tablas, relaciones ni constraints definitivos.

### Contratos, estados y errores públicos

- Los contratos usan nombres de campos y códigos estables en inglés.
- La UI traduce la presentación y nunca depende de comparar un mensaje localizado.
- Estados y enums no cambian con el idioma ni se traducen dinámicamente.
- Los DTO compartidos nombran su función con sufijos como `Request`, `Response`, `Command` o `Result`. Se evita agregar `Dto` si el rol ya es inequívoco; un adaptador puede usarlo solo cuando represente un objeto de transporte distinto.
- Un error público contiene:
  - `code`: código estable en inglés;
  - `message`: texto localizado o localizable;
  - `metadata`: información segura y estructurada únicamente cuando ayude a resolver el error.
- El cliente toma decisiones por `code`, nunca por `message`.
- Los metadatos no revelan recursos, hogares, importes ni datos sensibles sin autorización.

Ejemplo conceptual:

| Campo | Valor |
|---|---|
| `code` | `FINANCIAL_TRANSACTION_NOT_FOUND` |
| `message` en `es-MX` | `No encontramos el movimiento solicitado.` |
| `metadata` | Solo datos seguros y accionables |

### Mensajes y localización

- Los mensajes de UI no se incrustan en entidades, reglas de dominio, enums ni contratos como fuente de verdad.
- La presentación usa claves o recursos de localización y comienza con `es-MX`.
- La documentación puede citar el texto esperado en español sin convertirlo en identificador técnico.
- Fechas, moneda, plurales y números se formatean según locale en la capa de presentación.
- Texto creado por usuarios —por ejemplo una categoría— se conserva tal como fue ingresado, sujeto a validaciones de seguridad y longitud.

### Categorías

Las categorías del sistema separan identidad estable de presentación:

- `identifier`: valor estable, único y en inglés, por ejemplo `groceries`;
- `displayName`: texto localizado, por ejemplo `Despensa`;
- traducciones adicionales pueden agregarse sin cambiar `identifier`.

Las categorías creadas por usuarios conservan el texto ingresado y no se traducen ni normalizan semánticamente sin consentimiento. `Category` es una clasificación analítica; nunca significa `FinancialAccount` ni `Counterparty`.

### Transaction

- `FinancialTransaction` es el nombre canónico del encabezado financiero del ledger.
- `DatabaseTransaction` describe la unidad atómica de persistencia en abstracciones propias.
- Cuando se use Prisma, se conserva el nombre del tipo del proveedor, por ejemplo `Prisma.TransactionClient`, sin crear un alias ambiguo.
- `Transaction` sin calificador no se usa como entidad pública, modelo compartido, tabla o contrato.
- La ruta canónica es `/financial-transactions` y el nombre físico canónico es `financial_transaction`.

Esto permite distinguir “confirmar una transacción financiera” de “ejecutar varias escrituras en una transacción de base de datos”.

### Account

- `FinancialAccount` es el agregado o concepto genérico del ledger.
- `User` representa identidad.
- `UserAccount` solo se usaría si se introduce deliberadamente un concepto de cuenta de autenticación distinto de `User`; no es sinónimo de cuenta financiera.
- Los subtipos o clasificaciones financieras usan nombres explícitos como `BankAccount`, `CashAccount` y `CreditCardAccount`.
- `Account` sin calificador se evita en contratos públicos y límites donde pueda confundirse con identidad o proveedor.

### Apartados, vales y fondo de ahorro laboral

- `EarmarkedAccount` es el término canónico para dinero separado con una finalidad, por ejemplo renta, fondo de emergencia o seguro del automóvil.
- `SavingsBucket` puede usarse como texto o metáfora de UI si las pruebas de comprensión lo favorecen, pero no es el nombre canónico del dominio.
- `VoucherAccount` es el término canónico para una cuenta de vales. Los vales de despensa serán un `VoucherAccount` cuya restricción o tipo podrá ser `Grocery`.
- Este ADR no crea una entidad distinta por cada tipo de vale ni decide si `Grocery` será enum, propiedad, política o clasificación; esa estructura pertenece al ADR del ledger o del módulo correspondiente.
- `EmployeeSavingsFund` nombra el concepto o prestación laboral: aportaciones del empleado, posibles aportaciones patronales, condiciones y disponibilidad.
- `EmployeeSavingsFundAccount` es únicamente el nombre posible de su representación como `FinancialAccount` si un ADR posterior del ledger decide que debe modelarse como cuenta.
- Este ADR no obliga a crear una entidad, cuenta o tabla para el fondo de ahorro laboral.

### Balance

- `LedgerBalance`: suma realizada derivada del ledger a un instante de corte; es la base autoritativa.
- `CurrentBalance`: etiqueta de presentación para el `LedgerBalance` al instante actual; no es una fuente persistida independiente.
- `AvailableBalance`: importe utilizable después de aplicar reglas explícitas.
- `RestrictedBalance`: parte existente pero restringida por finalidad o instrumento.
- `CommittedBalance`: importe considerado para obligaciones futuras; no es movimiento realizado.
- `ProjectedBalance`: escenario futuro con hipótesis explícitas.
- `ObservedBalance`: importe externo observado durante conciliación.

Se evita `balance` sin calificador en contratos donde más de una definición sea posible. Las fórmulas exactas pertenecen a ADR-016.

### Obligation

- `Obligation`: compromiso futuro que todavía no es un movimiento confirmado.
- `RecurringObligation`: definición o plantilla recurrente.
- `ObligationOccurrence`: ocurrencia fechada generada por una recurrencia.
- `Reminder`: aviso; no crea ni confirma dinero.
- `FinancialTransaction`: movimiento confirmado que sí afecta el ledger.
- `Debt` o `DebtAccount`: pasivo, no sinónimo de obligación programada.

Pagar una obligación enlaza su ocurrencia con una `FinancialTransaction`; no convierte el recordatorio en movimiento ni duplica el gasto.

### Tanda

Se conserva **`Tanda`** como término canónico:

> Esquema rotativo de aportaciones periódicas entre participantes, donde cada participante tiene un turno para recibir el monto reunido.

`SavingsCircle` es comprensible pero puede omitir la rotación y el turno. `RotatingSavingsGroup` describe participantes, pero no necesariamente el plan y resulta largo. `RotatingSavingsPlan` es más descriptivo, aunque aleja el código del vocabulario del mercado inicial y puede confundirse con un producto formal de ahorro.

`Tanda`:

- es breve, estable, ASCII y central para el mercado inicial;
- evita asumir que cada aportación es gasto o que cada recepción es ingreso;
- debe estar definida en el glosario para colaboradores internacionales;
- funciona como préstamo canónico aprobado, por lo que nombres como `TandaParticipant`, `TandaContribution` y `TandaTurn` no se consideran mezcla libre de idiomas.

La semántica contable de la tanda no se decide aquí; pertenece al ADR de recurrencias y tandas.

## Glosario canónico

| Español / concepto de producto | Nombre técnico canónico | Nota |
|---|---|---|
| hogar | `Household` | Límite de colaboración y aislamiento |
| integrante | `HouseholdMember` | Membresía de una persona en un hogar |
| usuario | `User` | Identidad; no cuenta financiera |
| cuenta | `FinancialAccount` | Se evita `Account` cuando haya ambigüedad |
| cuenta bancaria | `BankAccount` | Clasificación de cuenta financiera |
| efectivo | `CashAccount` | Cuenta de efectivo conciliable |
| apartado | `EarmarkedAccount` | Dinero separado para una finalidad; `SavingsBucket` puede ser texto de UI |
| vales | `VoucherAccount` | Los vales de despensa podrán usar restricción o tipo `Grocery` |
| fondo de ahorro laboral | `EmployeeSavingsFund` | Concepto o prestación laboral; no presupone una cuenta o tabla |
| posible cuenta del fondo de ahorro laboral | `EmployeeSavingsFundAccount` | Solo si un ADR posterior decide representarlo como `FinancialAccount` |
| tarjeta de crédito | `CreditCardAccount` | Cuenta de pasivo |
| deuda | `Debt` / `DebtAccount` | Condiciones/agregado frente a cuenta del ledger; ADR-013 decidirá el modelo |
| transacción | `FinancialTransaction` | Encabezado financiero del ledger |
| transacción de base de datos | `DatabaseTransaction` | Unidad técnica de atomicidad |
| entrada de ledger | `LedgerEntry` | Afectación inmutable a una cuenta |
| categoría | `Category` | Clasificación analítica, no cuenta |
| contraparte | `Counterparty` | Origen/destino económico, no categoría |
| compromiso | `Obligation` | Obligación futura sin efecto realizado |
| pago recurrente | `RecurringObligation` | Se modela como obligación, no pago ya realizado |
| ocurrencia de obligación | `ObligationOccurrence` | Instancia fechada de una obligación |
| recordatorio | `Reminder` | Aviso sin efecto financiero |
| compra a meses | `InstallmentPurchase` | Compra reconocida una sola vez |
| plan de mensualidades | `InstallmentPlan` | Calendario y reglas del plan |
| cuota | `Installment` | Parte fechada del plan |
| tanda | `Tanda` | Término cultural canónico aceptado |
| participante de tanda | `TandaParticipant` | Integrante del esquema rotativo |
| aportación a tanda | `TandaContribution` | Aportación realizada o pendiente según estado |
| turno de tanda | `TandaTurn` | Orden y derecho de recepción |
| conciliación | `Reconciliation` | Comparación del ledger con una observación |
| snapshot de saldo | `BalanceSnapshot` | Evidencia observada; no fuente de verdad |
| diferencia de saldo | `ReconciliationDifference` | Preferido sobre `BalanceDifference` por su contexto |
| ajuste | `Adjustment` | Movimiento explícito por diferencia o cambio |
| reversión | `Reversal` | Neutraliza una operación conservando el original |
| reemplazo | `Replacement` | Reversión más versión correcta enlazada |
| borrador | `FinancialTransactionDraft` | Propuesta que no afecta saldos |
| vista previa | `FinancialTransactionPreview` | Efecto validado previo a confirmación |
| confirmación | `FinancialTransactionConfirmation` | Confirmación vinculada a una preview vigente |
| saldo del ledger | `LedgerBalance` | Saldo realizado y reconstruible |
| saldo actual | `LedgerBalance` al corte actual | `CurrentBalance` solo como etiqueta de presentación |
| dinero disponible | `AvailableBalance` | Resultado calculado bajo reglas explícitas |
| dinero restringido | `RestrictedBalance` | Activo no libre para cualquier uso |
| dinero comprometido | `CommittedBalance` | Obligaciones consideradas, aún no realizadas |
| saldo proyectado | `ProjectedBalance` | Escenario, no garantía |
| patrimonio neto | `NetWorth` | Activos menos pasivos según política |
| hogar compartido | `Household` | No se crea `SharedHousehold`; compartir es capacidad del hogar |
| gasto compartido | `ExpenseScope.Shared` | Alcance de gasto; no requiere una entidad separada |
| gasto personal | `ExpenseScope.Personal` | Alcance de gasto |
| ingreso sostenible | `SustainableIncome` | Base repetible para planificación |
| bono temporal | `TemporaryBonus` | Ingreso no necesariamente sostenible |
| clave idempotente | `IdempotencyKey` | Identidad estable de una intención |
| evento de auditoría | `AuditEvent` | Registro estructurado de una acción auditable |

El glosario decide vocabulario, no obliga a modelar cada fila como clase, tabla o agregado. Los ADR posteriores decidirán estructura y semántica sin introducir sinónimos innecesarios.

## Consecuencias

### Positivas

- La documentación y UX permanecen naturales para el mercado inicial.
- Código, contratos y persistencia se alinean con el ecosistema técnico.
- OpenAPI, tools, logs y eventos usan identificadores estables.
- La localización futura no exige renombrar campos o estados.
- Las colisiones de `Transaction`, `Account` y `Balance` quedan acotadas.
- PostgreSQL y TypeScript tienen una correspondencia explícita y revisable.
- El término `Tanda` conserva precisión cultural con una definición compartida.
- Colaboradores internacionales pueden apoyarse en un glosario canónico.

### Negativas

- El equipo debe mantener el glosario cuando aparezcan conceptos nuevos.
- Algunas búsquedas comienzan con un término en español y continúan con uno en inglés.
- El mapeo Prisma añade configuración explícita.
- Nombres precisos como `FinancialTransactionConfirmation` son más largos.
- Los términos culturales requieren explicación para personas fuera de México.

### Riesgos

- Usar traducciones alternativas fuera del glosario y crear sinónimos.
- Convertir nombres conceptuales en decisiones prematuras de modelo.
- Tratar `CurrentBalance` como un saldo independiente del ledger.
- Interpretar `RecurringObligation` como pago ya realizado.
- Modelar `Category` como cuenta o contraparte.
- Confundir `EarmarkedAccount` con una decisión ya tomada sobre la estructura del ledger.
- Crear subtipos o entidades por cada clase de `VoucherAccount` antes de decidir el modelo.
- Confundir `EmployeeSavingsFund` con `EmployeeSavingsFundAccount` y asumir prematuramente una cuenta o tabla.
- Que la excepción `Tanda` derive en una mezcla libre de idiomas.
- Exponer mensajes localizados como códigos de control en clientes.

### Trabajo derivado

Tras esta aceptación:

1. Actualizar el vocabulario técnico provisional en documentación sin traducir masivamente el texto funcional.
2. Alinear ADR-007 con campos JSON, rutas, DTO, errores y generación OpenAPI definidos aquí.
3. Incorporar el glosario a la guía de contribución de Fase 1.
4. Configurar reglas de nombres, lint y revisión donde las herramientas lo permitan.
5. Aplicar mapeos Prisma explícitos al crear el primer esquema; no antes.
6. Preparar recursos de localización `es-MX` cuando exista UI.
7. Revisar el catálogo futuro de tools para usar `camelCase`.
8. Resolver semántica y estructura en sus ADR correspondientes sin cambiar silenciosamente estos nombres.

Cada punto se ejecutará únicamente en su historia futura correspondiente. Este cierre no inicia ADR-007 ni la Fase 1.

## Validación

La aprobación explícita del responsable del proyecto confirma:

- documentación y UX en español de México;
- código, API, contratos y persistencia en inglés;
- `FinancialTransaction`, `DatabaseTransaction` y `FinancialAccount`;
- `VoucherAccount` con posible restricción o tipo `Grocery`;
- `EarmarkedAccount` como dinero separado para una finalidad;
- `EmployeeSavingsFund` como concepto laboral y `EmployeeSavingsFundAccount` solo como posible representación futura;
- `Tanda` como término cultural canónico;
- tools en `camelCase`;
- PostgreSQL singular en `snake_case`;
- Prisma/TypeScript en `PascalCase` y `camelCase` con mapeo explícito;
- estados serializados en `camelCase`;
- errores públicos con `code` estable y `message` localizable.

La adopción futura deberá verificar:

- que los contratos, rutas, tools y Prisma respeten estas convenciones;
- que UX valide recursos `es-MX`, categorías del sistema y conservación del texto del usuario;
- que errores y `metadata` no filtren datos;
- que ADR-007 adopte los códigos y campos sin crear otra convención;
- que los conceptos de balances, obligaciones y categorías permanezcan inequívocos;
- que una persona no familiarizada con México entienda `Tanda` usando solo el glosario;
- que los identificadores implementados sean ASCII y respeten su convención;
- que los ADR posteriores no conviertan nombres conceptuales en entidades sin justificarlo.

Escenarios de revisión:

1. Dado “El gasto anterior no fue gasolina”, un contrato usa `FinancialTransaction`, `Category` y códigos en inglés, mientras la UI muestra español.
2. Dado un error, el cliente decide por `code` y puede cambiar el idioma de `message` sin alterar su flujo.
3. Dado un modelo Prisma, `householdId` se corresponde explícitamente con `household_id`.
4. Dada una “tanda”, un colaborador puede distinguir aportación, turno y recepción sin asumir ingreso o gasto.
5. Dado un saldo, el contrato obliga a distinguir `LedgerBalance`, `AvailableBalance` y `ProjectedBalance`.

## Plan de adopción o migración

1. Registrar ADR-001 como **Aceptado** y sincronizar su índice.
2. Actualizar solo referencias documentales que todavía traten idioma y vocabulario como pendientes.
3. Mantener `VoucherAccount`, `EarmarkedAccount`, `EmployeeSavingsFund`, `EmployeeSavingsFundAccount`, `FinancialTransaction`, `FinancialAccount` y `Tanda` en el glosario canónico.
4. Resolver ADR-007 en una tarea posterior usando esta nomenclatura.
5. Iniciar la adopción técnica únicamente dentro de una Fase 1 autorizada, mediante scaffolding y reglas revisables.
6. Validar nombres físicos al crear la primera migración; nunca renombrar una migración aplicada.

No hay migración de código o datos en este momento porque no existen aplicaciones, contratos implementados, esquema ni base de datos. ADR-007 y Fase 1 no forman parte de este cierre. Si la convención cambia después de implementarse, se creará un ADR sustituto y un plan compatible de renombrado/migración; no se reescribirá este registro.

## Referencias

- [`AGENTS.md`](../../AGENTS.md)
- [`README.md`](../../README.md)
- [`docs/00-index.md`](../00-index.md)
- [`docs/01-product-vision.md`](../01-product-vision.md)
- [`docs/02-domain-rules.md`](../02-domain-rules.md)
- [`docs/03-mvp-scope.md`](../03-mvp-scope.md)
- [`docs/04-architecture.md`](../04-architecture.md)
- [`docs/05-roadmap.md`](../05-roadmap.md)
- [`docs/06-ai-behavior.md`](../06-ai-behavior.md)
- [Registro y plantilla de ADR](README.md)
