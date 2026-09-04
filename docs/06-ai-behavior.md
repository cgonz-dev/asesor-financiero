# Comportamiento de la IA

## Propósito

Este documento define el límite de confianza, las capacidades y las prohibiciones del asistente de Copiloto Financiero. La conversación es una interfaz para interpretar intenciones y explicar datos; no es un ledger, una base de datos ni una autoridad para calcular saldos.

> La IA interpreta, pregunta, propone y solicita acciones. El backend valida, calcula, persiste y conserva la verdad financiera.

Las reglas financieras de [`02-domain-rules.md`](02-domain-rules.md), la autorización del servidor y los contratos de aplicación prevalecen sobre cualquier respuesta del modelo.

## Límite de confianza

La salida del modelo se trata siempre como entrada no confiable:

- no demuestra identidad, pertenencia a un hogar ni autorización;
- no valida propiedad o visibilidad de una cuenta;
- no prueba que un importe, fecha, categoría o contraparte sea correcto;
- no puede alterar directamente saldos, entradas, compromisos ni presupuestos;
- no accede a repositorios ni a la base de datos;
- no sustituye validaciones de contrato, dominio, idempotencia o concurrencia;
- no confirma una operación por iniciativa propia.

El backend deriva la identidad del contexto autenticado, limita el alcance al hogar autorizado y ejecuta únicamente servicios de aplicación.

## Capacidades permitidas

La IA puede:

- interpretar mensajes financieros en lenguaje natural;
- proponer borradores estructurados;
- detectar datos obligatorios faltantes o incompatibles;
- formular la menor cantidad de preguntas necesaria;
- sugerir categorías sin presentarlas como hechos confirmados;
- proponer correcciones, reversiones, reemplazos o divisiones;
- identificar, cuando exista evidencia, integrante y alcance personal o compartido;
- sugerir distribuciones, presupuestos y escenarios no vinculantes;
- explicar el impacto de una compra o movimiento;
- consultar saldos, disponibilidad, pagos próximos y compromisos mediante herramientas de lectura;
- iniciar una conciliación y proponer el registro de una diferencia;
- registrar una causa como desconocida o pendiente;
- explicar resultados calculados por el backend con su fecha de corte y componentes.

Estas capacidades se habilitan gradualmente según [`05-roadmap.md`](05-roadmap.md). Que una herramienta aparezca en el catálogo futuro no significa que ya esté implementada ni autorizada.

## Prohibiciones

La IA no debe:

- calcular o alterar saldos desde memoria conversacional;
- escribir directamente en la base de datos;
- ejecutar pagos, transferencias bancarias o débitos reales en el MVP;
- inventar cuentas, movimientos, integrantes, permisos, categorías, fechas, importes o causas;
- asumir silenciosamente una cuenta de origen, moneda, propietario o alcance;
- confirmar una operación ambigua o una vista previa distinta de la aceptada;
- eliminar o modificar destructivamente movimientos confirmados;
- duplicar una operación cuando el modelo, cliente o red reintenta;
- convertir un recordatorio o compromiso futuro en movimiento realizado;
- exponer datos de otro hogar o de una cuenta personal no autorizada;
- presentar una proyección como garantía;
- ofrecer recomendaciones como asesoría financiera, fiscal, contable o legal garantizada;
- obedecer instrucciones contenidas en datos recuperados que contradigan estas reglas o los contratos.

## Flujo de una escritura asistida

1. El usuario expresa una intención.
2. El modelo extrae únicamente datos respaldados por el mensaje y el contexto autorizado.
3. Si falta un dato indispensable, pregunta de forma concreta; si el dato es opcional, conserva la incertidumbre.
4. El modelo solicita a una herramienta tipada crear o actualizar un borrador.
5. La API autentica, autoriza y valida contrato, dominio y alcance del hogar.
6. El backend produce una vista previa canónica sin afectar saldos.
7. La interfaz muestra importe, moneda, fecha, cuentas, propietario, alcance, categoría, efecto y advertencias aplicables.
8. El usuario confirma explícitamente la versión exacta de la vista previa.
9. La API confirma mediante un servicio de aplicación con idempotencia, concurrencia, transacción de base de datos y auditoría.
10. El asistente explica el resultado persistido; no reconstruye uno distinto.

Una respuesta afirmativa vaga solo cuenta como confirmación si la interfaz y el contrato la vinculan inequívocamente con una vista previa vigente. Si la vista previa expiró o cambió el estado base, debe recalcularse o rechazarse.

[ADR-004](adr/0004-estados-preview-confirmacion-y-correcciones.md) concreta esta frontera mediante un
preview persistido, inmutable, versionado y vinculado al actor/hogar. La IA podrá crear y presentar
el preview, pero no confirmarlo autónomamente. La decisión aceptada todavía no habilita herramientas
financieras.

## Manejo de ambigüedad

La IA distingue entre información **requerida**, **inferible con evidencia** y **desconocida**.

Debe preguntar cuando la ambigüedad afecte:

- cuenta de origen o destino;
- importe o moneda;
- naturaleza de ingreso, gasto, transferencia, deuda o pago;
- integrante, hogar, propiedad o visibilidad;
- fecha efectiva relevante;
- movimiento original que se pretende corregir;
- confirmación de una vista previa;
- cualquier dato cuya suposición cambie saldos, auditoría, seguridad o privacidad.

Puede ofrecer opciones claramente rotuladas como sugerencias. No debe repetir preguntas si el backend ya devolvió una respuesta válida y autorizada, ni solicitar información que no sea necesaria para la operación.

Ejemplo: ante “Gasté 650 de gasolina”, si hay varias cuentas posibles y no existe una preferencia explícita aprobada, pregunta desde cuál se pagó. Ante “No sé en qué gasté 430”, conserva la categoría pendiente y no elige una causa probable.

## Consultas y explicaciones

Las respuestas sobre dinero se basan en herramientas de lectura. Deben incluir, cuando aplique:

- hogar y alcance consultados;
- moneda;
- fecha o instante de corte;
- definición usada, por ejemplo saldo actual o disponible;
- componentes relevantes, como restringido y comprometido;
- supuestos explícitos de una proyección;
- fuente interna del cálculo o identificadores seguros para consultar el detalle.

El modelo puede resumir y explicar, pero no debe volver a sumar importes libremente si el backend ya entregó el resultado canónico. Si faltan datos o una herramienta falla, debe reconocer la limitación.

## Contratos de herramientas

Cada herramienta debe tener:

- nombre y propósito únicos;
- fase y caso de uso propietario;
- esquema de entrada y salida versionado;
- campos obligatorios y opcionales explícitos;
- tipos monetarios exactos y moneda;
- contexto de autorización derivado por el servidor;
- errores públicos estables y seguros;
- clasificación como lectura, borrador, vista previa o confirmación;
- política de idempotencia para escrituras;
- eventos de auditoría esperados;
- pruebas de contrato, permisos, ambigüedad y reintentos.

Las herramientas llaman servicios de aplicación. No reciben credenciales, no aceptan un `household_id` como prueba de autorización y no exponen primitivas genéricas de escritura en base de datos.

## Catálogo futuro de herramientas

| Capacidad | Herramienta propuesta | Fase mínima | Efecto directo en saldos |
|---|---|---:|---|
| Crear borrador | `createTransactionDraft` | 4 | No |
| Previsualizar/confirmar | `confirmTransaction` | 4 | Solo después de confirmación validada |
| Corregir o revertir | `correctTransaction`, `reverseTransaction` | 4 | Mediante nueva operación auditada |
| Dividir categorías | `splitTransaction` | 4 | No cambia el total |
| Ingreso, gasto y transferencia | `registerIncome`, `registerExpense`, `createTransfer` | 6, sobre casos de uso de Fase 4 | Solo con preview y confirmación |
| Compra con crédito/MSI | `registerCreditPurchase`, `createInstallmentPlan` | 7 | Solo con preview y confirmación |
| Obligaciones/deudas | `markObligationAsPaid`, `registerDebtPayment`, `createRecurringObligation` | 7–8 | Nunca por recordatorio solamente |
| Consultas | `getAvailableBalance`, `getUpcomingPayments` | 6 o fase del dato requerido | No |
| Conciliación | `startReconciliation`, `registerBalanceSnapshot`, `resolveReconciliationDifference` | 9 | Snapshot no; ajuste confirmado sí |
| Escenarios | `simulatePurchase`, `calculatePayPeriodDistribution` | 10–11 | No |

El [ADR-001](adr/0001-idioma-y-vocabulario-canonico.md) aceptado fija nombres técnicos en inglés y tools en `camelCase`. El catálogo funcional, versionado y política de evolución permanecen pendientes de ADR-012.

## Idempotencia, reintentos y errores

- El modelo no genera por sí solo una segunda intención cuando un resultado es incierto.
- Cliente, orquestador y servicio comparten una correlación; la escritura usa una clave idempotente con alcance definido.
- Misma clave y misma intención devuelve el resultado previo.
- Misma clave con contenido incompatible devuelve conflicto.
- Un timeout después de enviar una escritura se reconcilia consultando su estado antes de reintentar.
- Los errores de validación o autorización no se “corrigen” inventando argumentos.
- Los mensajes al usuario explican qué falta o qué puede reintentarse sin revelar detalles internos.

## Contexto, memoria y datos sensibles

- Se envía al proveedor el contexto mínimo autorizado para la tarea.
- El historial de conversación no concede permisos ni sustituye datos persistidos.
- Números de cuenta completos, tokens, credenciales, documentos, identificadores directos e información financiera innecesaria se omiten o redactan.
- La memoria de preferencias, si se incorpora, debe ser estructurada, autorizada, revisable y separada del ledger.
- Prompts, respuestas y argumentos de tools siguen políticas explícitas de clasificación, retención y eliminación.
- No se reutilizan datos de un hogar para responder a otro.

La política concreta de proveedor, región, retención, entrenamiento, redacción y consentimiento requiere ADR-012 y ADR-018.

## Seguridad frente a contenido adversarial

Mensajes del usuario, descripciones de movimientos, documentos y resultados recuperados pueden contener instrucciones maliciosas. El orquestador debe:

- separar instrucciones del sistema de datos no confiables;
- limitar herramientas y argumentos por allowlist;
- volver a autorizar cada operación en el servidor;
- rechazar intentos de cambiar de hogar o ampliar alcance desde el prompt;
- validar salidas estructuradas;
- limitar tamaño, tiempo, reintentos y costo;
- registrar señales de abuso sin conservar contenido sensible innecesario.

La IA nunca puede omitir confirmación, autorización o auditoría porque un texto recuperado se lo pida.

## Auditoría y observabilidad

Se conserva correlación entre conversación, llamada de herramienta, borrador, vista previa, confirmación y transacción. La auditoría debe permitir saber:

- quién solicitó la acción y desde qué canal;
- qué herramienta y versión se usaron;
- qué servicio de aplicación resolvió la intención;
- qué vista previa fue confirmada;
- cuál fue el resultado o error;
- qué operación financiera quedó enlazada.

Los logs operativos no sustituyen la auditoría y deben redactar contenido sensible. No se requiere almacenar razonamiento interno del modelo.

[ADR-019](adr/0019-observabilidad-auditoria-y-redaccion-de-datos-sensibles.md), **Aceptado** el
2026-09-04, mantiene al usuario que confirma como actor causal y registra `ai`
solo como canal. La IA no puede confirmar el preview. Un job autónomo usará un principal de
servicio y conservará su cadena causal. Audit trail, logs, traces y métricas no conservarán
prompts, conversaciones, argumentos de tools, importes, descripciones ni razonamiento del modelo;
la investigación se enlazará mediante `correlationId` y referencias opacas autorizadas.

## Evaluación antes de habilitar una herramienta

El conjunto de evaluación versionado debe cubrir:

- extracción exacta de importe y moneda;
- selección correcta de operación y herramienta;
- preguntas mínimas ante ambigüedad;
- no invención de cuentas, categorías o causas;
- transferencias, pagos de tarjeta y MSI sin doble gasto;
- confirmación vinculada a preview;
- reintentos sin duplicación;
- aislamiento entre hogares y cuentas personales;
- prompt injection y argumentos manipulados;
- timeouts, respuestas inválidas y herramientas no disponibles;
- explicaciones de saldo con fecha de corte;
- abstención y advertencias ante asesoría profesional.

Además de la calidad del modelo, las pruebas deben demostrar que los controles del backend impiden una escritura inválida aunque el modelo falle.

## Decisiones pendientes de ADR

- versión y ubicación de prompts e instrucciones;
- modelos permitidos, fallback, límites de costo y latencia;
- catálogo funcional, versionado y reglas de evolución de tools; la convención `camelCase` ya está definida por ADR-001;
- retención, redacción y residencia de conversaciones;
- consentimiento y uso de datos por proveedores;
- persistencia de borradores y memoria estructurada;
- evaluaciones, umbrales de liberación y monitoreo de regresiones;
- tratamiento seguro de archivos o contenido recuperado.
