# Seguridad y privacidad

## Propósito

Copiloto Financiero trata identidad, relaciones del hogar y datos financieros sensibles. Este documento establece el baseline que guía arquitectura, contratos, implementación, pruebas y operación. No sustituye una revisión legal ni un modelado de amenazas específico antes de la beta.

## Objetivos

- Impedir acceso cruzado entre hogares.
- Respetar propiedad y visibilidad de recursos personales y compartidos.
- Proteger credenciales, sesiones y datos financieros.
- Conservar trazabilidad sin convertir logs o prompts en una copia insegura de los datos.
- Limitar el impacto de errores del cliente, la IA, operadores o proveedores.
- Permitir recuperación, exportación y eliminación conforme a políticas aprobadas.

## Clasificación inicial de datos

| Clase | Ejemplos | Tratamiento mínimo |
|---|---|---|
| Secreto | contraseñas, claves API, tokens de sesión, secretos de firma | Nunca en código, Git, logs, prompts o analítica; gestor seguro y rotación |
| Financiero sensible | cuentas, saldos, movimientos, deudas, ingresos, presupuestos, tandas | Acceso mínimo, cifrado, redacción y auditoría |
| Identidad y hogar | nombre, correo, membresías, invitaciones, relaciones, roles | Acceso por finalidad y protección contra enumeración |
| Contenido conversacional | mensajes, adjuntos, argumentos y resultados de tools | Minimización, autorización, retención limitada y redacción |
| Auditoría | actor, acción, instante, recurso, resultado, correlación | Integridad, acceso restringido y retención definida |
| Operacional no sensible | métricas agregadas, health checks, códigos de error seguros | Evitar dimensiones que permitan reidentificación |

La clasificación detallada, periodos de retención y obligaciones por mercado requieren ADR-018 y revisión legal.

## Límite del hogar

`household_id` es el límite principal de colaboración y aislamiento, pero un valor recibido del cliente nunca demuestra autorización.

Para cada lectura y escritura, el servidor debe:

1. autenticar la identidad;
2. resolver membresía activa y estado;
3. autorizar acción y recurso;
4. acotar la consulta por hogar;
5. validar propiedad y visibilidad específicas;
6. rechazar relaciones con recursos de otro hogar;
7. registrar acciones sensibles de forma segura.

Los IDs deben ser opacos y la API debe evitar respuestas que permitan enumerar hogares o recursos. [ADR-006](adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md) acepta defensa en profundidad con restricciones y claves compuestas, y exige evaluar Row Level Security antes de Fase 3.

## Propiedad, roles y visibilidad

Pertenecer a un hogar no concede acceso automático a toda información financiera.

Cada recurso sensible debe declarar:

- hogar propietario;
- propietario individual o titularidad compartida;
- política de visibilidad;
- acciones permitidas por rol;
- condiciones para compartir, revocar o transferir acceso.

La matriz inicial debe distinguir al menos:

- recurso personal privado;
- recurso personal compartido explícitamente;
- recurso del hogar;
- información agregada que no revele detalles personales no autorizados.

Los roles, permisos de administración, consentimiento de pareja y efectos de abandonar un hogar están definidos documentalmente en [ADR-006](adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md); su implementación requiere una autorización posterior de Fase 2. No se usará únicamente ocultamiento en UI como control de acceso.

## Autenticación y sesiones

[ADR-005](adr/0005-autenticacion-y-ciclo-de-sesion-movil.md) define Auth0 y el flujo OAuth 2.0/OIDC
para el MVP. Historia 2 implementó y validó el límite de token, sesión móvil y `/me` en un
development build Android. La política inicial de desarrollo/MVP usa access tokens de 10 minutos,
inactividad de refresh de 7 días, máximo de 30 días, rotación y overlap de 3 segundos; es revisable
y no una garantía definitiva. El diseño vigente y sus incrementos deben cumplir:

- identidad derivada de credenciales verificadas, no de IDs arbitrarios;
- contraseñas, si existen, tratadas por un proveedor o algoritmo apropiado;
- protección contra enumeración, fuerza bruta y abuso;
- tokens de corta duración y renovación/revocación controladas;
- almacenamiento móvil en Keychain/Keystore o equivalente seguro;
- no guardar tokens en almacenamiento inseguro, logs, URLs o analítica;
- cierre de sesión y revocación ante pérdida de dispositivo;
- verificación adicional para acciones de alto riesgo cuando el modelo de amenazas lo justifique;
- expiración, revocación y auditoría de invitaciones al hogar.

El guard implementado acepta solo access tokens RS256 para issuer/audience configurados, usa JWKS
con caché y timeout, y deriva la identidad externa de `issuer + subject`; no acepta ID tokens,
correo, `userId` ni `householdId`. El móvil usa el Credentials Manager oficial sobre
Keychain/Keystore y mantiene el access token en memoria cuando es utilizable. No existe bypass de
desarrollo, almacenamiento en AsyncStorage/localStorage ni autorización basada en roles u
Organizations de Auth0. Invitaciones, revocación global/granular y autorización Household siguen
fuera del incremento actual.

## Autorización del servidor

- Se aplica denegación por defecto.
- Controladores, jobs, herramientas de IA y procesos internos usan los mismos servicios autorizados.
- La validación de autorización ocurre antes de revelar existencia o datos de un recurso.
- Toda entrada que relacione cuentas, movimientos, categorías, compromisos o snapshots valida compatibilidad de hogar.
- Operaciones de varios recursos se autorizan como conjunto, no solo individualmente.
- La autorización se prueba con casos negativos, IDOR, enumeración, roles revocados y membresías inactivas.

## Protección de datos y secretos

- TLS vigente protege datos en tránsito entre móvil, API y proveedores.
- Los datos persistidos y backups usan cifrado de plataforma o controles equivalentes; campos con riesgo especial se evalúan por separado.
- Secretos se suministran mediante entorno o gestor de secretos y nunca se incluyen en valores por defecto.
- `.env.example`, cuando exista, contiene solo nombres y ejemplos no sensibles.
- Se define rotación, revocación, acceso y respuesta ante exposición.
- Ambientes de desarrollo y prueba no usan datos financieros reales salvo proceso excepcional aprobado y protegido.
- Fixtures, capturas, tickets y documentación usan datos ficticios.
- Archivos temporales, exportaciones y backups conservan la misma clasificación que la fuente.

## Minimización y privacidad por diseño

- Solo se recopilan datos necesarios para una función documentada.
- Cada acceso se limita al hogar, integrante, periodo y campos requeridos.
- La UI evita mostrar información personal en pantallas compartidas, notificaciones o vistas previas del sistema.
- Analítica y telemetría prefieren eventos agregados sin importes, descripciones ni identificadores directos.
- Nuevos usos de datos requieren propósito, base, retención, acceso y eliminación documentados.
- Funciones de compartir son explícitas, reversibles cuando sea posible y comprensibles.

## IA y proveedores

El asistente sigue además [`06-ai-behavior.md`](06-ai-behavior.md).

- Se envía el contexto mínimo autorizado.
- El proveedor no recibe secretos ni tokens de sesión.
- Los argumentos y resultados de tools se validan y redactan.
- Prompts o conversaciones no se usan como autorización.
- Se evalúan políticas de retención, entrenamiento, residencia, subprocesadores y eliminación antes de usar datos reales.
- Se impide que contenido recuperado cambie instrucciones, seleccione otro hogar u omita confirmación.
- La conversación no se convierte en una fuente paralela de saldos.

## Logs, trazas, métricas y auditoría

Los logs operativos sirven para diagnosticar; la auditoría sirve para demostrar acciones. No son intercambiables.

No se registran por defecto:

- tokens, contraseñas, cookies o claves;
- números completos de cuenta o tarjeta;
- mensajes completos del usuario;
- prompts y respuestas completas;
- saldos o importes vinculados a identidad;
- documentos o adjuntos;
- datos personales innecesarios.

Se prefieren códigos de evento, IDs opacos, correlación, duración, resultado y campos previamente permitidos. Redacción y allowlists se prueban. El acceso a auditoría es restringido y también auditable.

La auditoría financiera conserva actor, acción, instante, canal, intención, resultado y relación entre original/corrección. No debe incluir razonamiento interno del modelo.

## Integridad financiera y disponibilidad

Los controles de seguridad incluyen integridad:

- importes exactos, balance e invariantes en dominio y persistencia;
- transacciones de base de datos para escrituras relacionadas;
- idempotencia ante reintentos;
- protección de concurrencia;
- entradas confirmadas inmutables;
- correcciones enlazadas y auditadas;
- snapshots y agregados reconciliables con el ledger;
- permisos mínimos para aplicaciones, workers y operadores.

Un incidente que altere, duplique, oculte o mezcle movimientos se trata como incidente de seguridad e integridad, no solo como bug funcional.

## Retención, exportación y eliminación

Antes de beta se debe definir:

- categorías de datos y fundamento de conservación;
- periodo por categoría y ambiente;
- tratamiento de movimientos/auditoría que deban conservar historia;
- exportación segura, autenticada y comprensible;
- eliminación o anonimización de cuenta y hogar;
- efectos sobre datos compartidos cuando un integrante se retira;
- propagación a backups, proveedores y colas;
- verificaciones y evidencia de cumplimiento.

“Eliminar cuenta” no autoriza hard delete silencioso de movimientos financieros confirmados. ADR-018 debe conciliar integridad histórica, derechos aplicables y datos compartidos.

## Backups y recuperación

Antes de beta:

- se definen RPO y RTO;
- backups están cifrados, aislados y con acceso mínimo;
- retención y eliminación aplican también a copias;
- restauración se prueba, no solo la creación del backup;
- se verifica balance, aislamiento y auditoría después de restaurar;
- existe un runbook con responsables y criterios de comunicación.

ADR-020 documentará proveedor, frecuencia, pruebas y continuidad.

## Preparación para offline

El modo offline completo está diferido, pero cualquier diseño futuro debe:

- proteger la cola local y sus metadatos;
- usar identificadores e idempotency keys no predecibles;
- evitar guardar tokens o datos completos en almacenamiento inseguro;
- mostrar estados pendiente, sincronizado y fallido;
- reautorizar y revalidar al sincronizar;
- detectar conflictos sin usar “última escritura gana” para dinero;
- permitir borrado remoto/local conforme a la política aprobada.

## Amenazas prioritarias

| Amenaza | Control inicial |
|---|---|
| IDOR o acceso cruzado | autorización por recurso y hogar, IDs opacos, pruebas negativas y defensa en profundidad |
| Filtración de cuenta personal a la pareja | propiedad/visibilidad explícita y denegación por defecto |
| Robo o reutilización de sesión | almacenamiento seguro, expiración, renovación y revocación |
| Duplicación o alteración de movimientos | idempotencia, atomicidad, concurrencia, auditoría e inmutabilidad |
| Inyección mediante chat/documento | herramientas permitidas, validación, reautorización y separación de instrucciones/datos |
| Secretos o finanzas en logs | allowlist, redacción, pruebas y acceso restringido |
| Dependencia/proveedor comprometido | revisión de dependencias, mínimo privilegio, inventario y plan de rotación |
| Pérdida o corrupción de datos | backups, restauración probada, constraints y reconstrucción del ledger |
| Abuso interno | mínimo privilegio, segregación, auditoría y acceso temporal |
| Notificación sensible | contenido mínimo, preferencias y pruebas en pantalla bloqueada |

El modelado de amenazas se actualiza al incorporar autenticación, ledger, IA, notificaciones, exportación o proveedores.

## Verificaciones mínimas por cambio

Según el alcance, se revisa:

- autenticación y revocación;
- autorización, propiedad y aislamiento multi-hogar;
- IDOR, enumeración y exposición por errores;
- validación de entradas y salidas;
- secretos y configuración;
- dependencias y cadena de suministro;
- logs, trazas, prompts y notificaciones;
- integridad, idempotencia, atomicidad y auditoría;
- retención, exportación y eliminación;
- backups y restauración;
- abuso, límites y manejo de errores.

Los hallazgos críticos o altos requieren corrección o aceptación explícita con responsable, justificación y fecha antes de liberar.

## Respuesta a incidentes

Antes de beta deben existir responsables y runbooks para:

- acceso cruzado o exposición de datos;
- credencial o token comprometido;
- duplicación/corrupción financiera;
- proveedor externo comprometido;
- pérdida de disponibilidad o datos;
- restauración y verificación;
- comunicación y obligaciones legales aplicables.

La evidencia de un incidente se preserva con acceso restringido y sin ampliar innecesariamente la exposición.

## Decisiones pendientes de ADR

- autorizar la implementación posterior de [ADR-006](adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md) sobre roles, visibilidad, consentimiento y aislamiento/RLS;
- clasificación, retención, exportación y eliminación;
- cifrado adicional a nivel de campo y gestión de claves;
- auditoría, redacción, acceso de soporte y observabilidad;
- tratamiento de datos por OpenAI y otros proveedores;
- notificaciones y contenido permitido;
- backups, RPO/RTO y continuidad;
- requisitos legales y residencia de datos del mercado piloto.
