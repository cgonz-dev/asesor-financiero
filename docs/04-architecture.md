# Arquitectura inicial

## Estado

**Implementación parcial de Fase 1.** El bootstrap técnico, health contractual y cliente móvil mínimo ya existen. El resto de la tecnología y los límites descritos continúan como dirección inicial; las decisiones marcadas como ADR pendiente deben resolverse antes de que su fase dependa de ellas.

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
| Datos | PostgreSQL | Sistema transaccional principal |
| ORM/migraciones | Prisma | Migraciones inmutables una vez aplicadas |
| Contratos | Paquete compartido con schemas Zod y tipos inferidos | Zod 4.4.3 y `nestjs-zod` 5.5.0 validados en Fase 1 según [ADR-007](adr/0007-contratos-validacion-openapi-y-cliente.md) |
| Asistente | OpenAI Responses API | Tool calling y salidas estructuradas |
| Procesos programados | Redis + BullMQ | Solo al implementar recordatorios/jobs |
| Autenticación | Pendiente de ADR | Debe soportar móvil y hogares |
| Panel web | Fuera del MVP | Previsto posteriormente |
| Bancos/pagos | Fuera del MVP | Sin conexiones ni ejecución automática |

## Estructura inicial

La primera historia de Fase 1 creó la estructura base; los directorios futuros permanecen vacíos de lógica funcional hasta su fase:

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

Sin definir aún el esquema Prisma, se prevén:

- `user`, `household`, `household_member`, roles/permisos;
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
- `audit_event`.

Esta lista identifica conceptos, no tablas definitivas. Normalización, historización, claves, índices y retención necesitan diseño/ADR.

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

`cleanupOpenApiDoc` convierte el schema del adaptador a OpenAPI 3.1. El artefacto se serializa con claves ordenadas y `openapi:check` lo compara sin regenerarlo silenciosamente. El incremento implementa solo `GET /api/v1/health`; readiness se difiere hasta que exista una dependencia externa cuyo estado aporte una señal distinta.

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
- Tokens móviles en almacenamiento seguro del sistema.
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
| ADR-005 | Proveedor/flujo de autenticación y ciclo de tokens móvil | Fase 2 | Pendiente |
| ADR-006 | Autorización, roles, visibilidad y aislamiento/RLS | Fase 2 | Pendiente |
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

ADR-001 y ADR-007 están aceptados. Los demás IDs son reservas de trabajo hasta que exista contexto, alternativas y una decisión revisable.
