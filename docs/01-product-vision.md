# Visión del producto

## Resumen

Copiloto Financiero ayuda a personas y hogares a entender, registrar y planear su dinero mediante conversación natural, sin sacrificar exactitud, privacidad ni control. El MVP se diseñará con una pareja como primer caso, pero el modelo soportará hogares de uno o más integrantes.

## Problema

La vida financiera doméstica rara vez cabe en una sola cuenta o una hoja simple. Conviven nóminas quincenales, ingresos variables, efectivo, apartados, vales, fondos de ahorro, tarjetas, créditos, tandas, gastos personales, compromisos compartidos y movimientos que después necesitan corrección.

Las herramientas tradicionales suelen exigir que el usuario traduzca cada hecho a formularios y categorías. Un chatbot genérico reduce esa fricción, pero no es aceptable como fuente de verdad: puede olvidar contexto, duplicar operaciones, inventar datos o confundir un pago de deuda con un gasto.

## Propuesta de valor

El usuario habla como habla normalmente:

- “Hoy me depositaron 12,620.70 pesos.”
- “Gasté 650 pesos de gasolina.”
- “Mi esposa pagó 300 pesos de su tanda.”
- “Compramos una televisión de 12,000 pesos a 12 meses sin intereses.”
- “El gasto anterior no fue gasolina, fue despensa.”
- “No recuerdo en qué gasté 430 pesos, pero el efectivo ya no cuadra.”
- “Ya pagué la tarjeta.”
- “¿Podemos comprar un sillón este mes?”
- “¿Cuánto tiene que aportar cada uno esta quincena?”

El producto traduce la intención a un borrador estructurado, pregunta únicamente por datos indispensables, muestra el impacto, solicita confirmación y ejecuta una operación validada por el backend. Después explica el resultado con datos recuperados del sistema.

## Usuarios y contexto inicial

### Usuario individual

Necesita controlar cuentas, efectivo, gastos personales, deudas, metas y obligaciones sin depender de un hogar compartido.

### Pareja

Necesita combinar algunas finanzas sin perder autonomía: cuentas personales, cuentas compartidas, visibilidad configurable, reparto de gastos y metas comunes.

### Hogar con varios integrantes

Es una extensión prevista del modelo. Requiere membresías, roles, reglas de visibilidad y atribución de cada operación. El diseño no debe codificar el supuesto de exactamente dos integrantes.

## Trabajo que el producto resuelve

- Registrar un hecho financiero con la menor fricción posible.
- Saber cuánto dinero está realmente disponible, no solo cuánto aparece en el banco.
- Entender qué parte está restringida o comprometida.
- Separar lo personal de lo compartido.
- Corregir errores sin perder historial.
- Anticipar obligaciones y evaluar compras.
- Repartir aportaciones con reglas comprensibles.
- Conciliar el mundo real con el registro, aun cuando falte información.

## Principios de experiencia

1. **Exactitud antes que fluidez.** Una respuesta agradable nunca justifica un saldo incorrecto.
2. **Confirmación proporcional al impacto.** Toda escritura financiera se previsualiza; las consultas no requieren confirmación.
3. **Preguntar lo mínimo.** Solo se solicita un dato cuando una regla o la ambigüedad impide una operación segura.
4. **Transparencia.** El usuario ve cuenta, importe, fecha, propietario, alcance, categoría y efecto antes de confirmar.
5. **Corrección sin pérdida.** El sistema conserva el original y explica el ajuste.
6. **Privacidad por diseño.** Pertenecer al mismo hogar no implica acceso ilimitado a cuentas personales.
7. **Lenguaje comprensible.** La interfaz explica “disponible”, “comprometido” y “restringido” con trazabilidad.
8. **Incertidumbre explícita.** Lo desconocido se marca como pendiente, no se rellena con una suposición.

## Capacidades del hogar

El modelo contempla integrantes, cuentas personales y compartidas, banco, efectivo, apartados, tarjetas, créditos, vales, fondos de ahorro, ingresos, bonos, gastos, presupuestos, tandas, compras a meses, pagos recurrentes, metas, recordatorios y conciliaciones.

Debe distinguir:

- dinero disponible para gastar;
- dinero restringido por finalidad o instrumento;
- dinero comprometido por obligaciones;
- beneficios no líquidos;
- activos recuperables;
- pasivos y deudas;
- finanzas personales y compartidas.

## Métricas de resultado propuestas

Los objetivos cuantitativos se fijarán con datos del piloto; inicialmente se medirán:

- porcentaje de borradores confirmados sin corrección posterior;
- tasa de duplicados financieros confirmados (objetivo: cero);
- porcentaje de saldos reconstruibles y conciliados;
- tiempo mediano desde mensaje hasta confirmación;
- cantidad de preguntas aclaratorias por operación;
- porcentaje de movimientos con cuenta, propietario, alcance y auditoría completos;
- éxito de tareas críticas: registrar, corregir, transferir, pagar tarjeta y conciliar;
- incidentes de acceso cruzado entre hogares (objetivo: cero);
- confianza reportada por el usuario en el saldo disponible.

Las métricas no deben incentivar confirmaciones ambiguas ni menos preguntas a costa de exactitud.

## No objetivos

El MVP no busca:

- sustituir asesoría financiera, fiscal, contable o legal profesional;
- ejecutar transferencias o pagos bancarios reales;
- conectarse automáticamente con bancos;
- predecir mercados o recomendar inversiones garantizadas;
- ofrecer contabilidad empresarial;
- construir un panel web;
- automatizar decisiones financieras irreversibles sin confirmación.

## Hipótesis por validar

- La conversación reduce la fricción de registro respecto de formularios.
- La vista previa aumenta confianza sin hacer lento el flujo.
- Una pareja acepta compartir información si puede controlar visibilidad y propiedad.
- El concepto de “dinero realmente disponible” es más valioso que un saldo bancario aislado.
- Los usuarios comprenden las correcciones auditables en lugar de borrado.
- El valor aparece antes de incluir integraciones bancarias.

Estas hipótesis deben validarse con investigación y pruebas de usabilidad durante las fases correspondientes.
