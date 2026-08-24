# ADR-006: Autorización, roles, visibilidad y aislamiento entre hogares

- Estado: Aceptado
- Fecha: 2026-08-13
- Responsables: Responsable del proyecto; revisión requerida de seguridad, privacidad y producto
- Fase/historia: Decisión bloqueante antes de Fase 2 — hogares, integrantes y autorización
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Copiloto Financiero necesita separar las finanzas de distintos hogares y permitir colaboración sin eliminar la privacidad individual. La Fase 1 está **cerrada**, [ADR-005](0005-autenticacion-y-ciclo-de-sesion-movil.md) está **Aceptado**, este ADR queda **Aceptado** y la Fase 2 no ha iniciado.

ADR-005 responde quién es la persona mediante Auth0, OAuth 2.0/OpenID Connect y el vínculo estable `issuer + subject` con un `User` interno. Este ADR responde una pregunta diferente:

> Autenticación: ¿quién eres?
>
> Autorización: ¿puedes hacer esta acción sobre este recurso?

Auth0 no será fuente de verdad de hogares, membresías, roles, permisos financieros, propiedad ni visibilidad. Auth0 Organizations, sus roles y sus claims no se usarán como `Household`. Toda autorización de negocio pertenecerá a Copiloto Financiero y se resolverá con datos internos vigentes en cada operación.

El caso inicial es una pareja, pero un `User` puede pertenecer a más de un `Household` y un hogar puede tener uno o más integrantes. El diseño debe permitir cuentas personales privadas, recursos compartidos explícitamente, hogares individuales y hogares con más integrantes sin suponer que conocer un identificador concede acceso.

Este ADR es documental. No crea tablas, contratos, guards, policies, migraciones ni configuración de Auth0; no instala PostgreSQL, Prisma o dependencias; y no inicia la Fase 2.

## Alcance

Este ADR propone:

- el límite entre `User`, `Household` y `HouseholdMembership`;
- roles y permisos mínimos del MVP;
- propiedad y visibilidad de recursos;
- selección y transporte del contexto de hogar;
- invitaciones, salida, expulsión y cierre de hogar;
- autorización centralizada en el servidor;
- protección contra IDOR y enumeración;
- constraints de persistencia como defensa en profundidad futura;
- el lugar de PostgreSQL Row Level Security (RLS);
- autoridad de jobs y herramientas de IA;
- auditoría y pruebas negativas requeridas.

Este ADR no decide:

- autenticación, tokens o sesiones, definidos por ADR-005;
- tablas, enums o schema Prisma definitivos;
- nombres finales de códigos de error públicos;
- reglas financieras del ledger, dinero o transacciones;
- política legal de exportación, retención o eliminación, reservada a ADR-018;
- implementación de RLS;
- permisos empresariales, roles personalizados o delegación avanzada.

## Restricciones y criterios

### Reglas innegociables

1. Todo recurso financiero pertenece a un `Household`, incluso cuando su propietario sea un `User` y su visibilidad sea privada.
2. Un `User` puede pertenecer a más de un `Household` mediante membresías independientes.
3. Pertenecer a un hogar no concede acceso automático a todas las cuentas ni recursos de sus integrantes.
4. La API nunca confiará en `householdId`, `userId`, `memberId`, `ownerId`, `role` o `permission` enviados por el cliente como prueba de autorización.
5. El servidor derivará el `User` del contexto autenticado definido por ADR-005.
6. Para una operación de hogar, el servidor resolverá una membresía activa dentro del hogar solicitado.
7. Toda lectura y escritura comprobará identidad, hogar, membresía, estado, permiso, recurso, propiedad y visibilidad aplicables.
8. Ocultar un elemento en la UI, filtrar en el cliente o recibir un claim de Auth0 no constituye autorización.
9. Los IDs serán opacos. Su complejidad reduce enumeración, pero conocerlos nunca concede acceso.
10. Los errores no confirmarán la existencia de hogares o recursos ajenos.
11. Ninguna consulta financiera buscará únicamente por ID global; deberá acotarse por hogar y por el conjunto autorizado del actor.
12. Una cuenta personal podrá permanecer privada aun cuando su propietario pertenezca a una pareja u hogar.
13. Una cuenta compartida pertenecerá al hogar o tendrá una política de acceso explícita.
14. Personal, compartido, propietario, creador, pagador y participante son conceptos distintos.
15. Un gasto podrá ser personal, compartido o atribuible a uno o varios integrantes; no se inferirá únicamente por quién lo registró.
16. Una operación que combine recursos de hogares diferentes se rechazará antes de afectar el ledger.
17. Las relaciones entre entidades validarán `householdId` también en persistencia cuando sea posible.
18. Las operaciones relacionadas serán atómicas.
19. Toda acción administrativa o de visibilidad sensible se auditará.
20. La autorización aplicará denegación por defecto y se verificará en cada request, job y tool.

### Criterios de comparación

Las alternativas se comparan por:

- privacidad de cuentas personales;
- claridad para la pareja piloto;
- soporte de varios hogares e integrantes;
- consistencia de autorización por objeto;
- prevención de IDOR y acceso cruzado;
- centralización, pruebas y mantenibilidad;
- complejidad de producto y operación;
- compatibilidad futura con NestJS, Prisma y PostgreSQL;
- defensa ante errores de aplicación;
- capacidad de evolucionar sin un motor genérico prematuro.

## Modelo conceptual mínimo

Este modelo define responsabilidades, no tablas.

| Concepto | Responsabilidad | No equivale a |
|---|---|---|
| `User` | Identidad interna global del producto vinculada de forma segura a identidades externas | Membresía, rol o permiso |
| `Household` | Límite de colaboración y aislamiento de datos | Auth0 Organization ni sesión activa |
| `HouseholdMembership` | Relación de un `User` con un `Household`, su estado y rol después de aceptar una invitación | Propiedad universal de recursos |
| `HouseholdMember` | Vista contextual de un `User` a través de su membresía, conforme al vocabulario de ADR-001 | Una identidad o relación adicional |
| `Role` | Agrupación estable de capacidades administrativas iniciales | Acceso automático a todo recurso |
| `Permission` | Capacidad específica para ejecutar una acción | Visibilidad de un objeto concreto |
| `ResourceOwnership` | Quién controla un recurso: un `User` o el `Household` | Quién puede verlo |
| `ResourceVisibility` | Audiencia autorizada para conocer o consultar un recurso | Derecho a editarlo o transferirlo |
| `HouseholdInvitation` | Invitación opaca, temporal, revocable y de uso único | Autenticación o membresía activa |

ADR-001 conserva `HouseholdMember` como término canónico para “integrante”. Esta propuesta usa `HouseholdMembership` únicamente para nombrar la relación con ciclo de vida entre `User` y `Household`; no crea dos membresías ni reemplaza silenciosamente el vocabulario aceptado.

### Estados conceptuales de membresía

El ciclo deberá representar al menos estas situaciones, sin fijar todavía un enum físico:

- `active`: única situación que habilita autorización ordinaria;
- `suspended`: acceso temporalmente bloqueado sin borrar historial;
- `left`: la persona abandonó el hogar;
- `removed`: una persona autorizada terminó la membresía.

`Suspended`, `left` y `removed` deniegan nuevas lecturas y escrituras aunque el access token de Auth0 siga siendo válido. El historial de membresía y auditoría permanece. Los estados, transiciones y nombres serializados definitivos se revisarán junto con persistencia y contratos.

## Opciones consideradas

### Estrategia de roles

#### Alternativa A: `Owner` y `Member`

Un único `Owner` conserva capacidades administrativas del hogar; `Member` participa y administra sus propios recursos. La propiedad y visibilidad siguen evaluándose por recurso.

Ventajas:

- mínima para un hogar individual o pareja;
- matriz pequeña y comprensible;
- evita confundir administración del hogar con acceso financiero;
- permite agregar `Admin` después si existe una necesidad real.

Riesgos:

- concentra gobierno administrativo en una persona;
- exige transferencia segura antes de que el `Owner` salga;
- puede resultar insuficiente para hogares grandes.

#### Alternativa B: `Owner`, `Admin` y `Member`

`Admin` recibiría parte de las capacidades del `Owner` sin ser responsable final del hogar.

Ventajas:

- delegación administrativa;
- mejor ajuste para hogares con varios integrantes.

Riesgos:

- obliga a decidir desde ahora diferencias sutiles entre `Owner` y `Admin`;
- aumenta escenarios de escalamiento, expulsión y continuidad;
- aporta poco al piloto de una pareja.

#### Alternativa C: roles y permisos configurables

Cada hogar podría crear roles y asignar permisos granulares.

Ventajas:

- flexibilidad máxima;
- adaptable a casos futuros complejos.

Riesgos:

- UX y pruebas combinatorias desproporcionadas;
- configuraciones inseguras o incomprensibles;
- motor de políticas prematuro para el MVP.

### Estrategia de autorización

#### RBAC simple

La decisión dependería solo del rol de la membresía.

Es sencillo para acciones administrativas, pero no puede expresar que un `Owner` tampoco debe leer la cuenta privada de otro integrante.

#### ABAC

La decisión usaría atributos como rol, estado, propietario, audiencia, hogar y relación con el recurso.

Expresa bien la privacidad, pero un motor ABAC genérico introduciría complejidad y reglas difíciles de explicar.

#### RBAC más policies de recurso

Los roles conceden capacidades administrativas gruesas. Policies explícitas comprueban hogar, estado, acción, propiedad y visibilidad del recurso.

Esta combinación cubre la colaboración y privacidad sin convertir la autorización en un lenguaje genérico configurable.

### Transporte del contexto de hogar

#### Alternativa A: `householdId` en la URL

Ejemplo conceptual: `/api/v1/households/{householdId}/financial-accounts/{accountId}`.

Ventajas:

- jerarquía REST explícita;
- requests autocontenidas y fáciles de auditar/probar;
- comportamiento claro con varios hogares, pestañas y dispositivos;
- cachés y logs estructurados pueden distinguir el contexto sin estado oculto.

Riesgos:

- el cliente puede manipular el ID, por lo que siempre debe revalidarse;
- rutas más largas.

#### Alternativa B: header de contexto

Un header como `X-Household-Id` transportaría el hogar.

Ventajas:

- rutas más cortas;
- contexto uniforme para varios endpoints.

Riesgos:

- el alcance queda menos visible;
- mayor riesgo de errores de caché, documentación o reintentos;
- no mejora la seguridad frente a un parámetro de ruta.

#### Alternativa C: hogar activo persistido en sesión/backend

La API recordaría el hogar seleccionado y lo aplicaría implícitamente.

Ventajas:

- menos parámetros visibles para el cliente.

Riesgos:

- estado oculto y carreras entre dispositivos o pestañas;
- requests no reproducibles;
- cambio de hogar accidental durante operaciones concurrentes;
- acoplamiento innecesario entre sesión y autorización.

### Defensa de persistencia

#### Solo autorización en aplicación

Es la opción más simple, pero una consulta sin filtro puede exponer otro hogar y la base no impide relaciones cruzadas.

#### Autorización en aplicación más constraints

La aplicación toma decisiones de negocio y la base aplica integridad referencial, claves compuestas y aislamiento estructural en escrituras.

Reduce errores cross-household sin introducir todavía contexto de seguridad por conexión. No impide por sí sola una lectura global incorrecta.

#### Autorización en aplicación, constraints y PostgreSQL RLS

RLS filtra filas y valida escrituras como defensa adicional ante una consulta defectuosa.

Su beneficio es alto para datos financieros, pero exige configurar policies, roles de base sin `BYPASSRLS`, comportamiento del propietario, contexto por transacción, pooling, jobs, migraciones y pruebas. Una policy incorrecta puede denegar operaciones válidas o crear una falsa sensación de aislamiento.

### Comparación resumida

| Decisión | Opción mínima | Opción intermedia | Opción máxima | Recomendación |
|---|---|---|---|---|
| Roles | `Owner` + `Member` | `Owner` + `Admin` + `Member` | Roles configurables | `Owner` + `Member` |
| Autorización | RBAC simple | RBAC + policies de recurso | ABAC genérico | RBAC + policies de recurso |
| Household context | URL | Header | Sesión persistida | URL |
| Persistencia inicial | Aplicación | Aplicación + constraints | Aplicación + constraints + RLS | Aplicación + constraints; evaluar RLS después |

## Decisión recomendada

Con este ADR **Aceptado**, la siguiente dirección queda aprobada como decisión documental; su implementación requiere historias posteriores y no inicia la Fase 2 por sí sola.

### Roles iniciales

Se recomienda la Alternativa A: `Owner` y `Member`.

- Al crear un hogar, su creador se convierte en el único `Owner` activo.
- Un hogar conserva exactamente un `Owner` activo durante el MVP.
- Las invitaciones crean `Member`; no crean `Owner` directamente.
- El `Owner` puede transferir su rol de forma atómica a un `Member` activo.
- No puede abandonar, suspenderse, ser removido ni cerrar su continuidad sin transferir ownership o completar un cierre controlado.
- `Owner` es un rol administrativo de continuidad del `Household`: administra configuración, invita y revoca integrantes, transfiere la continuidad administrativa y cierra el hogar bajo sus precondiciones.
- Ser `Owner` no concede propiedad financiera sobre recursos de otros integrantes, acceso a cuentas o movimientos privados, mayor participación económica ni significa ser “dueño del dinero del hogar”. La UI futura no deberá presentarlo como señal de superioridad financiera.
- `Owner` administra el hogar, pero no obtiene acceso a recursos privados de otros integrantes.
- `Member` no puede invitar, expulsar, cambiar roles ni cerrar el hogar en el primer incremento.
- Ambos roles pueden operar recursos a los que una policy de recurso les conceda acceso.

Esta cardinalidad reduce conflictos de coadministración. El costo es una asimetría administrativa aceptada para el MVP. Si el piloto requiere co-owners o delegación, otro ADR deberá revisar la decisión; no se añadirá `Admin` por anticipación.

### Matriz conceptual de roles y permisos

Los nombres de capabilities son conceptuales; los identificadores serializados definitivos pertenecerán a contratos posteriores.

| Capacidad | `Owner` | `Member` | Condición adicional |
|---|:---:|:---:|---|
| Ver configuración básica del hogar | Sí | Sí | Membresía activa |
| Cambiar nombre/configuración sensible | Sí | No | Confirmación y auditoría |
| Invitar y revocar invitaciones | Sí | No | Rol invitado limitado a `Member` |
| Suspender o expulsar a un `Member` | Sí | No | No borra historial |
| Transferir `Owner` | Sí | No | Destino activo; operación atómica |
| Cerrar el hogar | Sí | No | Precondiciones de integridad y ADR-018 |
| Abandonar el hogar | Tras transferir/cerrar | Sí | No deja recursos huérfanos |
| Crear y administrar recursos personales propios | Sí | Sí | Policy de dominio y propiedad |
| Compartir/dejar de compartir un recurso propio | Sí | Sí | No amplía derechos de edición por defecto |
| Consultar un recurso ajeno compartido | Según policy | Según policy | Visibilidad explícita |
| Registrar un gasto compartido | Según policy | Según policy | Cuentas, participantes y hogar compatibles |
| Colaborar en presupuesto/meta del hogar | Sí | Sí | Policy y reglas del módulo correspondiente |
| Crear/cerrar una cuenta financiera del hogar | Sí | No inicialmente | Decisión financiera posterior y auditoría |
| Ver una cuenta privada de otro integrante | No | No | El rol nunca sustituye visibilidad |

Un `Permission` expresa una capacidad concreta y un `Role` la agrupa. La policy final combina permiso, estado y atributos del recurso. No se admitirán comprobaciones dispersas del tipo `if (user.role === 'admin')` como mecanismo principal.

### Propiedad y visibilidad

La propiedad y la visibilidad serán dimensiones separadas:

- un recurso `UserOwned` es controlado por un `User` dentro de un `Household`;
- un recurso `HouseholdOwned` pertenece al hogar;
- compartir concede lectura según la policy, no transfiere ownership ni concede edición automáticamente;
- el creador o quien registró una operación no se convierte necesariamente en propietario;
- atribución, pagador y participantes de un gasto no determinan por sí solos su visibilidad.

Se recomiendan tres audiencias mínimas:

| Audiencia conceptual | Puede consultar | Uso |
|---|---|---|
| `Private` | Solo el propietario activo | Recurso personal no compartido |
| `SelectedMembers` | Propietario y membresías activas seleccionadas | Compartir con personas concretas |
| `Household` | Membresías activas del hogar con permiso aplicable | Recurso perteneciente o compartido con todo el hogar |

Estas audiencias no son todavía enums ni tablas. No se introduce un lenguaje configurable ni una audiencia “solo agregado”. El MVP seguro excluye recursos `Private` de agregados compartidos en lugar de revelar una contribución parcial implícita; el propietario sí puede incluir sus propios recursos privados en una consulta personal autorizada. Compartir significa lectura por defecto: amplía visibilidad, pero no transfiere ownership, no concede edición, no permite mover dinero ni cambiar configuración sensible sin una policy explícita posterior.

### Matriz conceptual de recursos

| Recurso | Ownership recomendado | Visibilidad predeterminada | Regla de agregado/detalle |
|---|---|---|---|
| `FinancialAccount` personal privada | `User` | `Private` | Excluida de totales compartidos |
| `FinancialAccount` personal compartida | `User` | `SelectedMembers` o `Household`, por decisión explícita | Solo personas autorizadas la incluyen y consultan |
| `FinancialAccount` del hogar | `Household` | `Household` | Incluida para integrantes activos autorizados |
| `FinancialTransaction` personal | Alcance y participantes de la operación; no requiere `ownerId` universal | `Private` por defecto | Entradas y cuenta origen continúan protegidas |
| `FinancialTransaction` compartida | Alcance, cuentas involucradas y participantes con audiencia explícita | `SelectedMembers` o `Household` | Puede mostrar el hecho compartido sin revelar una cuenta privada vinculada |
| `Budget` personal | `User` | `Private`; compartible explícitamente | Solo datos visibles alimentan consultas ajenas |
| `Budget` del hogar | `Household` | `Household` | No incorpora recursos privados sin consentimiento |
| `Debt` personal | `User` | `Private`; compartible explícitamente | Importe y detalle se protegen por la misma policy |
| `Debt` compartida | `Household` o ownership explícito | `SelectedMembers` o `Household` | Participantes y alcance se declaran |
| `Goal` personal | `User` | `Private`; compartible explícitamente | Excluida de paneles compartidos si sigue privada |
| `Goal` compartida | `Household` o ownership explícito | `SelectedMembers` o `Household` | Aportaciones visibles según recurso origen |

La autorización se aplica también a proyecciones de salida. Una persona puede estar autorizada a conocer un gasto compartido sin estar autorizada a conocer el nombre, saldo o movimientos de la cuenta privada usada para pagarlo. La API deberá construir una vista segura y no serializar entidades completas de persistencia.

### Alcance y atribución de gastos

Una `FinancialTransaction` pertenece siempre a un `Household`, tiene alcance/visibilidad según la operación, puede involucrar cuentas con distintos propietarios, participantes y atribución personal o compartida, y puede haber sido registrada por un actor diferente del pagador o participante. No requiere un `ownerId` universal. La autorización se deriva del hogar, tipo de operación, visibilidad, cuentas involucradas, participantes y policies aplicables; el modelo final del ledger queda diferido.

Un gasto declarará de manera explícita si es personal o compartido y podrá atribuirse a uno o varios integrantes bajo reglas del módulo financiero correspondiente. Estos datos no se deducen solo del actor que capturó la operación, de la cuenta pagadora ni del `Owner` del hogar.

- registrar no implica ser propietario;
- pagar no implica ser el único participante;
- marcar un gasto compartido no vuelve compartida la cuenta pagadora;
- atribuir un importe no concede visibilidad sobre otros movimientos;
- todos los participantes, cuentas y relaciones de la operación deben pertenecer al mismo `Household`.

### Caso de la pareja piloto

Cristopher y Vanessa pertenecen al mismo `Household`.

Cristopher tiene una cuenta bancaria, efectivo y tarjeta personales. Vanessa tiene una cuenta bancaria y efectivo personales. Esos recursos son `UserOwned` y `Private` por defecto. Ser `Owner` del hogar no permitiría a una persona ver las cuentas privadas de la otra.

El presupuesto del hogar, el dinero para renta y los gastos compartidos usan ownership/visibilidad explícitos del hogar o una audiencia que incluya a ambos. Por ello:

- ambos conocen el total de recursos compartidos que pueden consultar;
- ambos ven el hecho y la atribución de un gasto compartido;
- una cuenta personal permanece fuera hasta que su propietario la comparta;
- el propietario puede compartir una cuenta con la otra persona sin transferir ownership;
- un gasto compartido pagado desde una cuenta privada puede mostrar importe, categoría y participantes, pero omitir cuenta, saldo y otros movimientos privados.

Ante “¿Cuánto dinero tenemos entre los dos?”, el backend no sumará automáticamente cuentas privadas. Responderá con el total visible compartido para ambos, indicará que excluye recursos privados y usará una fecha de corte. Solo incorporará una cuenta personal si su policy la hace visible a la persona que consulta. No inferirá consentimiento por pertenecer al hogar, por ser pareja ni por haber compartido otra transacción.

### Household activo y contexto solicitado

Se recomienda transportar el contexto en la URL para endpoints de hogar:

`/api/v1/households/{householdId}/...`

La aplicación podrá guardar localmente una preferencia de hogar actual para UX, pero cada request será autocontenida. El `householdId` recibido es contexto solicitado, no autorización.

El backend deberá:

1. autenticar al `User` conforme a ADR-005;
2. validar la forma opaca del `householdId` sin confiar en él;
3. resolver una `HouseholdMembership` activa para ese `User` y hogar;
4. aplicar el permiso y la policy del recurso;
5. ejecutar consultas acotadas por `householdId` y recurso;
6. rechazar de forma no enumerable cualquier hogar inexistente o inaccesible.

Si el `User` pertenece a varios hogares, el cliente selecciona cuál solicita en cada ruta. Cambiar de dispositivo o pestaña no altera silenciosamente otros requests. Endpoints globales como perfil autenticado, listado de membresías propias o inicio de una invitación no necesitan un hogar activo, pero deberán limitar su respuesta al `User` autenticado.

### Invitaciones

ADR-005 continúa gobernando la autenticación de quien acepta. El flujo propuesto es:

1. el `Owner` activo crea una invitación para incorporar un `Member`;
2. el backend genera un secreto opaco, aleatorio, expirable, revocable y de uso único; antes de aceptar existe únicamente `HouseholdInvitation`, y la persistencia futura guardará una representación protegida, no el secreto recuperable;
3. la persona destinataria se autentica mediante ADR-005;
4. el backend valida invitación, hogar, estado, expiración, revocación y destinatario;
5. deriva el `User` autenticado y no acepta `userId` del cliente;
6. crea `HouseholdMembership(active)` y consume la invitación dentro de la misma transacción de base de datos;
7. asigna únicamente `Member` en el primer incremento;
8. registra auditoría sin guardar el secreto.

Reglas:

- `Member` no invita ni revoca invitaciones en el MVP;
- el `Owner` puede revocar invitaciones de su hogar;
- si la persona ya es integrante activa, no se crea otra membresía; el resultado será idempotente y seguro;
- el correo de destino es una restricción de entrega, no identidad estable;
- para una invitación dirigida, el `User` deberá demostrar un correo verificado que coincida con el destino normalizado;
- si el correo actual no coincide, la invitación no se reasigna por posesión del secreto: el `Owner` deberá revocarla y emitir otra al correo verificado correcto;
- antes de autenticar y validar destinatario solo se muestra información genérica;
- después de validar podrá mostrarse el nombre seguro del hogar, el invitador y el rol propuesto, sin datos financieros;
- el transporte concreto y la duración se fijarán antes de implementar, sin poner secretos en logs, analítica, prompts o errores.

No se usarán Auth0 Organizations, roles de Auth0 ni metadata de identidad para crear o gobernar estas membresías.

Una invitación no autoriza operaciones ni crea una membresía con estado `invited`. La membresía nace activa únicamente después de autenticación, validación y consumo atómico exitosos.

### Salida, expulsión y cierre

#### Un `Member` abandona el hogar

- la membresía pasa a un estado no activo y deja de autorizar inmediatamente;
- pierde los grants recibidos sobre recursos de otros integrantes y se cancelan operaciones pendientes que dependan de su membresía;
- los grants que antes compartían sus recursos personales dejan de autorizar detalle futuro; los hechos financieros ya compartidos conservan solo la proyección histórica necesaria y autorizada;
- no se eliminan transacciones, auditoría ni relaciones históricas;
- recursos personales deben transferirse, cerrarse o conservarse bajo una política explícita; nunca quedan huérfanos ni cambian de hogar silenciosamente;
- exportación y eliminación legal quedan sujetas a ADR-018.

#### El `Owner` expulsa a un `Member`

- requiere confirmación proporcional, revalidación de la membresía y auditoría;
- el cambio y cualquier revocación asociada son atómicos;
- el access token puede seguir siendo criptográficamente válido, pero la membresía no activa bloquea acceso;
- no concede al `Owner` acceso retroactivo a recursos privados;
- el historial financiero compartido permanece, con redacción de datos privados cuando corresponda.

#### El `Owner` quiere abandonar

- debe transferir ownership del hogar a un `Member` activo en una operación atómica o completar un cierre controlado;
- no puede dejar el hogar sin un `Owner` activo mientras el hogar continúe abierto;
- la transferencia no transfiere recursos personales privados.

#### Solo queda una persona

Un `Household` de una persona sigue siendo válido. No se elimina ni convierte implícitamente en otro tipo de contenedor.

#### Cierre o eliminación del hogar

- cerrar no equivale a hard delete;
- se impiden nuevas operaciones ordinarias, pero se conserva ledger, auditoría y relaciones históricas;
- recursos compartidos, deudas, obligaciones y operaciones pendientes requieren una resolución explícita antes del cierre definitivo;
- no se mueven recursos a otro hogar ni se reasigna ownership automáticamente;
- la eliminación o anonimización física se decidirá con ADR-018 y obligaciones aplicables.

### Flujo de autorización del servidor

```text
Authenticated User
  ↓
Requested Household Context
  ↓
Active HouseholdMembership
  ↓
Role Permission
  ↓
Resource Ownership / Visibility Policy
  ↓
Application and Domain Operation
  ↓
Audited Result
```

La separación conceptual será:

1. un guard de autenticación valida el contexto de ADR-005;
2. un guard o resolver de household obtiene contexto y membresía activa;
3. una policy central comprueba la capacidad administrativa o de aplicación;
4. un servicio de autorización de aplicación evalúa ownership, visibilidad, estado y relaciones del recurso;
5. el repositorio ejecuta una consulta acotada por hogar y claves compatibles;
6. el servicio de aplicación ejecuta reglas de dominio y auditoría.

Los guards sirven para requisitos uniformes, las policies para decisiones de acción y el servicio para relaciones de recursos. Ninguna capa por sí sola sustituye a las demás. Las decisiones deberán ser funciones comprobables con entradas explícitas y denegación por defecto; no se dispersarán condicionales de rol por controladores, repositorios o UI.

### Endpoints, contratos y errores

[ADR-007](0007-contratos-validacion-openapi-y-cliente.md) continúa vigente. Los contratos pueden recibir `householdId` como parámetro de ruta, pero su schema solo valida forma; la autorización ocurre después en el servidor.

Convención HTTP conceptual:

- `401` cuando faltan credenciales válidas o la autenticación no puede establecer un `User`;
- `403` cuando el actor autenticado puede conocer el contexto pero carece de una capacidad, por ejemplo un `Member` intenta invitar dentro de su propio hogar;
- `404` tanto para recurso inexistente como para un recurso cuya existencia el actor no está autorizado a conocer, incluidos IDs de otro hogar;
- un conflicto de estado, como invitación consumida, carrera de expulsión o intento de dejar al hogar sin `Owner`, se representará con el estado HTTP y código público que defina el contrato posterior.

Los errores conservarán `code` estable, `message` localizable y metadata mínima según ADR-001 y ADR-007. No incluirán IDs externos, ownership, estado de invitación, existencia de membresía ni diferencias temporales evitables que faciliten enumeración.

### Constraints de persistencia futura

Sin diseñar Prisma todavía, el esquema deberá considerar:

- `household_id` obligatorio en todo recurso de hogar;
- foreign keys para asegurar existencia de hogar y relaciones;
- claves compuestas como `(id, household_id)` cuando impidan asociar hijos, cuentas o entradas a otro hogar;
- constraints únicas acotadas por hogar cuando la unicidad sea local;
- índices que comiencen por `household_id` para rutas de consulta cuyo primer filtro sea el hogar;
- validación de que owner/member pertenece al mismo hogar cuando la relación lo requiera;
- operaciones atómicas para aceptar invitaciones, transferir ownership, expulsar, compartir y cambiar visibilidad;
- conservación de historial y prohibición de hard delete silencioso.

Una foreign key aislada a `accountId` no basta si permite relacionar una transacción del hogar A con una cuenta del hogar B. Las relaciones críticas deberán incorporar el límite de hogar en la misma constraint o demostrar otra protección equivalente.

### Decisión sobre PostgreSQL RLS

La decisión para Fase 2 es **autorización en aplicación más constraints**, con una evaluación técnica obligatoria de RLS antes de implementar las primeras tablas financieras de Fase 3.

RLS se recomienda como defensa en profundidad futura para aislamiento por hogar, pero no se adopta automáticamente en el primer incremento de Fase 2 porque todavía deben demostrarse:

- policies `USING` y `WITH CHECK` correctas;
- rol de aplicación sin `BYPASSRLS` y distinto del propietario de tablas, o uso consciente de `FORCE ROW LEVEL SECURITY`;
- contexto de `householdId` y actor establecido solo dentro de la misma transacción;
- compatibilidad con Prisma, nested operations e interactive transactions;
- comportamiento con pooling transaccional, donde el estado de sesión no persiste;
- rutas explícitas para jobs, migraciones, backups y soporte;
- pruebas que detecten policies ausentes, demasiado amplias o ignoradas.

Si se adopta, `SET LOCAL` o un mecanismo equivalente deberá vivir dentro de la transacción que ejecuta las consultas; nunca se confiará en estado de sesión persistente a través del pool. La conexión de aplicación no será superuser, propietaria ni tendrá `BYPASSRLS`. Jobs usarán una autoridad interna acotada, no un bypass global silencioso. Migraciones y administración usarán credenciales separadas.

RLS reforzará el filtro de filas, pero no sustituirá policies de negocio para roles, ownership, visibilidad, acciones administrativas o proyecciones redactadas. La decisión de activarlo, su alcance por tabla y el patrón Prisma quedarán en una prueba técnica y una revisión documental separadas antes de datos financieros reales.

### IDOR y enumeración

El escenario:

`GET /households/A/financial-accounts/ACCOUNT_FROM_B`

deberá buscar dentro del conjunto autorizado de A, no cargar globalmente `ACCOUNT_FROM_B` y confiar en una comprobación tardía. Manipular `householdId`, `accountId`, `memberId`, `transactionId` o `invitationId` nunca amplía el conjunto consultable.

Controles:

- IDs aleatorios/opacos como defensa adicional;
- autorización por objeto en cada operación de lectura, escritura, exportación y administración;
- consultas acotadas por hogar y policy;
- respuestas `404` indistinguibles para inexistente y ajeno cuando revelar existencia sea sensible;
- límites y auditoría segura de intentos repetidos;
- pruebas con al menos dos usuarios y dos hogares, cambiando cada referencia manipulable.

### Jobs y herramientas de IA

- Un job tendrá una autoridad interna explícita, un hogar objetivo y un propósito acotado.
- Si el job continúa una acción de usuario, conservará referencia auditada al actor y revalidará membresía/permisos al ejecutarse cuando la operación dependa de ellos.
- Un scheduler no se convierte en superusuario financiero por ejecutar fuera de un request.
- Una tool de IA recibe contexto ya autorizado por backend; no obtiene permisos a partir de texto libre.
- Cualquier `householdId` emitido por el modelo se trata como dato no confiable y se compara con el contexto permitido.
- Cambiar de hogar durante una conversación exige una selección válida y una nueva resolución de membresía.
- La conversación, el prompt y la memoria no son fuente de autorización.

### Auditoría

Como mínimo se auditarán:

- creación de hogar;
- cambio de nombre o configuración sensible;
- creación y revocación de invitación;
- aceptación de invitación;
- cambio de rol o transferencia de `Owner`;
- suspensión, expulsión y salida;
- cambio de visibilidad;
- compartir y dejar de compartir;
- cierre de hogar;
- bloqueo de membresía;
- decisiones administrativas fallidas relevantes.

Cada evento incluirá actor, acción, referencia segura del recurso, `Household`, resultado, instante y correlación. Podrá incluir estado anterior/nuevo mínimo cuando sea necesario, pero no tokens, secretos de invitación, descripciones financieras, saldos ni contenido privado innecesario.

## Amenazas principales

| Amenaza | Ejemplo | Control propuesto |
|---|---|---|
| Acceso cruzado | User A cambia `householdId` a B | Membresía activa y consulta acotada |
| IDOR por recurso | Cambiar `accountId` o `transactionId` | Policy por objeto y `404` no enumerable |
| Escalamiento vertical | `Member` envía `role: Owner` | Rol derivado de membresía interna; transferencia controlada |
| Exposición horizontal | `Owner` consulta cuenta privada ajena | Ownership/visibilidad independientes del rol |
| Relación cross-household | Entrada del hogar A apunta a cuenta B | Composite FK/constraint y validación de aplicación |
| Membresía revocada | Token válido después de expulsión | Comprobar estado activo en cada request |
| Invitación robada/reutilizada | Repetir secreto consumido | Opaca, expirable, revocable, dirigida y atómica |
| Fuga por agregado | Total compartido suma cuentas privadas | Solo recursos visibles; exclusiones explícitas |
| Fuga por serialización | Transacción compartida expone cuenta privada | View model autorizado y redacción de relaciones |
| Carrera administrativa | Expulsión simultánea con escritura | Revalidación dentro de transacción y concurrencia |
| Bypass de job | Worker consulta sin household | Autoridad interna explícita y acotada |
| Bypass de IA | Modelo inventa `householdId` | Dato no confiable; contexto resuelto por backend |
| RLS aparente | Rol propietario ignora policy | Rol no propietario/sin bypass, `FORCE RLS` evaluado y pruebas |

## Consecuencias

### Positivas

- La privacidad personal no depende del rol ni de la UI.
- El contexto de hogar es explícito y reproducible.
- Un mismo `User` puede trabajar con varios hogares sin estado oculto.
- RBAC permanece pequeño y las reglas de recurso expresan lo necesario.
- Consultas, constraints y una posible capa RLS forman defensas complementarias.
- Auth0 queda limitado a identidad y sesión.
- Las pruebas negativas pueden ejercitar una matriz clara.
- Agregados y tools respetan la misma autorización que la API.

### Negativas

- Cada caso de uso deberá declarar acción y policy de recurso.
- Una ruta con `householdId` explícito es más larga.
- Exactamente un `Owner` introduce asimetría administrativa.
- Compartir recursos requiere UX comprensible y auditoría.
- Vistas redactadas pueden necesitar más contratos que serializar una entidad completa.
- RLS queda diferido y no protegerá el primer incremento hasta que se evalúe/adopte.

### Riesgos

- convertir `Owner` en acceso universal por comodidad;
- omitir una policy en un endpoint nuevo;
- consultar por ID global y comprobar hogar demasiado tarde;
- mezclar ownership, visibilidad, atribución y autor del registro;
- compartir implícitamente una cuenta mediante un agregado;
- perder acceso legítimo o dejar recursos huérfanos al salir;
- revelar diferencias mediante errores o tiempos;
- una carrera entre expulsión y escritura;
- asumir que IDs opacos sustituyen autorización;
- implementar RLS con un rol que la omite;
- perder contexto RLS al usar pooling o una conexión distinta;
- jobs o tools con privilegios excesivos.

### Mitigaciones

- denegación por defecto y policy obligatoria por operación;
- servicio central de autorización con pruebas unitarias de matriz;
- repositorios que exijan `householdId` en consultas de recursos;
- constraints compuestas y transacciones atómicas;
- response models explícitos y redacción de relaciones privadas;
- errores uniformes y pruebas de enumeración;
- revalidación de membresía dentro de la operación transaccional;
- auditoría de cambios administrativos y visibilidad;
- pruebas con dos hogares, múltiples roles y referencias manipuladas;
- revisión de permisos al agregar endpoints, jobs o tools;
- spike de RLS con Prisma/pooling y prueba de bypass antes de adoptarlo;
- modelado de amenazas y revisión de privacidad antes de beta.

### Trabajo derivado

Solo después de aceptar este ADR y autorizar una tarea de Fase 2 se deberá:

1. definir contratos de household, membership e invitation conforme a ADR-007;
2. decidir estados serializados y códigos públicos sin cambiar esta semántica;
3. diseñar schema y migraciones nuevas con constraints cross-household;
4. implementar el resolver de contexto, policies y servicio central de autorización;
5. implementar invitaciones, transferencia de `Owner`, salida y expulsión;
6. crear view models que protejan recursos privados;
7. agregar auditoría de acciones sensibles;
8. ejecutar pruebas negativas, de concurrencia e IDOR;
9. realizar el spike de RLS antes de tablas financieras de Fase 3;
10. actualizar OpenAPI, cliente móvil y documentación en la misma historia.

Nada de este trabajo se ejecuta en este ADR documental.

### Trabajo diferido

- `Admin`, co-owners o roles configurables;
- permisos financieros avanzados por operación;
- audiencia “solo agregado” sin detalle;
- políticas legales de exportación, retención y eliminación de ADR-018;
- RLS definitivo y su alcance por tabla;
- roles de soporte, break-glass y administración operacional;
- compartir recursos entre hogares, que permanece fuera del MVP;
- una política de fusión o división de hogares.

## Validación

### Revisión documental

La validación de esta decisión aceptada comprueba que:

- ADR-001, ADR-005 y ADR-007 continúan Aceptados;
- ADR-006 está Aceptado; su aceptación no autoriza por sí sola el inicio de Fase 2;
- Fase 1 está cerrada y Fase 2 no iniciada;
- Auth0 no gobierna hogares, membresías, roles ni visibilidad;
- `householdId` es contexto solicitado y nunca autorización;
- una cuenta personal puede permanecer privada;
- pertenecer al hogar no concede acceso universal;
- varios hogares están soportados;
- ownership y visibilidad están separados;
- recursos privados quedan fuera de agregados compartidos;
- invitaciones no sustituyen autenticación;
- RLS fue evaluado y no implementado;
- no se crearon tablas, contratos ni código.

### Matriz mínima de pruebas futuras

1. `User` del hogar A intenta leer, actualizar y exportar recursos del hogar B.
2. `Member` intenta ver una cuenta personal privada de otro integrante.
3. `Member` consulta una cuenta que su propietario compartió explícitamente.
4. El cliente cambia `householdId` sin cambiar credenciales.
5. El cliente conserva el hogar correcto y cambia `accountId` por uno externo.
6. Se manipulan `memberId`, `transactionId` e `invitationId`.
7. Un `Member` intenta invitar, expulsar o transferirse `Owner`.
8. Un `Owner` intenta leer una cuenta privada de un `Member`.
9. Un integrante expulsado usa un access token todavía válido.
10. Una invitación revocada, expirada o consumida se intenta aceptar.
11. Dos requests intentan consumir la misma invitación.
12. La persona invitada ya pertenece al hogar.
13. El correo verificado actual no coincide con la invitación dirigida.
14. Cambia el rol durante una sesión activa.
15. Un `User` selecciona correctamente entre dos hogares.
16. Una transacción intenta combinar cuentas de hogares distintos.
17. Un gasto compartido pagado desde cuenta privada no expone esa cuenta.
18. Una tool de IA propone un `householdId` externo.
19. Un job intenta operar sin autoridad/hogar explícitos.
20. Recurso inexistente y recurso no autorizado producen respuestas no enumerables.
21. Expulsión y escritura concurren; la escritura no se confirma después de perder autorización.
22. El único `Owner` intenta salir sin transferir.
23. Un agregado compartido excluye cuentas privadas y comunica la exclusión.
24. Una relación cross-household falla en aplicación y persistencia.
25. Si RLS se adopta, el rol de aplicación no puede omitir policies y el contexto no sobrevive indebidamente al pool.

Las pruebas cubrirán lectura, creación, actualización, corrección, exportación y administración. Se usarán fixtures ficticios con al menos dos hogares, usuarios con membresías múltiples y recursos con las tres audiencias.

### Decisiones diferidas a trabajo posterior

1. Definir antes de implementar el transporte y la duración de invitaciones.
2. Revisar precondiciones de salida/cierre para recursos, deudas y obligaciones sin decidir eliminación legal.
3. Definir códigos públicos concretos y sus contratos.
4. Detallar policies por recurso y capacidades de edición u operación.
5. Ejecutar el spike de RLS con Prisma, pooling, jobs y migraciones antes de Fase 3.

## Plan de adopción o migración

1. Registrar ADR-006 como **Aceptado** y enlazarlo desde el registro, arquitectura e índice documental.
2. Mantener Fase 2 detenida hasta una tarea posterior que autorice su inicio.
3. Implementar primero household/membership y policies sin datos financieros reales cuando Fase 2 sea iniciada explícitamente.
4. Incorporar invitaciones y ciclos de salida con pruebas negativas y de concurrencia.
5. Agregar cada recurso financiero solo en su fase y con una policy registrada.
6. Evaluar RLS con Prisma, pooling, jobs y migraciones antes de Fase 3.
7. Completar modelado de amenazas, retención y operación antes de beta.

Si una decisión aceptada cambia después de implementarse, otro ADR sustituirá este registro y definirá migración de roles, grants y datos. No se reescribirá el historial para ocultar la decisión anterior.

## Referencias oficiales

Fuentes consultadas el **2026-08-13**:

- [OWASP Authorization Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
- [OWASP Insecure Direct Object Reference Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html)
- [RFC 9110: HTTP Semantics](https://www.rfc-editor.org/rfc/rfc9110.html)
- [PostgreSQL: Row Security Policies](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
- [PostgreSQL: SET y `SET LOCAL`](https://www.postgresql.org/docs/current/sql-set.html)
- [Prisma: Client Extensions](https://www.prisma.io/docs/orm/prisma-client/client-extensions)
- [Prisma: Connection pooling](https://www.prisma.io/docs/postgres/database/connection-pooling)
- [Prisma: Transactions and batch queries](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Auth0: Organizations overview](https://auth0.com/docs/manage-users/organizations/organizations-overview)
- [Auth0: Role-Based Access Control](https://auth0.com/docs/manage-users/access-control/rbac)

## Referencias del proyecto

- [`AGENTS.md`](../../AGENTS.md)
- [`README.md`](../../README.md)
- [`docs/00-index.md`](../00-index.md)
- [`docs/01-product-vision.md`](../01-product-vision.md)
- [`docs/02-domain-rules.md`](../02-domain-rules.md)
- [`docs/03-mvp-scope.md`](../03-mvp-scope.md)
- [`docs/04-architecture.md`](../04-architecture.md)
- [`docs/05-roadmap.md`](../05-roadmap.md)
- [`docs/07-security-and-privacy.md`](../07-security-and-privacy.md)
- [`docs/08-definition-of-done.md`](../08-definition-of-done.md)
- [ADR-001: Idioma y vocabulario canónico](0001-idioma-y-vocabulario-canonico.md)
- [ADR-005: Autenticación y ciclo seguro de sesiones móviles](0005-autenticacion-y-ciclo-de-sesion-movil.md)
- [ADR-007: Contratos, validación, OpenAPI y cliente](0007-contratos-validacion-openapi-y-cliente.md)
- [Registro y plantilla de ADR](README.md)
