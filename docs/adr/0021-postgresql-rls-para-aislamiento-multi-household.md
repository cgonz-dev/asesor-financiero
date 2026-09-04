# ADR-021: PostgreSQL RLS para aislamiento multi-household

- Estado: Aceptado
- Fecha: 2026-09-02
- Aceptado el: 2026-09-03
- Responsables: Responsable del proyecto
- Fase/historia: Gate previo a Fase 3 — spike obligatorio de RLS
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

[ADR-006](0006-autorizacion-roles-visibilidad-y-aislamiento.md) establece que la aplicación decide
la autorización de negocio y exige evaluar PostgreSQL Row-Level Security antes de almacenar datos
financieros. El riesgo que se busca reducir es una consulta Prisma correcta en tipos pero
incorrectamente acotada, capaz de leer o modificar filas de otro `Household`.

El spike creó un schema desechable `rls_spike` con dos recursos ficticios no financieros. No
activó RLS en tablas vigentes ni modificó el schema Prisma o las migraciones de producción. La
prueba usó identidades y membresías reales del modelo actual, un cliente Prisma generado solo para
el harness y roles PostgreSQL reales distintos del administrador.

RLS no puede resolver propiedad, visibilidad `Private` / `SelectedMembers` / `Household`, roles de
producto ni permisos financieros. Es una defensa adicional para el límite `householdId`; las
policies de aplicación continúan siendo la autoridad de negocio.

## Modelo de amenazas y límite de confianza

El diseño protege frente a consultas tenant-scoped que omitan o manipulen el filtro de hogar,
estado residual del pool y escrituras que intenten cambiar `household_id`. No protege frente a:

- superusuarios, roles con `BYPASSRLS` o la conexión administrativa;
- migraciones, backups o soporte ejecutados con autoridad elevada;
- una policy RLS sobreamplia creada por el propietario de la tabla;
- permisos de objeto que RLS no gobierna, como `TRUNCATE` y `REFERENCES`;
- canales laterales de constraints globales;
- una decisión de autorización de negocio errónea antes de llegar a PostgreSQL.

El actor procede del `User` interno resuelto desde la identidad Auth0 verificada. El hogar procede
del request ya autenticado y autorizado; ningún ID enviado por el cliente constituye evidencia de
acceso.

## Restricciones y criterios

1. El runtime nunca será propietario, superusuario ni tendrá `BYPASSRLS`.
2. Todas las tablas tenant-scoped usarán `ENABLE` y `FORCE ROW LEVEL SECURITY`.
3. Sin actor u hogar válidos, el comportamiento será fail-closed.
4. Actor y hogar vivirán solo durante una transacción mediante `set_config(..., true)`.
5. Ningún repositorio tenant-scoped podrá volver al cliente Prisma raíz dentro del caso de uso.
6. Las relaciones cross-household se impedirán además con claves foráneas compuestas.
7. Unicidades semánticamente locales incluirán `household_id` para evitar enumeración indirecta.
8. Jobs, migraciones, soporte y backups tendrán identidades y procedimientos distintos.
9. La adopción requiere tests de catálogo y comportamiento; probar solo el camino feliz no basta.

## Opciones consideradas

### Solo autorización y filtros de aplicación

Mantiene menor complejidad operacional, pero una consulta sin filtro puede atravesar hogares. Las
constraints solo protegen parte de las escrituras y no las lecturas.

### Adoptar RLS como autoridad completa de autorización

Reduce lógica visible en aplicación, pero obliga a expresar permisos de producto complejos en SQL,
mezcla responsabilidades y crea falsa seguridad frente a owners, bypass y constraints.

### Adoptar RLS con restricciones como defensa en profundidad

La aplicación conserva la autorización de negocio. PostgreSQL valida además que toda fila
tenant-scoped pertenezca al hogar de la transacción y que el actor siga siendo un integrante
activo. Aumenta la disciplina de transacciones, roles, migraciones y operación, pero el spike
demostró compatibilidad con Prisma y los pools objetivo.

### No adoptar RLS

Evita el costo anterior, pero renuncia a una barrera independiente precisamente antes de
introducir datos financieros sensibles.

## Decisión aceptada

**ADOPT WITH CONSTRAINTS.**

La evidencia demuestra aislamiento, fail-closed, compatibilidad con Prisma y ausencia de fuga de
contexto tanto en el pool directo como en PgBouncer transaccional. La adopción no es segura si se
omite cualquiera de las restricciones de roles, transacción contextual, `FORCE RLS`, verificación
de policies o procedimientos operacionales descritos aquí. El seguimiento de concurrencia cerró
además la semántica de revocación con `READ COMMITTED` explícito y locking de membership para
escrituras.

La decisión fue aceptada explícitamente el 3 de septiembre de 2026. Esto desbloquea el gate de RLS
previo a Fase 3, pero no inicia Fase 3 ni autoriza por sí solo tablas financieras: los demás ADR y
gates financieros requeridos seguían pendientes en esa fecha. La aceptación de ADR-019 el
2026-09-04 cerró el último de ellos; Fase 3 continúa sin iniciar y requiere un execution plan
funcional autorizado según el [estado vigente](../project-state.md).

## Arquitectura propuesta

### Roles

- Un rol administrativo separado ejecuta bootstrap, migraciones y cleanup. Nunca sirve tráfico.
- Un owner `NOLOGIN`, sin superuser ni `BYPASSRLS`, posee schema, tablas y funciones. `FORCE RLS`
  también lo somete a las policies.
- El runtime API usa `LOGIN`, `NOINHERIT`, `NOBYPASSRLS` y solo los grants DML necesarios.
- Cada clase de job usa un rol separado, sin bypass y con grants por capacidad. El spike concedió
  únicamente lectura a su job ficticio.
- Soporte no recibe acceso tenant global ordinario. Cualquier break-glass futuro debe ser temporal,
  aprobado y auditado.

### Contexto y transacciones Prisma

La forma obligatoria futura distinguirá intención de lectura y escritura:

```ts
withRlsContext(
  prisma,
  { actorUserId, householdId },
  { intent: 'read' | 'write' },
  async (transaction) => {
    // Solo TransactionClient para operaciones tenant-scoped.
  },
);
```

El wrapper valida ambos UUID, abre una interactive transaction, aplica parámetros SQL con
`set_config(..., true)` y entrega solamente el `TransactionClient`. Las consultas de contexto y de
negocio deben ejecutarse en el mismo backend. Los repositorios reciben ese cliente; no abren otra
transacción ni usan `PrismaService` raíz. El isolation level se fija explícitamente en
`READ COMMITTED`; la intención `read` marca la transacción como read-only y la intención `write`
revalida y bloquea la membership activa antes de cualquier acceso tenant-scoped.

La policy compara la fila con el hogar transaccional y llama una función `SECURITY DEFINER`
endurecida, sin SQL dinámico, nombres completamente cualificados, `search_path` fijo y `EXECUTE`
revocado a `PUBLIC`. La función comprueba `User Active` y `HouseholdMembership Active` sin conceder
al runtime lectura directa de esas tablas.

### Revocación concurrente

La semántica adoptable queda definida en el commit de la transacción que cambia la membership a
`Suspended`, `Left` o `Removed`:

- `READ COMMITTED` toma un snapshot por statement. Un statement iniciado antes del commit conserva
  ese snapshot y se considera ordenado antes de la revocación; todo statement iniciado después
  reevalúa la policy y falla cerrado.
- `REPEATABLE READ` y `SERIALIZABLE` conservan el snapshot inicial y no sustituyen esta garantía.
  `SERIALIZABLE` puede abortar ciertos grafos, pero también puede ordenar la operación antes de la
  revocación; no se usará como mecanismo implícito de corte.
- Toda operación mutante o multi-statement adquiere mediante una función `SECURITY DEFINER`
  endurecida un lock `FOR SHARE` sobre la `HouseholdMembership Active` inmediatamente después del
  contexto y antes de leer o escribir recursos. `FOR KEY SHARE` no basta porque no bloquea un
  `UPDATE` que solo cambia `status`.
- Si la operación obtiene primero el lock, la actualización administrativa espera y su revocación
  queda ordenada después del commit o rollback de la operación. Si la actualización obtiene
  primero el lock, la operación espera, reevalúa la fila actualizada y se deniega.
- Revalidar sin lock deja una ventana TOCTOU y una constraint estática no puede expresar el estado
  activo concurrente; ninguna de las dos opciones reemplaza el lock.
- Las transacciones deben ser cortas y acotadas. Red, IA, espera de usuario y cálculo prolongado
  ocurren antes de abrirlas; dentro solo viven contexto, lock, validación, DML y auditoría. Timeout,
  rollback y commit liberan el lock.

El owner de la función de lock es un rol `NOLOGIN` dedicado, sin `BYPASSRLS`. Solo recibe la lectura
y el privilegio de columna mínimo que PostgreSQL exige para `FOR SHARE`; el runtime recibe
`EXECUTE`, pero no acceso directo a `app_user` ni `household_membership`.

### Pooling

`set_config(..., true)` limita el contexto a la transacción. Esto funcionó con el pool `pg` usado
por `@prisma/adapter-pg` y con PgBouncer 1.25.2 en `pool_mode=transaction`, incluso forzando una
sola conexión servidor y la secuencia hogar A → sin contexto → hogar B. No se permiten variables
de sesión persistentes ni operaciones tenant-scoped fuera del wrapper.

PgBouncer debe conservar soporte de prepared statements compatible con Prisma y permanecer en
modo transaccional. Un cambio de pooler, adapter o estrategia de conexión obliga a repetir el gate.

### Constraints y errores

Las FKs compuestas incluirán `household_id` en padre e hijo. Las claves únicas locales al tenant
también comenzarán por `household_id`. PostgreSQL comprueba unicidad e integridad referencial fuera
de RLS, por lo que una constraint global puede revelar la existencia de una fila invisible. Los
errores públicos seguirán siendo opacos y no enumerables.

### Migraciones, jobs y operación

- Prisma seguirá modelando entidades y migraciones; SQL revisado creará roles, grants, functions,
  policies, `FORCE RLS` e invariantes que Prisma no represente.
- La migración se ejecutará con autoridad administrativa y después un gate de catálogo comprobará
  owner, flags RLS, policies, comandos, roles y grants exactos.
- Los jobs deberán recibir un hogar explícito y usar una transacción contextual. No habrá un rol de
  job con bypass global por conveniencia.
- Backups/restores usarán el rol operacional previsto y `row_security=off` para fallar si una
  policy intentara omitir filas; la restauración requerirá una prueba independiente antes de beta.
- Consultas de soporte global, si llegan a existir, usarán un flujo break-glass separado y
  auditado, nunca el runtime.

## Evidencia del spike

Versiones verificadas:

- PostgreSQL server 18.4 (`postgres:18.4`);
- Prisma CLI, `@prisma/client` y `@prisma/adapter-pg` 7.9.1;
- `pg` 8.23.0;
- PgBouncer 1.25.2 compilado desde el tag oficial y configurado con
  `pool_mode=transaction`, `max_db_connections=1` y `max_prepared_statements=200`.

| Área | Resultado |
|---|---|
| Instalación, owners, flags, policies, funciones y grants | PASS |
| Runtime/job sin owner, superuser ni `BYPASSRLS` | PASS |
| Fail-closed sin contexto, parcial o malformado | PASS |
| Aislamiento SELECT/INSERT/UPDATE/DELETE entre hogares | PASS |
| Revocación por User o membership no activa | PASS |
| Revocación concurrente por statement para Suspended/Left/Removed | PASS |
| Carrera intra-statement reproducida y cerrada con `FOR SHARE` | PASS |
| Orden operación/revocación, rollback y timeout | PASS |
| `USING`, `WITH CHECK` y FK compuesta | PASS |
| CRUD Prisma, nested writes y rollback atómico | PASS |
| Cliente raíz sin herencia de contexto | PASS |
| Pool directo `max=1`, `max=2` y concurrencia | PASS |
| PgBouncer transaccional y reutilización de backend | PASS |
| Job sin hogar y con hogar explícito | PASS |
| Owner forzado y admin como control negativo | PASS |
| Detección de RLS deshabilitado/policy ausente o sobreamplia | PASS |
| Canal lateral de unicidad global | PASS, riesgo demostrado |
| Índice tenant-leading en `EXPLAIN` representativo | PASS |

Comandos enfocados finales: `pnpm test:rls:direct` aprobó 26/26 y
`pnpm test:rls:pooler` aprobó 9/9. El harness elimina schema, roles, contenedores y volúmenes en
`finally`; sus contraseñas se generan en memoria y no se registran.

## Consecuencias

### Positivas

- Una consulta tenant-scoped defectuosa queda limitada por PostgreSQL.
- El contexto no sobrevive a commit, rollback ni reasignación del pool.
- App, jobs y administración tienen capacidades físicamente separadas.
- La estrategia es reproducible en CI con PostgreSQL y PgBouncer reales.

### Negativas y riesgos residuales

- Cada caso de uso tenant-scoped consume una interactive transaction, con costo de pool y mayor
  disciplina en repositorios.
- Una migración o grant incorrecto puede desactivar la barrera; los tests de catálogo son gate
  obligatorio.
- Las lecturas ya iniciadas conservan su snapshot anterior. La revocación impide statements nuevos,
  pero no cancela retroactivamente un statement en ejecución; esta frontera queda explícita y las
  operaciones largas deben dividirse y revalidarse.
- El lock de escritura puede retrasar una revocación mientras termina una transacción válida. El
  riesgo se acota prohibiendo trabajo externo o prolongado dentro de la transacción y usando
  timeouts; la espera y los abortos deberán observarse operacionalmente.
- El `EXPLAIN` del spike valida forma estructural, no capacidad ni latencia de producción; habrá que
  medir con cardinalidad financiera representativa.
- Admin, backups y break-glass siguen siendo límites privilegiados que necesitan controles fuera de
  RLS.
- Constraints globales pueden crear canales laterales aunque la fila permanezca invisible.

## Plan de adopción y rollback

1. **Completado:** aceptar este ADR con la evidencia de concurrencia completa antes de Fase 3.
2. Diseñar las primeras tablas financieras con `household_id`, FKs compuestas e índices
   tenant-leading desde su primera migración.
3. Crear roles/policies/functions en SQL nuevo y verificable; nunca reescribir migraciones
   aplicadas.
4. Introducir el wrapper transaccional con intención `read`/`write`, `READ COMMITTED` explícito y
   lock de membership para escrituras; hacer que repositorios tenant-scoped requieran
   `TransactionClient`.
5. Ejecutar la suite de aislamiento directa y con el pooler real en CI.
6. Desplegar primero sin tráfico, validar catálogo con el runtime real y habilitar gradualmente.

El rollback no borra datos: detiene tráfico, revoca el runtime afectado y vuelve temporalmente a
consultas de aplicación explícitamente acotadas mientras se corrige o retira la policy mediante una
migración posterior. Nunca se concede `BYPASSRLS` al runtime como mitigación.

## Referencias

- [ADR-006](0006-autorizacion-roles-visibilidad-y-aislamiento.md)
- [Seguridad y privacidad](../07-security-and-privacy.md)
- [PostgreSQL 18 — Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [PostgreSQL 18 — `set_config`](https://www.postgresql.org/docs/18/functions-admin.html)
- [Prisma — Transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
- [Prisma 7 — Connection pool](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections/connection-pool)
- [PgBouncer — Configuration](https://www.pgbouncer.org/config.html)
- [Execution plan y evidencia](../exec-plans/completed/pre-phase-3-postgresql-rls-spike.md)
- [Evidencia de revocación concurrente](../exec-plans/completed/pre-phase-3-rls-membership-revocation.md)
