# Roadmap

## Cómo usar este roadmap

Este documento define el orden de entrega, no una invitación a desarrollar todas las fases simultáneamente.

Reglas:

1. Solo una fase —y preferentemente una historia— se trabaja por tarea.
2. Una fase no inicia si depende de criterios incumplidos de otra.
3. Las decisiones bloqueantes se resuelven mediante ADR antes de implementar.
4. Cada cierre aporta evidencia conforme a [`08-definition-of-done.md`](08-definition-of-done.md).
5. Cambiar alcance, orden o criterios exige actualizar este documento.
6. “Fuera” significa fuera de esa fase, aunque la capacidad aparezca después.

## Resumen

| Fase | Resultado principal |
|---:|---|
| 0 | Visión, dominio, arquitectura, riesgos y decisiones preparados |
| 1 | Monorepo reproducible con calidad base |
| 2 | Identidad, hogares, integrantes y aislamiento |
| 3 | Cuentas y ledger exacto, auditable e idempotente |
| 4 | Ingresos, gastos, transferencias y categorías |
| 5 | App móvil con registro manual |
| 6 | Asistente conversacional controlado por tools |
| 7 | Tarjetas, deudas y compras a meses |
| 8 | Recurrentes, tandas y recordatorios |
| 9 | Conciliación y diferencias de efectivo |
| 10 | Presupuestos y reglas configurables |
| 11 | Panel móvil, proyecciones y escenarios |
| 12 | Hardening, observabilidad y beta privada |

---

## Fase 0. Descubrimiento, documentación y decisiones de arquitectura

### Objetivo

Crear una base compartida que haga explícitas la visión, las invariantes financieras, el alcance, la arquitectura, la seguridad, la calidad y las decisiones abiertas.

### Alcance

- Documentación fundacional.
- Vocabulario inicial y ejemplos de ledger.
- Alcance del MVP y no objetivos.
- Arquitectura propuesta y límites.
- Inventario de ADR con fase límite.
- Roadmap y Definition of Done.

### Historias principales

- Como equipo, quiero una fuente de verdad documental para no inventar reglas.
- Como responsable de producto, quiero separar MVP y futuro para controlar alcance.
- Como responsable técnico, quiero conocer decisiones bloqueantes antes del bootstrap.
- Como responsable financiero, quiero invariantes y ejemplos revisables antes del modelo.

### Dependencias

Ninguna técnica. Requiere revisión posterior con usuarios piloto y personas responsables de producto, seguridad y dominio financiero.

### Criterios de aceptación

- Existen y se enlazan todos los documentos definidos en [`00-index.md`](00-index.md).
- Las 20 reglas financieras innegociables están en `AGENTS.md` y en dominio.
- La propuesta tecnológica distingue decisiones iniciales de ADR pendientes.
- El ledger, la separación entre cuentas/categorías y los compromisos están explicados con ejemplos.
- Cada fase del roadmap contiene las nueve secciones obligatorias.
- No se ha creado código de aplicación ni instalado dependencias.

### Pruebas requeridas

- Revisión de enlaces y estructura Markdown.
- Búsqueda de contradicciones de alcance y términos.
- Verificación de cobertura contra el encargo inicial.
- Revisión conceptual de ledger y seguridad antes de aceptar ADR relacionados.

### Riesgos

- Convertir ejemplos conceptuales en decisiones técnicas accidentales.
- Subestimar complejidad de tandas, disponibilidad y privacidad en pareja.
- Documentar demasiado sin validación de usuarios.

### Entregables

`AGENTS.md`, `README.md`, `docs/00-index.md` a `docs/08-definition-of-done.md` y `docs/adr/README.md`.

### Fuera de esta fase

Código, dependencias, scaffolding, base de datos, prototipos ejecutables, proveedores, infraestructura y ADR aceptados sin revisión.

---

## Fase 1. Bootstrap del monorepo y calidad base

### Objetivo

Crear un workspace reproducible que permita desarrollar aplicaciones y paquetes con controles de calidad uniformes, sin implementar aún funcionalidades financieras.

### Estado de cierre

**Cerrada.** La evidencia de cierre incluye:

- monorepo pnpm con lockfile reproducible, Node 24 y pnpm 11.9.0;
- `apps/api`, `apps/mobile` y paquetes compartidos de contratos, dominio, configuración, lint y TypeScript;
- API NestJS y shell Expo mínimos, `GET /api/v1/health`, contrato compartido, cliente REST tipado y OpenAPI 3.1 reproducible;
- scripts de lint, formato, typecheck, pruebas generales/unitarias/integración/E2E, build, OpenAPI y compatibilidad de peers;
- CI de GitHub Actions con instalación congelada, detección de OpenAPI desactualizado y ejecución remota confirmada en verde;
- configuración de entorno sin secretos y modo de desarrollo LAN con CORS de allowlist explícita;
- validación local de todos los controles anteriores durante el cierre de fase.

Al cerrar Fase 1 no se habían introducido autenticación, hogares, integrantes, base de datos,
Prisma, ledger, funcionalidad financiera ni IA. ADR-005 y ADR-006 quedaron aceptados; el inicio
posterior de Fase 2 se registra en su propia sección.

### Alcance

- pnpm workspaces y estructura validada.
- TypeScript base.
- paquetes de configuración de TypeScript y lint.
- formateo, runner de pruebas y scripts estándar.
- esqueletos mínimos de `apps/mobile` y `apps/api`, sin negocio.
- contratos base y generación/documentación OpenAPI según ADR.
- CI inicial y `.env.example`.

### Historias principales

- Como desarrollador, quiero instalar y ejecutar controles con comandos uniformes.
- Como mantenedor, quiero límites de dependencias claros entre paquetes.
- Como equipo, quiero detectar lint, tipos, pruebas o build rotos antes de integrar.

### Dependencias

- Fase 0 aceptada.
- ADR-001 de vocabulario y ADR-007 de contratos/herramientas.
- Versiones concretas de runtime y gestor documentadas.

### Criterios de aceptación

- Un checkout limpio puede instalarse y ejecutar scripts documentados.
- Existen `lint`, `format`, `typecheck`, `test`, `test:unit`, `test:integration`, `test:e2e` y `build`, aunque algunos no tengan casos todavía.
- Las aplicaciones arrancan con health/shell mínimo sin lógica financiera.
- Las reglas de dependencias evitan que dominio dependa de frameworks.
- CI ejecuta los controles base.
- No hay secretos ni credenciales.

### Pruebas requeridas

- Instalación reproducible con lockfile.
- Lint, format check, typecheck, prueba mínima y build.
- Validación de workspace y grafo de paquetes.
- Escaneo básico de secretos/dependencias según herramienta elegida.

### Riesgos

- Sobrecargar el bootstrap con tooling.
- Incompatibilidad entre Expo, NestJS, TypeScript o pnpm.
- Duplicar esquemas entre OpenAPI y contratos.

### Entregables

Monorepo funcional, configuraciones compartidas, scripts, CI, guía de desarrollo y ADR aplicables.

### Fuera de esta fase

Autenticación real, tablas financieras, ledger, pantallas de producto, IA y despliegue productivo.

---

## Fase 2. Autenticación, hogares e integrantes

### Estado

**Iniciada el 14 de agosto de 2026; no cerrada.** Las Historias 1 y 2 están completadas. Existen la
persistencia e identidad base, el núcleo de Household/Membership y la autenticación Auth0 validada
en Android. Invitaciones, autorización Household HTTP, recursos financieros y RLS no se han
iniciado. El siguiente trabajo secuencial es Historia 3.

### Evidencia de Historia 1

- PostgreSQL y Prisma 7.9.1 con migración inicial versionada.
- `User` y `ExternalIdentity`, únicos por `issuer + subject` y sin auto-link por correo.
- `Household` y `HouseholdMembership` con Owner/Member y estados aprobados.
- creación transaccional de Household con un Owner Active inicial e índice parcial que impide dos
  Owner activos;
- casos de uso internos sin endpoints públicos de identidad u hogares;
- `health` separado de `readiness`, contrato Zod compartido y OpenAPI actualizado;
- pruebas unitarias, integración PostgreSQL, E2E y límites arquitectónicos;
- CI preparada con PostgreSQL 18.4 efímero y aplicación de migraciones versionadas.

### Evidencia de Historia 2 — completada el 25 de agosto de 2026

- Native Application pública preparada con `react-native-auth0`, Universal Login, Authorization
  Code + PKCE y audience propia; no existe client secret móvil ni flujo implícito/password grant;
- coordinador móvil con estados de restauración/autenticación, token en memoria, Credentials
  Manager sobre Keychain/Keystore, renovación single-flight, un reintento máximo tras `401`,
  cancelación y logout local inmediato con revocación remota best effort;
- guard NestJS que valida Bearer, RS256, issuer/audience exactos, expiración/activación, `sub` y JWKS
  con caché, timeout, cooldown y rotación controlada;
- `issuer + subject` verificados resuelven el `User` interno; email, `userId`, `householdId`, roles y
  Organizations de Auth0 no autentican ni autorizan;
- `GET /api/v1/me` devuelve únicamente UUID opaco y estado; health/readiness continúan públicos;
- schemas Zod compartidos, errores 401 estables, Bearer scheme y OpenAPI 3.1 regenerado;
- pruebas unitarias, integración y E2E con claves/JWKS sintéticos, sin tenant ni secretos en CI;
- tenant exclusivo de desarrollo, Native Application pública, API RS256, audience, callbacks,
  Offline Access, Refresh Token Rotation y User-Delegated Access validados;
- accesos reales por Google y Database Connection, `/me`, restauración, logout, reapertura sin
  restaurar la sesión cerrada y relogin validados en un development build Android;
- política inicial de desarrollo/MVP: access token de 10 minutos, inactividad de refresh de 7 días,
  máximo de 30 días y overlap de rotación de 3 segundos, revisable y no duplicada en código;
- matriz local final: 100 pruebas, migración versionada al día, health/readiness, build y OpenAPI en
  verde. Historia 3 no se inició durante este cierre.

### Objetivo

Establecer identidad, aislamiento por hogar y permisos antes de almacenar finanzas.

### Alcance

- Registro/inicio de sesión según ADR.
- Ciclo seguro de sesión móvil.
- Crear hogar e invitar/unir integrante.
- Membresías, roles básicos y estados.
- Políticas de recursos personales/compartidos.
- middleware/guards de autorización y auditoría básica.

### Historias principales

- Como sistema, quiero mapear una identidad externa ya verificada a un User interno y persistir el
  núcleo aislado de hogares antes de exponer autenticación real. **Implementada en Historia 1.**
- Como usuario móvil, quiero iniciar/cerrar/restaurar una sesión Auth0 y consultar mi identidad
  interna mediante una API que valide el access token. **Completada en Historia 2.**
- Como usuario, quiero crear un hogar individual.
- Como usuario, quiero invitar a mi pareja con control explícito.
- Como integrante, quiero que mis recursos personales respeten visibilidad.
- Como sistema, quiero rechazar todo acceso cruzado entre hogares.

### Dependencias

- Fase 1.
- ADR-005 de autenticación y ADR-006 de autorización/aislamiento.
- Política inicial de datos y tokens.

### Criterios de aceptación

- La identidad no se deriva de IDs enviados libremente por cliente.
- Un usuario solo ve hogares/membresías autorizados.
- Se valida propiedad y `household_id` en servidor.
- Roles y visibilidad tienen una matriz documentada.
- Invitaciones expiran/se revocan según reglas.
- Acciones sensibles generan auditoría.

### Pruebas requeridas

- Unitarias de políticas.
- Integración de sesión, membresía, invitación y revocación.
- E2E de hogar individual y pareja.
- Pruebas negativas de IDOR, enumeración y acceso cruzado.
- Pruebas de almacenamiento/renovación/revocación de tokens.

### Riesgos

- Confiar en filtros del cliente.
- Hacer visibles cuentas personales por pertenecer al hogar.
- Elegir un proveedor que complique móvil o exportación.

### Entregables

Módulo de identidad/hogares, contratos, esquema/migraciones, pruebas, matriz de acceso y ADR.

### Fuera de esta fase

Cuentas con saldo, transacciones, categorías, IA, permisos avanzados y administración empresarial.

---

## Fase 3. Cuentas y ledger financiero

### Objetivo

Construir la fuente de verdad financiera exacta, balanceada, reconstruible, auditable e idempotente.

### Alcance

- Tipos de cuenta fundamentales.
- Encabezado de transacción y entradas.
- dinero/moneda como valores exactos.
- motor de balance y saldos históricos.
- borrador técnico, preview, confirmación y correcciones base.
- idempotencia, concurrencia y transacciones de DB.
- auditoría financiera.

### Historias principales

- Como usuario, quiero crear cuentas personales/compartidas con tipo y visibilidad.
- Como sistema, quiero rechazar transacciones desbalanceadas.
- Como usuario, quiero ver un saldo explicado por sus entradas.
- Como usuario, quiero corregir sin borrar historial.
- Como cliente reintentable, quiero evitar duplicados.

### Dependencias

- Fase 2.
- ADR-002, ADR-003, ADR-004, ADR-008 y ADR-009.
- Baseline de auditoría/redacción de ADR-019.

### Criterios de aceptación

- No existe `float` en contratos, dominio ni persistencia monetaria.
- Toda transacción confirmada balancea por moneda.
- Las entradas confirmadas son inmutables.
- Saldos actuales e históricos se reconstruyen.
- Misma clave/misma intención no duplica; misma clave/intención distinta da conflicto.
- Una falla intermedia no deja encabezado, entradas o auditoría parciales.
- Cuentas y entradas respetan hogar, propiedad y permisos.

### Pruebas requeridas

- Unitarias de dinero, balance, signos, estados y correcciones.
- Property-based o generativas para balance y reconstrucción.
- Integración con constraints, rollback e idempotencia.
- Concurrencia y reintentos.
- Seguridad multi-hogar.
- Rendimiento basal con volumen representativo.

### Riesgos

- Convención de signos incoherente.
- Saldos cacheados que diverjan.
- Race conditions y claves idempotentes mal acotadas.
- Modelar categorías como cuentas.

### Entregables

Paquete de dominio financiero, esquema/migraciones, servicios de aplicación, endpoints/contratos base, auditoría, pruebas y ADR.

### Fuera de esta fase

Flujos completos de gasto/ingreso, UI móvil de producto, tarjetas avanzadas, presupuestos, IA y jobs.

---

## Fase 4. Ingresos, gastos, transferencias y categorías

### Objetivo

Exponer operaciones financieras cotidianas sobre el ledger sin violar su semántica.

### Alcance

- Ingreso y gasto.
- Transferencia entre banco, efectivo, apartados y vales compatibles.
- propiedad personal/compartida y atribución de integrante.
- categorías, división y reclasificación.
- reembolsos básicos.
- borrador, preview y confirmación a nivel de caso de uso.

### Historias principales

- Registrar nómina, ingreso variable, bono y vales por separado.
- Registrar gasto personal o compartido.
- Retirar efectivo sin crear gasto.
- Apartar y liberar dinero.
- Dividir un gasto entre categorías.
- Corregir gasolina a despensa con auditoría.

### Dependencias

- Fase 3.
- ADR-010 de categorías y ADR-011 de borradores/previews.

### Criterios de aceptación

- Transferencias no aparecen como gasto o ingreso.
- La cuenta origen nunca se asume silenciosamente.
- Categorías no alteran el balance.
- Divisiones suman exactamente al total y asignan residuos de forma determinista.
- Bonos pueden marcarse no sostenibles.
- Reembolsos enlazan el movimiento original cuando existe.
- Toda operación pasa por preview, confirmación, idempotencia y auditoría.

### Pruebas requeridas

- Unitarias por tipo de operación y división.
- Integración de entradas esperadas.
- Contratos y errores de ambigüedad.
- E2E API de nómina, gasolina, retiro, apartado, vales, split y corrección.
- Pruebas de redondeo e intentos cruzados entre hogares.

### Riesgos

- Doble contabilización al mover dinero.
- Clasificar automáticamente de forma incorrecta.
- Cambiar una reclasificación analítica mediante reversión innecesaria o sin auditoría.

### Entregables

Casos de uso/endpoints, contratos, categorías iniciales configurables, documentación y suite de operaciones básicas.

### Fuera de esta fase

Aplicación móvil completa, IA, tarjetas/deudas, tandas, conciliación y presupuestos.

---

## Fase 5. Aplicación móvil y registro manual

### Objetivo

Ofrecer una aplicación móvil utilizable que cubra manualmente los flujos básicos antes de introducir IA.

### Alcance

- Navegación Expo Router.
- autenticación y selección de hogar.
- lista/detalle de cuentas, saldos y movimientos.
- formularios de ingreso, gasto, transferencia, apartado y corrección.
- preview/confirmación.
- estados de carga, vacío, error y reintento seguro.
- accesibilidad y almacenamiento seguro de sesión.

### Historias principales

- Como integrante, quiero saber qué saldo y hogar estoy viendo.
- Como usuario, quiero registrar y revisar operaciones manualmente.
- Como usuario, quiero ver el impacto antes de confirmar.
- Como usuario, quiero entender por qué una operación falló.

### Dependencias

- Fases 2 a 4.
- Sistema visual y navegación mínima.
- Contratos/clientes estables para flujos base.

### Criterios de aceptación

- Los flujos críticos funcionan sin IA.
- La UI distingue personal/compartido, disponible/restringido y borrador/confirmado.
- Un doble toque o reintento no duplica.
- La vista previa muestra importe, moneda, fecha, cuentas, propietario, alcance, categoría y efecto.
- Tokens no se guardan en almacenamiento inseguro.
- Accesibilidad básica verificada en plataformas objetivo.

### Pruebas requeridas

- Unitarias de presentación.
- Integración del cliente y manejo de errores.
- E2E móvil de registro/confirmación/corrección.
- Accesibilidad y snapshots visuales selectivos.
- Pruebas de conectividad interrumpida sin prometer offline.

### Riesgos

- Duplicar reglas financieras en la UI.
- Ocultar el contexto de cuenta/hogar.
- Confirmaciones accidentales.
- Divergencia entre contrato y cliente.

### Entregables

App móvil de registro manual, componentes, analítica mínima no sensible, pruebas y documentación de UX.

### Fuera de esta fase

Chat con IA, sincronización offline completa, notificaciones programadas, tarjetas avanzadas y panel web.

---

## Fase 6. Asistente conversacional con herramientas controladas

### Objetivo

Agregar conversación como interfaz segura sobre los mismos casos de uso validados, sin convertir al modelo en fuente de verdad.

### Alcance

- OpenAI Responses API.
- orquestador backend.
- catálogo inicial de tools de lectura y borradores.
- salidas estructuradas.
- manejo de ambigüedad y preguntas mínimas.
- preview/confirmación fuera de la decisión libre del modelo.
- correlación, redacción, límites y evaluaciones.

### Historias principales

- Registrar nómina o gasto desde lenguaje natural.
- Preguntar cuenta origen solo si es necesaria.
- Corregir, dividir o atribuir un movimiento.
- Consultar disponible y próximos pagos desde tools.
- Explicar una propuesta sin inventar datos.

### Dependencias

- Fase 5 y casos de uso maduros.
- ADR-012.
- Contratos de tools, política de datos, costos y evaluaciones.

### Criterios de aceptación

- La IA no accede a base de datos ni modifica saldos directamente.
- Todo argumento de tool se valida como no confiable.
- Ningún borrador ambiguo puede confirmarse.
- Toda escritura requiere preview y confirmación explícita vinculada.
- Reintentos de modelo/tool no duplican.
- Consultas de saldo citan datos del backend y fecha de corte.
- Existe un conjunto de evaluación versionado para casos felices, ambiguos y adversariales.

### Pruebas requeridas

- Unitarias del orquestador y validación.
- Contratos de tools.
- Integración con proveedor simulado y respuestas inválidas/timeouts.
- Evaluaciones de selección de tool, extracción, no invención y aclaración.
- E2E conversación → preview → confirmación.
- Pruebas de prompt injection, fuga entre hogares y redacción.

### Riesgos

- Alucinación o tool equivocada.
- Datos sensibles enviados de más.
- Cambios de comportamiento del modelo.
- Costos, latencia y reintentos.
- Confundir conversación con registro.

### Entregables

Orquestador, tools iniciales, política de prompts/modelos, evaluaciones, telemetría segura y experiencia de chat.

### Fuera de esta fase

Pagos reales, autonomía sin confirmación, entrenamiento con datos privados, asesoría garantizada y tools de módulos no construidos.

---

## Fase 7. Deudas, tarjetas y compras a meses

### Objetivo

Modelar pasivos y compras financiadas sin duplicar gasto ni ocultar compromisos.

### Alcance

- Tarjetas y deudas.
- compra con tarjeta.
- pago total/parcial.
- intereses, comisiones y cargos.
- compra a MSI/con intereses.
- calendario y compromisos.
- reembolsos, cancelaciones y pago anticipado.
- tools y UI correspondientes.

### Historias principales

- Registrar compra y aumentar deuda.
- Pagar tarjeta sin crear gasto.
- Crear 12 cuotas desde una compra de MXN 12,000.
- Separar capital, intereses y comisiones.
- Saber deuda actual y pagos próximos.

### Dependencias

- Fases 4 a 6.
- ADR-013.
- Fechas/periodos ya definidos.

### Criterios de aceptación

- Una compra a meses se contabiliza una sola vez.
- Cuotas futuras no alteran saldo realizado.
- Pagos reducen activo y pasivo; cargos se separan.
- Pagos parciales asignan importes determinísticamente.
- Calendario cuadra exactamente con principal/cargos.
- Correcciones y cancelaciones conservan historial.

### Pruebas requeridas

- Unitarias de calendarios, redondeo y asignación.
- Property-based para suma de cuotas.
- Integración de compra/pago/reembolso/cancelación.
- E2E móvil y conversacional.
- Casos de fechas límite, pago anticipado, mora y concurrencia.

### Riesgos

- Doble gasto.
- Redondeos acumulados.
- Confundir saldo de corte, deuda actual y pago para no generar intereses.
- Complejidad por reglas de emisores.

### Entregables

Dominio, migraciones, API, UI, tools, pruebas y documentación de tarjetas/deudas/MSI.

### Fuera de esta fase

Conexión con emisores, pagos bancarios, score crediticio y optimización financiera garantizada.

---

## Fase 8. Pagos recurrentes, tandas y recordatorios

### Objetivo

Representar obligaciones repetidas y tandas, y avisar oportunamente sin modificar saldos automáticamente.

### Alcance

- Plantillas y ocurrencias recurrentes.
- renta, servicios, seguros y otros pagos.
- tandas semanales/quincenales.
- aportaciones, turnos, recepción y pendientes.
- recordatorios y jobs con Redis/BullMQ.
- notificaciones según permisos.

### Historias principales

- Crear renta mensual sin registrar gasto antes del pago.
- Recibir recordatorio de seguro anual.
- Marcar una obligación pagada enlazando un movimiento.
- Registrar aportación/recepción de tanda y consultar pendientes.

### Dependencias

- Fases 6 y 7.
- ADR-014.
- Infraestructura de jobs, zonas horarias y notificaciones.

### Criterios de aceptación

- Crear un recordatorio no cambia saldos.
- Materializar una ocurrencia no duplica la obligación.
- Marcar pagado enlaza un movimiento existente o crea un preview; nunca auto-confirma.
- Jobs y notificaciones son idempotentes y toleran reintentos.
- La tanda distingue realizado, pendiente, recibido y aún no disponible.
- Zona horaria y cambios de calendario son deterministas.

### Pruebas requeridas

- Unitarias de recurrencias y tanda.
- Integración de jobs, reintentos y dead-letter.
- Pruebas con reloj controlado y zonas horarias.
- E2E de obligación → aviso → pago.
- Recuperación tras caída y deduplicación.

### Riesgos

- Jobs duplicados.
- Fechas incorrectas.
- Notificaciones con datos sensibles.
- Semántica contable incorrecta de tanda.

### Entregables

Módulos de obligaciones/tandas, workers, notificaciones, tools/UI, runbooks y pruebas.

### Fuera de esta fase

Débitos automáticos, pagos reales, calendario externo y optimización autónoma de pagos.

---

## Fase 9. Conciliación de cuentas y efectivo faltante

### Objetivo

Permitir comparar el ledger con la realidad, reconocer diferencias inmediatamente y resolverlas sin inventar ni borrar historia.

### Alcance

- Snapshots de saldo/conteo.
- sesiones de conciliación.
- comparación por fecha de corte.
- diferencias pendientes.
- ajustes y resolución enlazada.
- flujos manuales y conversacionales.

### Historias principales

- Conciliar efectivo contado contra esperado.
- Registrar MXN 430 faltantes con categoría pendiente.
- Resolver después la causa.
- Conciliar una cuenta sin reemplazar el ledger por un snapshot.

### Dependencias

- Fases 3 a 6; integración con tarjetas de Fase 7 cuando aplique.
- ADR-015.

### Criterios de aceptación

- Un snapshot no modifica el saldo.
- Una diferencia confirmada sí ajusta el disponible.
- La IA no asigna una causa no confirmada.
- La resolución conserva snapshot, diferencia, actor y movimientos relacionados.
- La conciliación usa el mismo instante/criterio para observado y ledger.
- Puede reconstruirse el estado antes y después del ajuste.

### Pruebas requeridas

- Unitarias de comparación y estados.
- Integración de snapshot, ajuste, resolución y reversión.
- E2E de efectivo faltante y sobrante.
- Fechas históricas, operaciones tardías y concurrencia.
- Evaluación de IA para no inventar causas.

### Riesgos

- Usar snapshot como saldo autoritativo.
- Duplicar ajustes.
- Ocultar dinero faltante hasta conocer categoría.
- Confusión por fechas efectivas.

### Entregables

Módulo de conciliación, API/UI/tools, auditoría, pruebas y guía de resolución.

### Fuera de esta fase

Importación automática de estados bancarios, matching por ML y conciliación contable empresarial.

---

## Fase 10. Presupuestos y reglas configurables

### Objetivo

Convertir saldos e ingresos en planes explicables para personas y hogares sin confundir propuestas con movimientos.

### Alcance

- 50/30/20 y porcentajes configurables.
- presupuestos por categoría, integrante, hogar y periodo.
- reparto 50/50, proporcional y manual.
- ingreso sostenible y bonos.
- dinero personal libre.
- metas y fondo de emergencia.
- actual, restringido, comprometido y disponible.

### Historias principales

- Distribuir nómina con 50/30/20.
- Calcular aportación quincenal de cada integrante.
- Excluir bono temporal de obligaciones recurrentes.
- Consultar presupuesto restante y metas.

### Dependencias

- Fases 7 a 9 para datos completos.
- ADR-016.
- Definición revisada de métricas y periodos.

### Criterios de aceptación

- Las asignaciones suman exactamente la base.
- Redondeos y residuos son deterministas y visibles.
- Las reglas no mueven dinero sin operación confirmada.
- Cada cifra explica fuente, periodo, exclusiones y fórmula.
- Personal/compartido y permisos se respetan.
- Bonos no elevan ingreso sostenible sin configuración.

### Pruebas requeridas

- Unitarias y property-based de porcentajes, reparto y redondeo.
- Integración con saldos/compromisos.
- E2E de 50/30/20, 50/50, proporcional y manual.
- Pruebas de periodos, cambios de regla y privacidad.

### Riesgos

- Doble descontar apartados y compromisos.
- Presentar proyección como garantía.
- Fórmulas poco transparentes.
- Reparto percibido como injusto.

### Entregables

Motor de presupuestos, API/UI/tools, explicaciones, pruebas y documentación de fórmulas.

### Fuera de esta fase

Asesoría profesional, optimización de inversiones, automatización de transferencias y reglas fiscales.

---

## Fase 11. Panel financiero, proyecciones y escenarios

### Objetivo

Presentar una visión móvil comprensible del estado y permitir escenarios reversibles basados en datos.

### Alcance

- Panel móvil consolidado.
- saldos actual, restringido, comprometido, disponible y proyectado.
- patrimonio neto.
- próximos pagos y tendencias.
- simulación de compra.
- escenarios de ingreso/gasto y explicación de impacto.

### Historias principales

- Saber cuánto dinero está realmente disponible y por qué.
- Ver próximos pagos y riesgo de insuficiencia.
- Simular “¿podemos comprar un sillón este mes?”.
- Comparar escenarios sin crear movimientos.

### Dependencias

- Fases 7 a 10.
- Métricas y fórmulas estabilizadas.
- Datos piloto suficientes para validar comprensión.

### Criterios de aceptación

- Cada cifra tiene fecha de corte y desglose trazable.
- Escenarios están etiquetados como hipótesis y no alteran ledger.
- Patrimonio excluye/incluye beneficios conforme a política explícita.
- La UI no mezcla saldo bancario con disponible.
- Resultados respetan visibilidad personal/compartida.

### Pruebas requeridas

- Unitarias de agregación/proyección.
- Integración con ledger, compromisos y presupuestos.
- E2E de panel y simulación.
- Pruebas de usabilidad/comprensión con piloto.
- Rendimiento y accesibilidad de visualizaciones.

### Riesgos

- Falsa precisión.
- Consultas costosas o agregados divergentes.
- Exposición de datos personales en panel compartido.
- Escenarios interpretados como asesoría garantizada.

### Entregables

Panel móvil, endpoints de consulta, motor de escenarios, tools, pruebas y definiciones de métricas.

### Fuera de esta fase

Panel web, predicción de mercado, recomendaciones garantizadas e inversión automatizada.

---

## Fase 12. Seguridad, observabilidad y beta privada

### Objetivo

Endurecer el sistema completo, demostrar recuperación y operarlo con un grupo piloto controlado.

### Alcance

- Modelado de amenazas y remediación.
- revisión de aislamiento, roles y privacidad.
- gestión de secretos y configuración productiva.
- auditoría, métricas, trazas, alertas y runbooks.
- backups y restauración probada.
- retención, exportación y eliminación planificadas/implementadas según obligación.
- rendimiento, accesibilidad y confiabilidad.
- distribución y soporte de beta privada.

### Historias principales

- Como usuario piloto, quiero confiar en que otro hogar no verá mis datos.
- Como operador, quiero detectar y responder a fallos sin leer información sensible.
- Como responsable, quiero restaurar datos y auditar cambios.
- Como equipo, quiero liberar gradualmente y poder detener/revertir una versión.

### Dependencias

- Fases anteriores funcionalmente cerradas.
- ADR-018, ADR-019 y ADR-020.
- Revisión legal/privacidad para el mercado piloto.

### Criterios de aceptación

- No quedan hallazgos críticos/altos sin tratamiento aprobado.
- Pruebas de acceso cruzado y autorización pasan.
- Logs, trazas, prompts y notificaciones están redactados.
- Restauración desde backup se prueba contra RPO/RTO definidos.
- Alertas y runbooks cubren incidentes críticos.
- Exportación/eliminación/retención cumplen política aprobada.
- Beta tiene consentimiento, soporte, rollback y monitoreo.
- Definition of Done y criterios pendientes de cada fase están satisfechos.

### Pruebas requeridas

- SAST, dependencias, secretos y configuración.
- DAST/pentest proporcional al riesgo.
- aislamiento multi-tenant e IDOR.
- carga, estrés y resiliencia.
- backup/restore y recuperación.
- E2E de flujos financieros críticos.
- evaluación regresiva de IA.
- accesibilidad y pruebas de dispositivos objetivo.

### Riesgos

- Descubrir tarde fallos estructurales de aislamiento.
- Telemetría con datos financieros.
- recuperación no probada.
- obligaciones regulatorias desconocidas.
- soporte insuficiente para usuarios piloto.

### Entregables

Informe de amenazas/remediación, infraestructura de observabilidad, backups verificados, runbooks, checklist de beta, versión candidata y reporte de go/no-go.

### Fuera de esta fase

Lanzamiento público masivo, multirregión, panel web, integraciones bancarias, pagos automáticos y garantías de asesoría profesional.

## Control de cierre de fase

Al cerrar cualquier fase se registra:

- historias y criterios cumplidos;
- enlaces a implementación, contratos, migraciones y documentación;
- pruebas ejecutadas y evidencia;
- riesgos aceptados con responsable y fecha;
- ADR aceptados/sustituidos;
- trabajo fuera o diferido;
- recomendación concreta de la siguiente historia.

Una fase no está terminada por porcentaje de código ni por calendario: lo está cuando su evidencia satisface criterios y Definition of Done.
