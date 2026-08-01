# Alcance del MVP

## Objetivo

El MVP demostrará que una persona o pareja puede registrar, corregir, consultar y planear sus finanzas mediante una experiencia móvil y conversacional confiable, manteniendo al backend y al ledger como fuente de verdad.

“MVP” no significa implementar todas las capacidades del dominio a la vez. El roadmap entrega incrementos secuenciales; cada fase debe cumplir sus propios criterios antes de avanzar.

## Usuarios incluidos

- un usuario que administra sus finanzas;
- un hogar con uno o más integrantes;
- una pareja con finanzas personales y compartidas;
- roles básicos y visibilidad configurable.

El producto se validará primero con una pareja piloto, sin codificar la cardinalidad de dos personas.

## Capacidades incluidas

### Identidad, hogar y acceso

- autenticación según ADR;
- creación/unión a un hogar;
- membresías, roles y permisos básicos;
- cuentas personales y compartidas;
- separación estricta por `household_id`;
- visibilidad acorde con propiedad y permisos.

### Cuentas y ledger

- banco, efectivo, apartados, vales, tarjetas, deudas, ahorro y cuentas virtuales necesarias;
- transacciones con entradas balanceadas;
- importes exactos;
- saldos actuales e históricos reconstruibles;
- auditoría e idempotencia;
- borrador, vista previa y confirmación;
- reversión, reemplazo, ajuste y reclasificación auditada.

### Operación financiera

- ingresos;
- gastos personales y compartidos;
- transferencias;
- categorías y división de movimientos;
- compras y pagos con tarjeta;
- deudas y pagos parciales;
- compras a meses y compromisos;
- reembolsos;
- apartados y liberaciones;
- pagos recurrentes;
- tandas;
- conciliación y diferencias pendientes.

### Experiencia móvil

- registro manual de flujos críticos;
- consulta de movimientos y detalle de auditoría comprensible;
- vista de saldos actual, restringido, comprometido y disponible;
- confirmaciones y manejo de errores;
- accesibilidad y estados de carga/vacío.

### Asistente conversacional

- interpretación de lenguaje natural;
- creación de borradores mediante herramientas tipadas;
- preguntas mínimas por datos obligatorios;
- previsualización y confirmación explícita;
- correcciones y divisiones;
- consultas basadas en backend;
- próximos pagos;
- inicio de conciliación;
- escenarios no vinculantes;
- explicación de disponibilidad y reparto quincenal.

### Planificación

- regla 50/30/20 y porcentajes configurables;
- presupuestos por categoría, integrante, hogar y periodo;
- reparto proporcional, 50/50 y manual;
- ingresos sostenibles separados de bonos temporales;
- metas, fondo de emergencia y escenarios.

### Calidad operativa

- pruebas por nivel para flujos críticos;
- OpenAPI y contratos compartidos;
- errores observables sin filtrar datos sensibles;
- baseline de seguridad y privacidad;
- estrategia de backups/recuperación definida antes de beta;
- preparación arquitectónica para sincronización offline posterior.

## Escenarios de aceptación del producto

El MVP se considera funcionalmente demostrable cuando, con autorización correcta y sin acceso cruzado:

1. Un usuario registra una nómina de MXN 12,620.70 y el saldo exacto se reconstruye.
2. Registra MXN 650 de gasolina y puede reclasificarlo como despensa conservando auditoría.
3. Retira efectivo y el patrimonio no cambia por un gasto inexistente.
4. Registra una diferencia de MXN 430 en efectivo; el disponible baja y la causa queda pendiente.
5. Registra una compra de MXN 12,000 a 12 MSI una sola vez y obtiene 12 compromisos sin duplicar gasto.
6. Paga la tarjeta y disminuyen banco y deuda sin crear un segundo gasto.
7. Registra vales y depósito de renta sin sumarlos indebidamente al efectivo disponible.
8. Distingue aportaciones, pendientes y recepción en una tanda.
9. Calcula aportaciones compartidas 50/50, proporcionales y manuales.
10. La IA transforma mensajes en borradores, pregunta lo indispensable y nunca confirma una operación ambigua.
11. Un reintento con la misma intención no duplica ningún movimiento.
12. Un saldo histórico puede explicarse con las entradas que lo componen.

Cada escenario se materializa gradualmente en las fases de [`05-roadmap.md`](05-roadmap.md); no autoriza implementarlos todos en una sola tarea.

## Fuera del MVP

- conexión o sincronización automática con bancos;
- iniciación de transferencias y pagos bancarios reales;
- panel web;
- asesoría financiera, fiscal, contable o legal garantizada;
- recomendaciones automáticas de inversión;
- contabilidad empresarial, facturación o nómina patronal;
- soporte completo de múltiples divisas, salvo que un ADR cambie el alcance;
- OCR de estados de cuenta como flujo principal;
- automatizaciones irreversibles sin confirmación;
- marketplace o integraciones de terceros;
- modo offline completo y resolución avanzada de conflictos;
- escala pública masiva o disponibilidad multirregión.

## Preparado desde el diseño, pero diferido

- cola local de movimientos;
- identificadores idempotentes creados en cliente;
- estados localmente pendiente, sincronizado y fallido;
- deduplicación en servidor;
- resolución de conflictos;
- Redis/BullMQ para trabajos programados;
- importación bancaria;
- exportación y eliminación autoservicio;
- panel web.

Preparar no significa implementar. Las interfaces y claves no deben cerrar el camino a estas capacidades.

## Requisitos no funcionales mínimos

- exactitud monetaria y balance del ledger;
- consistencia transaccional;
- aislamiento por hogar y autorización por recurso;
- privacidad de cuentas personales;
- trazabilidad de escrituras;
- idempotencia;
- tiempos y errores comprensibles en flujos críticos;
- accesibilidad móvil básica;
- documentación y contratos sincronizados;
- logs redactados;
- recuperación de datos planificada antes de beta.

Los objetivos numéricos de rendimiento, disponibilidad, RPO y RTO requieren ADR/SLO antes de la beta.

## Supuestos

- el primer mercado opera principalmente en MXN;
- la primera interfaz se diseña en español;
- el usuario confirma movimientos antes de que afecten saldos;
- la captura inicial es manual o conversacional;
- la API es la única vía de escritura financiera;
- el piloto es pequeño y controlado;
- las obligaciones legales aplicables dependerán del mercado y deben validarse antes de beta.

## Criterio de control de alcance

Una propuesta entra al MVP solo si:

1. resuelve un escenario incluido;
2. tiene una fase asignada;
3. cuenta con criterios verificables;
4. respeta las invariantes del dominio;
5. no introduce una integración expresamente excluida;
6. no desplaza un riesgo crítico sin decisión explícita.

Si falla alguno, se registra como trabajo futuro o se aprueba mediante cambio documentado de alcance.

