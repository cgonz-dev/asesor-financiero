# Arquitectura inicial

## Estado

**Fases 1 y 2 cerradas.** El bootstrap técnico, health contractual, cliente móvil mínimo, OpenAPI
reproducible, CI inicial y modo LAN quedaron validados en Fase 1. Fase 2 implementó PostgreSQL/
Prisma, identidad interna, hogares y memberships, Auth0/sesión móvil, invitaciones dirigidas,
policies de visibilidad y auditoría atómica, más el acceso Google-only. Las validaciones Android de
invitaciones con segunda identidad y del ciclo Google-only están registradas, junto con la matriz
completa verde. Administración avanzada de integrantes, recursos financieros y RLS permanecen
fuera de Fase 2; el spike de RLS es un gate previo a Fase 3.

## Objetivos arquitectónicos

- Mantener exactitud, trazabilidad y reconstrucción histórica.
- Aislar hogares y respetar propiedad/visibilidad.
- Separar interpretación de IA de ejecución financiera.
- Compartir contratos sin acoplar dominio a frameworks.
- Permitir evolución hacia offline, recordatorios e integraciones sin implementarlos prematuramente.
- Favorecer entregas pequeñas, pruebas por capas y sustitución de proveedores.

## Decisiones iniciales

| Área | Decisión de partida | Observación |
|---|---|---|
| Repositorio | Monorepo con pnpm workspaces | Bootstrap inicial creado en Fase 1 |
| Lenguaje | TypeScript; documentación/UX en español e identificadores técnicos en inglés | Según [ADR-001](adr/0001-idioma-y-vocabulario-canonico.md) |
| Móvil | React Native + Expo | Aplicación inicial |
| Navegación | Expo Router | Rutas de la app móvil |
| Backend | NestJS | API modular |
| Interfaz | REST | OpenAPI como descripción |
| Datos | PostgreSQL | Persistencia base implementada en Fase 2; PostgreSQL 18.4 efímero en CI |
| ORM/migraciones | Prisma 7.9.1 | Prisma Migrate y migraciones inmutables una vez aplicadas |
| Contratos | Paquete compartido con schemas Zod y tipos inferidos | Zod 4.4.3 y `nestjs-zod` 5.5.0 validados en Fase 1 según [ADR-007](adr/0007-contratos-validacion-openapi-y-cliente.md) |
| Asistente | OpenAI Responses API | Tool calling y salidas estructuradas |
| Procesos programados | Redis + BullMQ | Solo al implementar recordatorios/jobs |
| Autenticación | Auth0 mediante OAuth 2.0/OIDC | Límite API y sesión móvil implementados y validados conforme a [ADR-005](adr/0005-autenticacion-y-ciclo-de-sesion-movil.md) |
| Panel web | Fuera del MVP | Previsto posteriormente |
| Bancos/pagos | Fuera del MVP | Sin conexiones ni ejecución automática |

## Estructura inicial

Fase 1 creó la estructura base. La Historia 1 de Fase 2 añadió dominio mínimo independiente y
adaptadores de persistencia dentro de la API. Historia 2 añade autenticación, Historia 3 incorpora
el primer límite Household HTTP/móvil e Historia 4 añade invitaciones dirigidas y auditoría mínima,
Historia 5 añade policies puras de visibilidad sin introducir recursos financieros; las áreas de
fases posteriores siguen sin lógica funcional:

```text
apps/
  mobile/
  api/

packages/
  contracts/
  domain/
  config/
  eslint-config/
  typescript-config/

docs/
  adr/
  exec-plans/
  mobile/
  project-state.md
```

### Responsabilidad por ubicación

| Ubicación | Responsabilidad | No debe contener |
|---|---|---|
| `apps/mobile` | UI, navegación, estado de presentación, cliente API y almacenamiento seguro local | Reglas finales de saldo ni credenciales |
| `apps/api` | HTTP, autenticación/autorización, casos de uso, persistencia, integración de IA y jobs | Componentes de UI |
| `packages/contracts` | DTO, esquemas de entrada/salida, errores públicos y tipos generados/compartidos | Lógica financiera o acceso a datos |
| `packages/domain` | Valores, invariantes y reglas financieras independientes | NestJS, Prisma, Expo u OpenAI |
| `packages/config` | Configuración compartida no secreta y validación de entorno | Valores secretos |
| `packages/eslint-config` | Política de lint reutilizable | Configuración específica de negocio |
| `packages/typescript-config` | Bases de TypeScript | Código ejecutable de aplicación |
| `docs/adr` | Registro de decisiones duraderas | Secretos o documentación operacional sensible |
| `docs/exec-plans` | Trabajo operacional activo y evidencia de planes completados | Decisiones arquitectónicas o copias del roadmap |
| `docs/mobile` | Fuente de verdad del sistema visual móvil implementado | Reglas de autorización o negocio |
| `docs/project-state.md` | Snapshot operacional actual | Historial extenso o plan de implementación |

## Vista de componentes

```text
Aplicación móvil
  └─ Cliente REST tipado
       └─ API NestJS
            ├─ Identidad, hogares y autorización
            ├─ Cuentas y ledger
            ├─ Transacciones y conciliación
            ├─ Obligaciones, presupuestos y proyecciones
            ├─ Orquestador del asistente
            ├─ Auditoría y observabilidad
            └─ Adaptadores
                 ├─ PostgreSQL / Prisma
                 ├─ OpenAI Responses API
                 └─ Redis / BullMQ (fase posterior)
```

El monorepo no autoriza dependencias indiscriminadas. La dirección prevista es:

- UI móvil → contratos/cliente;
- controladores API → casos de uso;
- casos de uso → dominio y puertos;
- adaptadores → puertos y proveedores;
- dominio → ninguna aplicación, framework o proveedor.

## Módulos de negocio propuestos

- identidad y acceso;
- hogares, integrantes, roles y visibilidad;
- cuentas;
- ledger;
- transacciones;
- categorías;
- tarjetas, deudas y planes a meses;
- obligaciones recurrentes;
- tandas;
- conciliación;
- presupuestos, metas y escenarios;
- asistente;
- auditoría.

Los límites exactos y dependencias se validarán a medida que avance el roadmap. Evitar un módulo “finanzas” monolítico o servicios gigantes.

## Modelo conceptual de datos

La primera migración de Fase 2 implementa únicamente:

- `app_user`: identidad interna estable, con UUID opaco y estado mínimo;
- `external_identity`: identidad externa separada, única por `issuer + subject`, sin usar correo
  como clave ni vínculo automático;
- `household`: límite mínimo de colaboración, sin atributos financieros;
- `household_membership`: relación estable User↔Household con roles Owner/Member y estados
  Active/Suspended/Left/Removed.

Los IDs persistentes usan UUID v4 nativo de PostgreSQL. Esta elección mantiene identificadores
opacos e interoperables sin exponer secuencias. Las tablas PostgreSQL son singulares en
`snake_case`; Prisma y TypeScript conservan `PascalCase`/`camelCase` mediante mapeo explícito según
ADR-001.

`external_identity` tiene `UNIQUE (issuer, subject)`. `household_membership` tiene una relación única
por `(household_id, user_id)`, índices para consultas por Household y por User/membresía activa, y
foreign keys restrictivas. Un índice parcial SQL limita a un solo Owner Active por Household. Prisma
todavía requiere una función Preview para declarar ese índice parcial, por lo que la migración
versionada lo expresa en SQL revisado; el caso de uso crea Household y Owner Active en la misma
transacción para garantizar exactamente uno al inicio.

La segunda migración de Fase 2 agrega `household_invitation` y `audit_event`. La invitación mantiene
solo el hash del token, su Household, la membership Owner creadora, la restricción de correo y sus
timestamps de ciclo. La auditoría actual es deliberadamente mínima y registra la creación de
Household y los tres eventos de invitación implementados; no sustituye el diseño general pendiente
de ADR-019.

Prisma, sus repositorios y las transacciones viven en `apps/api`; `packages/domain` no importa
NestJS ni Prisma. El desarrollo local usa `prisma dev` porque el motor Docker disponible no estaba
operativo durante la implementación. CI usa PostgreSQL real efímero y aplica solo migraciones
versionadas.

Para fases posteriores se prevén, sin que sean tablas definitivas todavía:

- `account`, propiedad y política de visibilidad;
- `transaction`, `ledger_entry`;
- `category`, asignaciones y divisiones;
- `obligation`, recurrencia y ocurrencias;
- `installment_plan`, cuotas y asociaciones de pago;
- `debt`/condiciones si no se modelan enteramente como cuenta;
- `tanda` y sus aportaciones/turnos;
- `reconciliation`, snapshot y diferencias;
- `budget`, regla de distribución y periodo;
- `goal`;
- `transaction_draft` o equivalente;
- `idempotency_record`;
- ampliación de `audit_event` para el sistema financiero y operacional completo.

Esta lista futura identifica conceptos, no tablas definitivas. Normalización, historización, claves,
índices y retención necesitan diseño/ADR antes de implementarse.

## Ruta de una escritura financiera

1. El cliente o el orquestador de IA envía una intención con contrato validable, identidad y clave idempotente.
2. La API autentica al actor.
3. La autorización valida hogar, membresía, recurso, propiedad y visibilidad.
4. El servicio de aplicación carga estado necesario.
5. El dominio valida moneda, cuentas, importe, operación, balance y reglas específicas.
6. El backend construye una vista previa sin afectar saldos.
7. El usuario confirma la versión exacta de la vista previa.
8. En una transacción de base de datos se verifica idempotencia/concurrencia y se escriben encabezado, entradas, relaciones, compromisos y auditoría.
9. Se responde con el resultado persistido y saldos recalculados/consultados.
10. Efectos secundarios no financieros se publican de forma confiable si aplica.

Una confirmación expirada o cuyo estado base cambió debe recalcularse o rechazarse; nunca ejecutar silenciosamente una intención distinta.

## Ruta de una consulta

1. Autenticación y autorización.
2. Validación de alcance, instante, moneda y filtros.
3. Lectura del ledger y datos auxiliares.
4. Cálculo determinista de saldo, disponibilidad o proyección.
5. Respuesta estructurada con componentes y fecha de corte.
6. La IA, si participa, explica esos datos sin recalcularlos libremente.

## Ledger y consistencia

- `transaction` es el encabezado atómico.
- `ledger_entry` es cada afectación a una cuenta.
- Las entradas se balancean por transacción y moneda.
- Las cuentas expresan ubicación/obligación; categorías expresan análisis.
- Compromisos futuros viven separados de movimientos realizados.
- Recordatorios no alteran saldos.
- Correcciones agregan historia; no mutan entradas confirmadas.
- Los saldos derivados pueden optimizarse con agregados o snapshots reconciliables.

El diseño definitivo de signos, restricciones en base de datos, cuentas técnicas, bloqueo y reconstrucción se decide mediante ADR antes de Fase 3.

## API y contratos

- REST inicial bajo `/api/v1`.
- OpenAPI se deriva de los contratos y debe reflejar la API implementada.
- `packages/contracts` usa schemas Zod como fuente compartida de entradas, salidas, errores y tipos inferidos.
- La validación ocurre en el límite y vuelve a ocurrir en dominio para invariantes.
- Los contratos financieros incluyen importes exactos, moneda, fechas, IDs opacos e idempotency key.
- Los errores son estables, accionables y no filtran datos.
- Un cambio incompatible requiere estrategia explícita; no se rompe móvil silenciosamente.

ADR-007 define la estrategia de contratos, OpenAPI, cliente inicial y versionado. La prueba no financiera de Fase 1 seleccionó Zod 4.4.3 y `nestjs-zod` 5.5.0: `createZodDto` deriva en `apps/api` una clase adaptadora sin campos duplicados, mientras `ZodSerializerInterceptor` valida la salida. `packages/contracts` permanece independiente de NestJS y deriva del mismo schema base una variante estricta para servidor y otra compatible para cliente.

`cleanupOpenApiDoc` convierte el schema del adaptador a OpenAPI 3.1. El artefacto se serializa con
claves ordenadas y `openapi:check` lo compara sin regenerarlo silenciosamente. `GET /api/v1/health`
indica que el proceso vive; `GET /api/v1/readiness` ejecuta una consulta PostgreSQL ligera y responde
de forma segura sin revelar URL, host, credenciales ni errores internos.

## Autenticación implementada en Historia 2

El cliente móvil es una Native Application pública. `react-native-auth0` abre Universal Login en el
navegador seguro con Authorization Code + PKCE S256, `state` y `nonce`, solicita un access token
para la audience propia y delega la persistencia necesaria al Credentials Manager respaldado por
Keychain/Keystore. Un coordinador conserva el access token utilizable en memoria, restaura la
sesión antes de mostrar contenido privado, ejecuta una sola renovación concurrente, permite un
único reintento tras `401` y
aborta solicitudes al cerrar sesión. Expo Go y Expo Web no son superficies de autenticación móvil.

El cliente REST depende de un puerto `TokenProvider`, no de Auth0. `packages/contracts` contiene el
schema Zod de `/me` y errores públicos, pero no SDK, claims ni tipos del proveedor.

En NestJS un guard central:

1. exige un Bearer JWT compacto con tamaño acotado;
2. verifica RS256, `kid`, issuer y audience exactos, `exp`, `nbf` y `sub` mediante JOSE; el clock
   skew inicial es de cinco segundos, suficiente para relojes de servidor sincronizados sin ampliar
   de forma material la ventana de aceptación;
3. obtiene JWKS solo del issuer configurado, con timeout, caché, cooldown y refresh controlado ante
   rotación;
4. falla cerrado ante firma, algoritmo, `kid`, issuer, audience o claims inválidos;
5. transforma únicamente la identidad verificada `issuer + subject` y la entrega a
   `ResolveOrCreateUserFromExternalIdentity`;
6. crea un contexto interno con `User` activo y responde `GET /api/v1/me` solo con UUID opaco y
   estado.

Health y readiness permanecen públicos. `/me` no recibe `userId`, email ni `householdId`, no expone
tokens o claims y todavía no resuelve membresías. Las pruebas usan claves, issuer y JWKS sintéticos
locales; CI no depende de Auth0 real ni de secretos. En desarrollo se validaron Google y Database
Connection, restauración, `/me`, logout y relogin en un development build Android. La política
inicial del tenant usa access tokens de 10 minutos, inactividad de refresh de 7 días, máximo de 30
días, rotación y overlap de 3 segundos; permanece revisable y no se duplica en código.

## Invitaciones Household implementadas en Historia 4

`HouseholdInvitation` es independiente de `HouseholdMembership`. Conserva Household, membership
creadora, correo objetivo normalizado, SHA-256 del secreto aleatorio, expiración y marcas de
revocación/aceptación. El token crudo tiene 256 bits, formato base64url y solo existe en la respuesta
de creación y en memoria móvil; nunca se persiste ni se coloca en una URL. La duración inicial de
siete días está centralizada y es configurable antes de iniciar la API.

El Owner activo puede crear, listar y revocar invitaciones. La aceptación recibe únicamente el token
en un body autenticado, deriva Household de la invitación persistida y compara la restricción de
entrega contra un correo verificado firmado dentro del access token. `issuer + subject` sigue siendo
la identidad estable; el correo no resuelve ni enlaza Users. Una transacción PostgreSQL con bloqueo
de fila crea `HouseholdMembership(Member, Active)`, consume la invitación y escribe el evento de
auditoría. La misma exclusión serializa aceptación/aceptación y aceptación/revocación.

La base impide hashes duplicados, cruces entre la membership creadora y otro Household, estados
aceptado/revocado simultáneos y membresías Household/User duplicadas. Los eventos mínimos son
`invitation.created`, `invitation.revoked` e `invitation.accepted`, sin token, hash ni correo. El
cliente puede compartir texto por la hoja nativa del sistema, pegar y aceptar el código, refrescar
Households y mostrar una proyección mínima de integrantes. No existen magic links, correo
transaccional, roles configurables ni administración avanzada de membresías.

La implementación automática, las pruebas PostgreSQL y la validación en Android real con una
segunda identidad/dispositivo completaron Historia 4. La prueba confirmó que la Post Login Action
conectada al Login Flow entrega los claims verificados necesarios para aceptar la invitación.

## Policies de visibilidad y auditoría básica de Historia 5

`packages/domain` concentra dos decisiones puras y sin frameworks:

- capabilities administrativas de Household, con membership `Active` y denegación por defecto;
- lectura de un descriptor de recurso no financiero según acción, capability aplicable, mismo
  Household, ownership y audiencia `Private`, `SelectedMembers` o `Household`.

La policy no crea enums de persistencia, contratos, endpoints ni recursos ficticios. `Private`
autoriza solo al propietario activo; `SelectedMembers` al propietario o memberships activas
seleccionadas; `Household` a memberships activas con la capability correspondiente. El rol Owner no
omite ownership/visibilidad y toda acción o combinación desconocida se deniega.

La API conserva el resolver `User + Household + Active HouseholdMembership` y delega su matriz de
capabilities al dominio. La creación transaccional de un Household ahora incluye
`household.created`; si la auditoría falla, también revierten Household y membership. No hubo
cambio de schema, migración, contrato, OpenAPI ni comportamiento móvil.

## Navegación y sistema visual móvil de Fase 2

La reorganización visual de Fase 2 no adelanta la aplicación financiera de Fase 5. Expo Router usa
un Stack raíz para la compuerta de sesión y los modales de crear hogar, invitar y aceptar, más un
grupo de Tabs estable para `Inicio`, `Hogar` y `Perfil`. Las pestañas contienen únicamente identidad,
selección de Household, integrantes e invitaciones ya autorizadas; no presentan saldos, cuentas,
movimientos ni un dashboard financiero ficticio.

`MobileAppProvider` es la composición móvil interna que crea una sola instancia del runtime y
publica snapshots y acciones de los coordinadores existentes. La restauración de Auth0 sucede una
vez; los cambios de ruta no recrean Credentials Manager, clientes REST ni coordinadores. Al perder
la sesión se limpian Households, selección e invitaciones y el Stack raíz retira las rutas privadas
mediante un único `Stack.Protected`; layouts y pantallas hijas no emiten redirects simultáneos. La
selección persistida sigue siendo una preferencia revalidada por servidor y nunca autorización.

El sistema visual local define tokens de color, espaciado, radios, tipografía Manrope y componentes
acotados sobre React Native. El modo es oscuro y fijo; degradados e iconos son presentación, no
semántica de estado ni lógica de permisos. No se incorporó un framework de UI, desenfoque o motor de
animación. El token crudo de invitación no cruza la navegación: solo vive en el snapshot en memoria
del coordinador y se descarta al compartir, cerrar o desmontar el modal.

## Asistente e integración con OpenAI

El orquestador del backend:

- envía solo el contexto mínimo autorizado;
- usa OpenAI Responses API con tools tipadas y salidas estructuradas;
- valida cada argumento como entrada no confiable;
- llama servicios de aplicación, no repositorios;
- conserva correlación y auditoría;
- devuelve vistas previas antes de escribir;
- obtiene saldos y proyecciones de herramientas de lectura;
- maneja timeouts/reintentos sin duplicar operaciones.

La conversación no es almacenamiento financiero. Retención, redacción, ubicación de prompts, versiones de modelo, evaluaciones y fallback requieren diseño antes de Fase 6.

## Recordatorios y procesos programados

Redis y BullMQ se incorporarán cuando Fase 8 los necesite. Hasta entonces no son dependencias obligatorias.

Principios:

- un job o recordatorio no confirma movimientos por sí solo;
- los jobs son idempotentes;
- tiempos, zona horaria, reintentos y dead-letter se definen explícitamente;
- los efectos financieros siguen la misma ruta transaccional que cualquier cliente;
- se considera patrón outbox para publicación confiable, pendiente de ADR.

## Preparación para offline

El primer incremento puede requerir conexión. El diseño debe permitir después:

- IDs e idempotency keys generados de forma segura en cliente;
- cola local cifrada o protegida;
- estados `pending`, `synced`, `failed`;
- reintentos deduplicados;
- versión de recursos y detección de conflictos;
- confirmación de vistas previas caducadas;
- política de resolución que nunca combine dinero por “última escritura gana” sin validación.

La arquitectura completa de sincronización queda pendiente de ADR y fuera del MVP inicial.

## Seguridad arquitectónica

- `household_id` se transporta y valida, pero nunca se confía solo en un valor del cliente.
- La API deriva identidad y membresía del contexto autenticado.
- Todas las consultas se acotan por hogar y autorización de recurso.
- Se consideran controles en aplicación y, previa evaluación, Row Level Security.
- Secretos se obtienen de un gestor/entorno seguro, no del repositorio.
- TLS en tránsito.
- Las credenciales móviles persistidas usan el Credentials Manager de Auth0 sobre
  Keychain/Keystore; no se usa AsyncStorage, localStorage ni SQLite para tokens. AsyncStorage guarda
  únicamente el UUID no sensible del Household preferido, separado por User y revalidado contra la
  lista autorizada antes de reutilizarlo.
- La API usa una allowlist estática de issuer/audience y no confía roles u Organizations de Auth0
  para autorización Household.
- El pipeline implementado es `AuthenticationGuard` → `HouseholdContextResolver` →
  `HouseholdAuthorizationPolicy` → caso de uso. El resolver consulta desde el inicio por
  `householdId + User + Active HouseholdMembership`; deniega por defecto y no revela si un UUID
  inexistente, ajeno o inactivo corresponde a un registro real.
- Logs, trazas y prompts se redactan.
- Auditoría de accesos y escrituras sensibles.
- Backups, restauración, exportación y eliminación se diseñan antes de beta.

Los detalles están en [`07-security-and-privacy.md`](07-security-and-privacy.md).

## Observabilidad y operación

Se requieren:

- correlation ID a través de móvil, API, tools y jobs;
- métricas técnicas y de invariantes sin datos sensibles;
- trazas y logs estructurados con redacción;
- alertas para fallos de balance, duplicación, autorización y jobs;
- auditoría separada de logs operativos;
- health/readiness checks;
- runbooks antes de beta.

No se registrarán mensajes completos, tokens, números de cuenta, importes asociados a identidad u otros datos financieros sin justificación y protección explícitas.

La CI inicial se implementa con GitHub Actions: en cambios a `main`, pull requests hacia `main` y
ejecuciones manuales valida la instalación reproducible, los controles del monorepo y que el
artefacto OpenAPI versionado permanezca actualizado. No despliega ni publica artefactos.

## Estrategia de pruebas

- unitarias para valores, reglas, balance, redondeo y estados;
- integración para PostgreSQL/Prisma, transacciones, constraints, idempotencia y aislamiento;
- contratos para OpenAPI, cliente y tools;
- E2E para flujos críticos móvil/API;
- seguridad para acceso cruzado, enumeración, propiedad y redacción;
- evaluaciones del asistente para ambigüedad, tool selection, no invención y confirmación;
- reconstrucción basada en secuencias de operaciones;
- concurrencia y reintentos.

## ADR y fase límite

| ID | Decisión | Resolver antes de | Estado |
|---|---|---|---|
| [ADR-001](adr/0001-idioma-y-vocabulario-canonico.md) | Idioma y vocabulario canónico de dominio/código/API | Fase 1 | Aceptado |
| ADR-002 | Representación monetaria, moneda, redondeo y división | Fase 3 | Pendiente |
| ADR-003 | Modelo de ledger, signos, cuentas técnicas e invariantes en DB | Fase 3 | Pendiente |
| ADR-004 | Estados, vista previa, confirmación y correcciones | Fase 3 | Pendiente |
| [ADR-005](adr/0005-autenticacion-y-ciclo-de-sesion-movil.md) | Autenticación y ciclo seguro de sesiones móviles | Fase 2 | Aceptado |
| [ADR-006](adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md) | Autorización, roles, visibilidad y aislamiento/RLS | Fase 2 | Aceptado |
| [ADR-007](adr/0007-contratos-validacion-openapi-y-cliente.md) | Contratos compartidos, validación, OpenAPI, cliente tipado y versionado de API | Fase 1 | Aceptado |
| ADR-008 | Idempotencia, concurrencia y alcance de claves | Fase 3 | Pendiente |
| ADR-009 | Fechas efectivas, zona horaria y periodos quincenales/mensuales | Fase 3 | Pendiente |
| ADR-010 | Categorías, división y reclasificación histórica | Fase 4 | Pendiente |
| ADR-011 | Persistencia de borradores y expiración de previews | Fase 4 | Pendiente |
| ADR-012 | Manejo de prompts, modelo, retención, redacción y evaluaciones de IA | Fase 6 | Pendiente |
| ADR-013 | Modelo de tarjetas, deudas, MSI y asignación de pagos | Fase 7 | Pendiente |
| ADR-014 | Recurrencias, tandas, scheduler, outbox, Redis y BullMQ | Fase 8 | Pendiente |
| ADR-015 | Conciliación, snapshots y cuentas de diferencias | Fase 9 | Pendiente |
| ADR-016 | Fórmulas de disponibilidad, presupuestos y proyecciones | Fase 10 | Pendiente |
| ADR-017 | Estrategia offline, sincronización y conflictos | Después del MVP o antes si entra en alcance | Pendiente |
| ADR-018 | Clasificación/retención, exportación y eliminación de datos | Antes de beta | Pendiente |
| ADR-019 | Observabilidad, auditoría y redacción de datos sensibles | Fase 3; completar antes de beta | Pendiente |
| ADR-020 | Backups, restauración, RPO/RTO y continuidad | Antes de beta | Pendiente |

ADR-001, ADR-005, ADR-006 y ADR-007 están aceptados. Las Historias 1 a 6 de Fase 2, la validación
Android con segunda identidad y la validación manual Google-only están completadas; la matriz
`verify:full` está verde y Fase 2 está cerrada formalmente. Esto no amplía el alcance a
administración avanzada de integrantes, RLS ni historias financieras. El spike de RLS requerido por
ADR-006 permanece como gate previo a Fase 3. Los demás IDs son reservas de trabajo hasta que exista
contexto, alternativas y una decisión revisable.
