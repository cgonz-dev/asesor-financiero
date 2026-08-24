# ADR-005: Autenticación y ciclo seguro de sesiones móviles

- Estado: Aceptado
- Fecha: 2026-08-13
- Responsables: Responsable del proyecto; revisión de seguridad y privacidad antes de beta
- Fase/historia: Decisión bloqueante antes de Fase 2 — autenticación y ciclo seguro de sesiones móviles
- Sustituye a: Ninguno
- Sustituido por: Ninguno

## Contexto

Copiloto Financiero necesita demostrar de forma confiable quién realiza cada solicitud antes de crear hogares, integrantes o datos financieros. La Fase 1 está documentada como **cerrada**: ya existen el monorepo, la API NestJS, la aplicación Expo, contratos compartidos, OpenAPI, el cliente REST mínimo, controles de calidad, CI y modo LAN. Este ADR cierra la decisión de autenticación; la Fase 2 no ha iniciado y ADR-006 está aceptado, sin autorizar por sí solo el inicio de Fase 2.

El producto deberá soportar:

- una persona usuaria individual;
- una persona perteneciente a uno o más hogares;
- una pareja invitada a un hogar;
- sesiones móviles seguras y restaurables;
- cierre de sesión local;
- revocación de una sesión o de todas las sesiones;
- recuperación de acceso;
- cambio, robo o pérdida de dispositivo;
- varios dispositivos por persona;
- una futura aplicación web;
- una futura exportación o eliminación de cuenta.

La autenticación solo demuestra identidad. No concede por sí misma acceso a un hogar, membresía, rol, visibilidad ni permiso sobre un recurso. Esas decisiones están documentadas en [ADR-006](0006-autorizacion-roles-visibilidad-y-aislamiento.md), cuyo estado es **Aceptado**; su implementación queda para una tarea posterior de Fase 2.

Este ADR decide la estrategia, sus límites y el ciclo conceptual de sesión. No instala SDK, no diseña pantallas, no crea guards, no define tablas, no agrega una base de datos y no inicia la Fase 2.

### Conceptos separados

| Concepto | Pregunta que responde | Fuente futura | No implica |
|---|---|---|---|
| Autenticación | ¿La persona demostró una identidad? | Proveedor y verificación criptográfica del servidor | Acceso a un hogar |
| Sesión | ¿Cómo conserva y renueva esa autenticación un dispositivo? | Credenciales verificables, almacenamiento seguro y estado de revocación | Permisos de negocio |
| Autorización | ¿Puede el `User` ejecutar esta acción sobre este recurso? | Políticas del backend definidas por ADR-006 | Que el cliente pueda elegir su alcance |
| Membresía del hogar | ¿Qué `User` pertenece a qué `Household` y en qué estado? | Modelo interno futuro de ADR-006 | Una identidad del proveedor o su organización |
| Invitación al hogar | ¿Existe una invitación válida para iniciar la aceptación? | Artefacto interno opaco, temporal y revocable | Sesión autenticada, membresía ni rol |

El proveedor de identidad no será la fuente de verdad de hogares. Sus organizaciones, grupos, roles o metadata, si existen, no sustituirán las membresías y políticas internas.

## Restricciones y criterios

### Restricciones obligatorias

1. La API no confiará en `userId`, `email`, `householdId`, roles ni permisos enviados libremente por el cliente.
2. La identidad se derivará exclusivamente de una credencial verificada por el servidor.
3. La combinación exacta de `issuer` y `subject` será la identidad externa estable. El correo nunca será identificador inmutable.
4. El móvil será un cliente público: no contendrá client secrets, claves privadas ni secretos administrativos.
5. El flujo nativo usará navegador externo del sistema y Authorization Code con PKCE `S256`; no usará WebView embebida, implicit grant ni Resource Owner Password Credentials.
6. El access token destinado a la API, y no un ID token, autenticará llamadas a NestJS.
7. Access tokens persistidos, refresh tokens o credenciales equivalentes solo podrán guardarse mediante Keychain/Keystore detrás de una abstracción compatible con Expo.
8. No se usarán AsyncStorage, localStorage, almacenamiento web no protegido, archivos planos ni estado Redux persistido para tokens.
9. Copiloto Financiero no almacenará contraseñas. Si se habilita correo y contraseña, el proveedor administrado conservará y protegerá esas credenciales.
10. Los refresh tokens de un cliente público deberán ser rotatorios con detección de reutilización, o estar ligados criptográficamente a la instancia del cliente mediante un mecanismo equivalente verificable.
11. Debe poder cerrarse la sesión del dispositivo actual y todas las sesiones. La revocación remota granular por dispositivo dependerá de las capacidades del plan de Auth0 o de un registro interno futuro, sin presumir que todos los planes la ofrecen.
12. La revocación de una credencial de renovación no invalida mágicamente un access token ya emitido. Su ventana residual deberá limitarse y documentarse.
13. Firma, algoritmo permitido, `iss`, `aud`, `exp`, `nbf` cuando exista y claims mínimos se verificarán antes de construir el contexto autenticado.
14. Las claves públicas se obtendrán solo desde metadata/JWKS del issuer configurado, con caché y rotación controladas. Un `kid` desconocido nunca autoriza un bypass.
15. Tokens, cookies, credenciales, secretos, valores de PKCE, códigos de recuperación, códigos OTP y cuerpos de autenticación no aparecerán en logs, analítica, prompts, errores públicos ni repositorio. La única excepción de transporte es el authorization code OAuth efímero en el callback registrado descrito en la política siguiente.
16. Ninguna falla de autenticación confirmará si un correo, una identidad, una invitación, un hogar o un recurso existen.
17. Un cambio de correo no cambiará la relación con el `User` interno.
18. Unir identidades requerirá una sesión vigente, prueba reciente de control de ambas identidades y auditoría. Coincidir por correo no bastará.
19. Deshabilitar o eliminar una identidad externa no eliminará automáticamente datos financieros ni volverá a enlazarlos por correo.
20. No existirá un token propio emitido después de confiar ciegamente en datos de identidad enviados por el cliente.
21. El token de invitación no sustituirá la autenticación ni contendrá permisos confiables decididos por el cliente.
22. Autorización, roles, visibilidad, aislamiento y creación de membresía permanecen fuera de este ADR y reservados a ADR-006.
23. Los entornos de desarrollo, pruebas y producción deberán separar tenants, claves, usuarios y redirect URIs.
24. Los secretos solo existirán fuera del repositorio; `.env.example` documentará nombres y valores ficticios cuando se implemente la fase correspondiente.
25. Las duraciones de tokens y sesiones no se fijarán por intuición. Requerirán análisis de riesgo, capacidades del proveedor, experiencia móvil y evidencia de pruebas.

### Política aprobada sobre códigos y URLs

De acuerdo con el flujo de aplicaciones nativas descrito por [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html), el authorization code efímero de Authorization Code + PKCE puede aparecer transitoriamente en el redirect URI registrado como parte del callback OAuth/OIDC. Esta excepción se limita al callback estándar: el código se protege con PKCE `S256`, `state` y redirect URI exacto; se intercambia una sola vez; nunca se almacena, registra, copia a analítica, incluye en errores o expone a capas de producto.

La prohibición de credenciales en URLs significa concretamente:

- access tokens, refresh tokens, tokens de sesión y secretos nunca se transportan en URLs;
- códigos OTP y de recuperación nunca se persisten ni registran en URLs;
- el authorization code OAuth puede existir solo de forma transitoria en el callback registrado bajo las protecciones anteriores;
- parámetros del callback nunca determinan el `User`, hogar, rol o permiso.

Los magic links permanecen fuera del primer incremento. Email OTP se conserva únicamente como alternativa passwordless futura y deberá respetar la misma política de no registrar ni persistir códigos.

### Criterios de comparación

Las alternativas se evalúan por:

- compatibilidad oficial y vigente con Expo/React Native;
- uso de navegador externo, PKCE y deep links seguros;
- almacenamiento mediante Keychain/Keystore;
- verificación criptográfica desde Node.js/NestJS;
- separación entre identidad externa y `User` interno;
- correo y contraseña, OTP, proveedores sociales, passkeys y MFA;
- recuperación, rotación, reutilización, revocación y varios dispositivos;
- capacidad de exportar usuarios y reducir dependencia;
- privacidad, región, DPA, subprocessors y retención;
- costo actual y costo al crecer;
- experiencia local sin identidades reales ni secretos compartidos;
- dependencia de plataforma de datos;
- responsabilidad operativa, respuesta a abuso y velocidad de parches;
- compatibilidad con una futura aplicación web;
- incertidumbres que necesitan prueba técnica posterior.

## Investigación

La consulta se realizó el **2026-07-31** usando documentación oficial vigente de cada candidato, Expo, IETF/OpenID y OWASP. No se usaron blogs comparativos como base de la decisión, no se instalaron SDK y no se hicieron pruebas técnicas.

Los precios y límites son una fotografía de la fecha de consulta. Deberán verificarse nuevamente antes de contratar, implementar y llegar a beta, pues no constituyen un contrato del proveedor.

## Opciones consideradas

### Alternativa A: proveedor administrado de identidad

Un proveedor especializado administraría credenciales, login alojado, recuperación, MFA, sesiones y conexiones sociales. Copiloto Financiero conservaría su `User` interno, verificaría tokens en NestJS y mantendría toda autorización de hogares en el backend.

#### Candidato A1: Auth0

Evidencia favorable:

- guía oficial para Expo/React Native y SDK móvil de primera parte;
- Universal Login abre un navegador seguro del sistema y evita capturar contraseñas en la app;
- soporte de Authorization Code + PKCE para aplicaciones nativas;
- credentials manager con almacenamiento seguro y restauración/renovación;
- access tokens para una audiencia de API configurable;
- verificación estándar de JWT, issuer, audience y JWKS en Node.js;
- correo y contraseña, passwordless por email/SMS, Google, Apple y otras conexiones sociales;
- recuperación, verificación de correo, MFA y passkeys;
- refresh token rotation con detección automática de reutilización;
- revocación mediante Authentication API y Management API;
- enlace explícito de cuentas con advertencia de reautenticar ambas identidades;
- importación y exportación de perfiles, y mecanismos de migración;
- protocolos OAuth 2.0 y OpenID Connect que reducen acoplamiento del backend.

Límites y riesgos:

- el SDK React Native contiene código nativo y no funciona en Expo Go; exige development build;
- no se encontró un quickstart oficial específico para NestJS; una implementación futura deberá adaptar la validación oficial de Node.js a un guard y probarla sin alterar los límites de NestJS;
- plan, región, retención de logs, MFA, account linking y revocación granular deben revisarse como conjunto;
- algunas operaciones avanzadas de inventario o revocación de refresh tokens dependen del plan;
- Universal Logout y back-channel logout no equivalen a invalidar inmediatamente un access token ya emitido;
- existe dependencia del tenant, Universal Login, Management API y configuración del proveedor;
- una caída afecta login, renovación y recuperación, aunque la API pueda validar algunos access tokens con claves en caché;
- los datos de identidad y telemetría del proveedor requieren revisión de privacidad, DPA, subprocessors y región.

Costo observado:

- plan Free publicado de USD 0 hasta 25,000 usuarios activos mensuales;
- Essentials publicado desde USD 35/mes y Professional desde USD 240/mes para 500 MAU en la selección consultada;
- las capacidades y límites cambian por plan; account linking figura fuera de Free y la separación formal de entornos aparece en planes pagados;
- Enterprise y add-ons requieren cotización.

Desarrollo local:

- se usaría un tenant o ambiente exclusivamente de desarrollo, usuarios ficticios y redirect URIs de development build;
- unit tests no llamarían al tenant: usarían claves y tokens sintéticos controlados;
- integration tests limitadas usarían el ambiente de pruebas, nunca producción ni cuentas personales.

#### Candidato A2: Clerk

Evidencia favorable:

- SDK oficial específico para Expo;
- integración documentada con `expo-secure-store` mediante su token cache;
- objetos de sesión y dispositivo, cierre y revocación de sesiones;
- tokens de sesión breves y renovación administrada por SDK;
- verificación backend mediante `authenticateRequest()` o JWKS, con audience y clock skew configurables;
- correo, contraseña, email code/link, conexiones sociales, recuperación y MFA según plan;
- seguimiento y revocación de dispositivos incluidos en la tabla de precios consultada;
- exportación de datos declarada por el proveedor;
- experiencia de componentes móviles más integrada que un OIDC genérico.

Límites y riesgos:

- el modelo de sesiones y SDK es más específico de Clerk que un flujo de access/refresh tokens OAuth para una API propia;
- no se encontró un adaptador oficial específico para NestJS; `@clerk/backend` tendría que integrarse mediante un guard propio y una prueba posterior;
- el enlace automático de cuentas usa coincidencia de correo verificado; Copiloto no puede permitir que esa coincidencia una por sí sola dos `User` internos;
- passkeys y MFA no estaban incluidos en el plan gratuito consultado;
- verificar mediante clave pública fija reduce dependencia de red, pero exige un proceso correcto de rotación; usar JWKS agrega dependencia controlable;
- hay que comprobar que issuer, audience, subject, revocación y exportación satisfagan exactamente la política interna y no solo el comportamiento de componentes Clerk;
- sus organizaciones, roles e invitaciones no se usarían para hogares, por lo que parte de su propuesta B2B quedaría deliberadamente fuera.

Costo observado:

- Hobby publicado sin costo hasta 50,000 monthly retained users, con sesión fija de siete días;
- Pro publicado desde USD 20/mes con facturación anual, más excedentes; habilita MFA y duración configurable;
- el indicador MRU no equivale a MAU y requiere modelar costos con retención real.

Conclusión sobre A:

La alternativa administrada reduce la superficie operativa del MVP. Auth0 ofrece el límite más estándar entre proveedor, aplicación móvil y API; Clerk ofrece una experiencia Expo más integrada, pero su modelo de sesión y enlace por correo requiere más adaptación a las invariantes de Copiloto Financiero.

### Alternativa B: autenticación asociada a la plataforma de datos — Supabase Auth

Supabase Auth ofrece correo/contraseña, OTP, magic links, Google, Apple, MFA, sesiones, refresh token rotation, JWT y JWKS. Tiene guías oficiales de Expo/React Native y puede trabajar con un backend NestJS que valide tokens de forma estándar.

Ventajas:

- amplia cobertura funcional;
- JWT asimétricos y JWKS documentados;
- `iss`, `aud`, `sub` y `session_id` utilizables en una verificación estricta;
- refresh tokens de un solo uso con detección de reutilización;
- logout local, global y de otras sesiones;
- proyectos de desarrollo local con CLI y captura de correo;
- usuarios e identidades viven en Postgres y pueden exportarse;
- código abierto y alternativa de self-hosting.

Desventajas y riesgos:

- identidad, sesiones y el Postgres administrado pertenecen al mismo proyecto Supabase;
- adoptarlo antes de decidir persistencia puede acoplar autenticación, hosting, región, backups y migraciones;
- el quickstart básico de React Native usa AsyncStorage y no cumple esta decisión;
- otra guía cifra contenido en AsyncStorage usando una clave de SecureStore, pero este ADR prohíbe guardar tokens allí aun cifrados;
- se necesitaría validar un adaptador que almacene las credenciales exclusivamente en SecureStore;
- el enlace automático por correo verificado no puede gobernar la unión de `User` internos;
- no quedó confirmada en la documentación consultada una API de autoservicio para listar dispositivos y revocar selectivamente una sesión remota;
- passkeys continúan experimentales;
- SMTP de desarrollo no sirve para producción;
- algunas políticas de expiración requieren plan Pro.

Costo observado:

- Free publicado hasta 50,000 MAU;
- Pro publicado desde USD 25/mes con 100,000 MAU incluidos y excedentes;
- el costo abarca un proyecto/plataforma, no únicamente identidad.

Conclusión:

Es viable, pero no se recomienda cerrar conjuntamente proveedor de identidad y plataforma de datos antes del ADR de persistencia. Se mantiene como finalista secundario si el proyecto decide usar Supabase como plataforma integral y resuelve el almacenamiento exclusivamente seguro y la revocación por dispositivo.

### Alternativa C: autenticación propia en NestJS

Copiloto Financiero construiría y operaría:

- alta y verificación de credenciales;
- hash y actualización de contraseñas;
- verificación de correo;
- emisión y validación de access tokens;
- refresh tokens, rotación y detección de reutilización;
- recuperación de contraseña y factores;
- MFA y códigos de recuperación;
- sesiones por dispositivo y revocación;
- controles contra credential stuffing, enumeración y abuso;
- correo transaccional y entregabilidad;
- auditoría, rotación de claves y respuesta a incidentes.

Ventajas:

- control máximo de datos, UX, políticas y exportación;
- menor dependencia funcional de un proveedor externo;
- sesiones y revocación ajustadas exactamente al producto.

Desventajas y riesgos:

- máxima responsabilidad de seguridad y operación;
- alto costo continuo de parches, monitoreo, soporte y recuperación;
- riesgo elevado de errores en hashes, tokens, rotación, MFA, recuperación o mitigación de abuso;
- distrae al MVP de su dominio financiero;
- contraseñas y factores quedarían bajo custodia directa de Copiloto;
- una implementación parcial puede aparentar seguridad sin ofrecerla.

Conclusión:

Se rechaza como recomendación para el MVP. Solo debería reconsiderarse mediante un ADR sustituto si requisitos legales, de residencia, volumen o control hacen inviable un proveedor administrado y existe capacidad especializada de identidad y seguridad.

### Alternativa D: biblioteca autogestionada — Better Auth

Better Auth es una biblioteca/framework MIT embebida en la aplicación. Documenta Expo, PostgreSQL, sesiones, correo/contraseña, proveedores sociales, magic links, MFA, passkeys y revocación.

Ventajas:

- código abierto y sin licencia por usuario para el núcleo;
- datos y sesiones bajo control del producto;
- integración oficial con Expo y SecureStore;
- sesiones opacas persistidas, lista de sesiones y revocación individual o global;
- soporte de PostgreSQL y adaptadores de persistencia;
- menor trabajo criptográfico directo que construir todo desde cero.

Desventajas y riesgos:

- la guía NestJS depende de una integración mantenida por la comunidad;
- esa integración cambia el body parser global y requiere una prueba de compatibilidad con validación y OpenAPI;
- el modelo estándar no documenta claramente una familia access/refresh con rotación y detección de reutilización equivalente al BCP de OAuth;
- no quedó demostrada una política integrada de expiración absoluta más inactividad;
- debe confirmarse cómo se protege el token de sesión en reposo;
- los tokens OAuth almacenados requieren cifrado explícito;
- la vinculación implícita por correo debe deshabilitarse;
- MFA no cubre automáticamente todos los métodos sin configuración cuidadosa;
- passkeys nativas con Expo requieren verificación técnica;
- Copiloto operaría base de datos, correo, rate limiting, claves, abuso, parches e incidentes.

Conclusión:

Es una alternativa autogestionada creíble, pero no reduce suficientemente la responsabilidad operativa del MVP. Solo avanzaría si la revisión humana prioriza control de datos sobre operación administrada y un spike posterior resuelve sus incertidumbres.

### Alternativa E: servidor de identidad autohospedado — Keycloak

Keycloak ofrece OpenID Connect, OAuth, sesiones, recuperación, MFA, WebAuthn y administración. Expo podría integrarse mediante OIDC genérico y NestJS verificaría access tokens por issuer/JWKS.

Ventajas:

- protocolos estándar;
- control de datos y despliegue;
- funciones maduras de identidad y administración;
- menor acoplamiento al código de aplicación que una biblioteca embebida.

Desventajas y riesgos:

- agrega un servicio crítico, su base de datos, plano administrativo, backups y parcheo;
- no hay integración oficial específica para Expo y NestJS en la evidencia consultada;
- el equipo asume disponibilidad, hardening, upgrades y respuesta a incidentes;
- complejidad desproporcionada para el MVP actual.

Conclusión:

No se recomienda para el MVP. Puede reevaluarse si residencia, control o escala justifican operar una plataforma de identidad completa.

### Comparación resumida

| Criterio | A1: Auth0 | A2: Clerk | B: Supabase Auth | C: propia | D: Better Auth | E: Keycloak |
|---|---|---|---|---|---|---|
| Expo/React Native oficial | Alta; exige development build | Alta; SecureStore oficial | Alta, pero ejemplos de storage requieren cuidado | A construir | Alta; validar integración real | OIDC genérico |
| Verificación en API | OAuth/OIDC, JWT, audience y JWKS | SDK/JWKS propietario | JWT/JWKS estándar | Totalmente propia | Sesión propia/JWT opcional | OAuth/OIDC y JWKS |
| Rotación/reutilización | Documentada | Renovación administrada; modelo distinto | Documentada | A construir | No equivalente claramente documentado | Configurable/operada |
| Revocación por dispositivo | Posible; revisar plan/API | Documentada | Granularidad incierta | A construir | Documentada para sesiones | Posible; operación propia |
| No custodiar contraseñas | Sí | Sí | Sí | No | No; la app las custodia | No; el despliegue las custodia |
| Separación de la plataforma de datos | Alta | Alta | Baja/media | Alta | Media | Alta |
| Portabilidad | Media/alta por estándares y exportación | Media | Media/alta por Postgres/código abierto | Alta en teoría | Alta en teoría | Alta en teoría |
| Carga operativa | Baja/media | Baja/media | Media | Muy alta | Alta | Muy alta |
| Riesgo de enlace por correo | Controlable con flujo explícito | Alto si se acepta auto-link | Alto si se acepta auto-link | Depende del diseño | Debe deshabilitarse | Depende de configuración |
| Costo inicial publicado | Free hasta 25k MAU | Free hasta 50k MRU | Free hasta 50k MAU | Infraestructura y equipo | Infraestructura y equipo | Infraestructura y equipo |
| Adecuación al MVP | Alta, condicionada | Alta, condicionada | Media, condicionada | Baja | Media/baja | Baja |

## Decisión

Se selecciona la **Alternativa A: proveedor administrado de identidad**, con **Auth0 como proveedor de identidad para el MVP**.

La decisión no se basa en popularidad. Auth0 ofrece en la evidencia consultada el límite más claro entre:

- una aplicación Expo que actúa como cliente público;
- un authorization server OAuth/OIDC;
- una API NestJS que valida access tokens destinados a su audience;
- una identidad externa estable por `issuer + subject`;
- un `User` interno independiente;
- autorización y hogares administrados exclusivamente por Copiloto Financiero.

Clerk, Supabase Auth, Better Auth, autenticación propia y Keycloak se conservan únicamente como alternativas evaluadas. No son decisiones activas del MVP.

La aceptación de esta decisión:

- no autoriza contratar un plan;
- no autoriza crear un tenant;
- no autoriza instalar un SDK;
- no autoriza implementar ni configurar autenticación;
- no inicia Fase 2;
- no resuelve ADR-006.

### Reglas de la estrategia aceptada

1. La app móvil usará Authorization Code + PKCE `S256`, `state` y `nonce` mediante navegador seguro del sistema y redirect URI exacto.
2. La app se registrará como cliente nativo público y no recibirá un client secret.
3. NestJS aceptará únicamente access tokens emitidos para la audience de Copiloto Financiero; no aceptará ID tokens como credencial de API.
4. El servidor validará firma, allowlist de algoritmos, issuer exacto, audience, expiración y claims mínimos antes de confiar en `sub`.
5. `issuer + subject` se mapeará a un `User` interno mediante un proceso controlado. El correo será un atributo mutable y verificable, no la clave del usuario.
6. El móvil conservará el access token en memoria siempre que sea posible. Toda credencial que el SDK necesite persistir se guardará exclusivamente en Keychain/Keystore mediante su credentials manager o una abstracción de SecureStore revisada.
7. La renovación usará refresh token rotation con detección de reutilización. Una renovación por vez coordinará todas las solicitudes concurrentes.
8. Se ofrecerán cierre del dispositivo actual, cierre global, refresh token rotation, detección de reutilización y soporte de varios dispositivos. La revocación remota granular no se presumirá disponible en todos los planes.
9. La API no usará roles, organizaciones, hogares ni metadata del proveedor para autorizar recursos financieros.
10. La creación de un `User` interno no creará por sí misma un hogar ni una membresía.
11. El enlace de identidades será explícito, reautenticado, auditable y no se basará solamente en correo coincidente.
12. La recuperación de acceso, cambio de contraseña o reporte de dispositivo perdido deberá poder revocar sesiones según la política aprobada.
13. Los valores sensibles serán redactados antes de logs, telemetría, analítica, errores o prompts.
14. El proveedor deberá permitir exportar identidades y mantener una ruta documentada de migración.
15. La futura aplicación web tendrá un cliente y una política de sesión propios; no copiará el almacenamiento móvil a localStorage.

### Métodos iniciales y evolución

El primer incremento del MVP habilitará:

- correo y contraseña sin custodia de contraseñas por Copiloto;
- Google mediante su conexión oficial.

Apple se incorporará cuando se prepare la distribución iOS y resulte aplicable. Email OTP puede evaluarse como opción passwordless futura. Passkeys, MFA avanzado, SMS, magic links y conexiones enterprise quedan preparados para evolución, pero no bloquean la primera implementación; magic links están expresamente fuera del primer incremento.

La recuperación de correo deberá usar respuestas no enumerables. El plan elegido deberá cubrir refresh token rotation, cierre del dispositivo actual y cierre global, varios dispositivos, ambientes separados, exportación de usuarios y validación JWT por issuer/audience/JWKS.

### Decisiones y evidencia por hito

#### A. Resueltas para aceptar ADR-005

- proveedor: Auth0 administrado para el MVP;
- protocolo: OAuth 2.0/OpenID Connect con Authorization Code + PKCE `S256`;
- callback: authorization code efímero permitido únicamente en el redirect registrado bajo la política aprobada;
- identidad: `issuer + subject` externo estable vinculado de forma controlada a un `User` interno;
- almacenamiento: credentials manager con Keychain/Keystore; nunca AsyncStorage o localStorage;
- límites: autenticación y sesión en ADR-005; autorización, hogares, roles y visibilidad en ADR-006.

#### B. Requeridas antes de implementar autenticación real

- crear un tenant de desarrollo separado;
- registrar la application/client móvil como cliente público y configurar la API;
- fijar audience, issuer y redirect URIs exactos por ambiente;
- habilitar y comprobar refresh token rotation y detección de reutilización;
- definir la política inicial de expiración absoluta, inactividad, access token y clock skew con justificación y pruebas;
- preparar un development build, porque Expo Go no constituye evidencia suficiente;
- confirmar las capacidades del plan para cierre actual, cierre global y revocación granular; si son insuficientes, decidir durante la historia de sesiones de Fase 2 si se necesita un registro interno futuro, sin diseñarlo en este ADR.

#### C. Requeridas antes de beta con datos reales

- revisar y aprobar DPA, región, residencia, subprocessors y retención;
- validar eliminación y exportación end-to-end;
- modelar costos a escala y funciones incluidas en el plan;
- aprobar la política definitiva de MFA y recuperación avanzada;
- probar recuperación ante pérdida de todos los factores y respuesta a dispositivos robados;
- crear runbooks de rotación de claves, indisponibilidad, revocación y respuesta a incidentes.

## Flujo de autenticación

### Inicio de sesión

1. La persona inicia autenticación desde la aplicación móvil.
2. La app genera los valores transaccionales del flujo y abre el navegador seguro del sistema hacia el proveedor, con redirect exacto y PKCE.
3. El proveedor verifica la identidad mediante el método habilitado y ejecuta verificación, MFA o recuperación cuando corresponda.
4. La app recibe las credenciales móviles a través del SDK. El authorization code efímero se intercambia usando PKCE y no se conserva, registra ni expone a capas de producto.
5. El credentials manager guarda únicamente las credenciales que necesiten persistencia en Keychain/Keystore. La app mantiene en memoria el access token de uso inmediato.
6. La app llama a NestJS con `Authorization: Bearer <access token>` sobre TLS. No envía un `userId`, correo o `householdId` como prueba de identidad.
7. NestJS verifica criptográficamente firma, algoritmo, issuer, audience, expiración y claims necesarios usando la configuración y JWKS aprobados.
8. El servidor deriva la identidad externa estable de `issuer + subject` y construye un contexto externo autenticado mínimo.
9. Un servicio de aplicación controlado busca el vínculo a un `User` interno. Si no existe y la política de alta lo permite, crea un `User` en estado de onboarding sin hogar ni permisos implícitos.
10. La autorización posterior obtiene membresías y permisos internos según ADR-006. Renovación, revocación y cierre de sesión siguen los flujos siguientes.

### Renovación

1. Antes de una llamada, el cliente comprueba si el access token sigue siendo utilizable con un margen acotado.
2. Si requiere renovación, un coordinador single-flight inicia una sola operación; las solicitudes concurrentes esperan el mismo resultado.
3. El proveedor valida el refresh token o mecanismo equivalente, rota la credencial y devuelve un nuevo par.
4. El credentials manager reemplaza de forma atómica la credencial segura anterior.
5. Una solicitud que recibió `401` por expiración puede renovarse y reintentarse una sola vez si es seguro. Un `401` persistente termina la sesión.
6. Reutilización detectada, revocación, cuenta deshabilitada o error no recuperable obliga a limpiar credenciales y pedir autenticación de nuevo.

No se producirán bucles de renovación ni múltiples exchanges paralelos. Una pérdida de conectividad no se confundirá con una revocación.

### Cierre de sesión local

1. La app bloquea nuevas solicitudes autenticadas y cancela las que estén en vuelo.
2. Invalida el estado en memoria y limpia caches con datos sensibles.
3. Solicita al proveedor revocar el refresh token/grant cuando la conectividad lo permite.
4. Limpia las credenciales de Keychain/Keystore aunque la revocación remota falle.
5. Intenta cerrar la sesión del navegador del proveedor cuando la UX aprobada lo requiera.
6. Regresa a un estado no autenticado sin conservar el `User` como prueba de sesión.

La limpieza local es inmediata. Si no hay red, solo queda garantizado el cierre local y la revocación remota se considera **no confirmada**. Nunca se conservará el refresh token en una cola para reintentar. Un reintento automático solo será posible si ya existe un handle de sesión no secreto y revocable desde backend/proveedor; de lo contrario, la persona deberá revocar esa sesión desde otro dispositivo o usar cierre global al recuperar conectividad.

### Revocación remota, robo o pérdida de dispositivo

1. La persona se autentica desde otro dispositivo o por el flujo de recuperación del proveedor.
2. Selecciona la sesión perdida o solicita cerrar todas las sesiones.
3. El backend/proveedor revoca el grant, refresh token o sesión correspondiente cuando el plan y la representación disponible permiten seleccionar esa sesión; en caso contrario ofrece cierre global.
4. La sesión perdida deja de renovar. El access token actual solo deja de funcionar inmediatamente si existe una comprobación online adicional; de otro modo termina al expirar.
5. Acciones sensibles pueden consultar un estado interno de sesión o bloqueo cuando el riesgo justifique invalidación inmediata.
6. La acción se audita sin token, IP completa innecesaria ni datos de autenticación.

La política deberá distinguir “este dispositivo”, “otros dispositivos” y “todos los dispositivos”. El nombre visible de un dispositivo será descriptivo y modificable; no se usará fingerprinting invasivo como identidad de seguridad.

### Recuperación

- La recuperación la inicia el proveedor mediante un mensaje uniforme que no confirma si la cuenta existe.
- Un cambio de contraseña o factor debe aplicar la política aprobada de revocación.
- Recuperar el mismo correo no autoriza a reclamar un `User` con otro `subject`.
- Si la persona conserva otra identidad ya vinculada, podrá autenticarse por ella; añadir o recuperar una identidad requerirá reautenticación reciente.
- La asistencia manual futura deberá verificar identidad mediante un procedimiento auditable y nunca mediante datos financieros fáciles de adivinar.

## Identidad externa e interna

### Relación conceptual

Este ADR no define tablas. Define una relación lógica que la fase posterior deberá representar sin acoplarla al esquema del proveedor:

| Dato conceptual | Uso | Regla |
|---|---|---|
| `provider` | Adaptador/configuración, por ejemplo Auth0 | No es por sí solo una identidad |
| `issuer` | Autoridad exacta que emitió el token | Parte de la clave estable; no se acepta un issuer enviado libremente |
| `subject` | Identificador estable del usuario dentro del issuer | Parte de la clave estable; no se muestra como dato de negocio |
| `User` interno | Identidad estable de Copiloto Financiero | Sobrevive a cambios de correo y puede vincular varias identidades comprobadas |
| correo | Contacto y atributo de login | Mutable, no necesariamente único global, con verificación separada |
| estado de verificación | Evidencia del proveedor para un atributo | No concede membresía ni acceso financiero |
| estado interno | Activo, bloqueado, pendiente de eliminación u otro estado futuro | Se aplica además de validar el token |
| sesión/dispositivo | Instancia revocable de acceso | No es el `User` y no contiene permisos de hogar |

La restricción lógica de unicidad será `issuer + subject`. Un `subject` idéntico de dos issuers distintos representa dos identidades distintas hasta que un flujo seguro las enlace al mismo `User`.

### Cambios y conflictos

#### Cambia el correo

- se actualiza el atributo y su estado de verificación después de evidencia del proveedor;
- no cambia `issuer + subject` ni el `User` interno;
- no cambia membresías, propiedad, roles ni historial;
- el cambio se audita como acción sensible sin registrar valores completos innecesarios.

#### Se enlaza otro método de acceso

- la persona parte de una sesión válida;
- se exige autenticación reciente de la identidad actual y prueba de control de la nueva;
- el backend verifica que la identidad nueva no esté vinculada a otro `User`;
- una coincidencia de correo solo puede sugerir el flujo; nunca ejecutarlo;
- el enlace no mezcla, transfiere ni elimina datos financieros automáticamente.

#### Se elimina la identidad del proveedor

- el vínculo externo queda inutilizable u orphaned según la política futura;
- el `User` y sus datos no se eliminan automáticamente;
- recrear una cuenta con el mismo correo y otro `subject` no recupera el vínculo anterior;
- exportación/eliminación completa se coordinará con la política futura de datos y ADR-018.

#### Se deshabilita una cuenta

- NestJS rechazará el acceso si el estado interno está bloqueado aunque el token sea criptográficamente válido;
- se solicitará revocación de sesiones al proveedor;
- errores públicos no revelarán la causa exacta a terceros;
- desbloquear requerirá un proceso auditable.

#### Se intenta unir identidades

- se rechaza cualquier unión iniciada solo con correo o claims aportados por el cliente;
- se prueba control de las dos identidades;
- conflictos con dos `User` internos requieren un procedimiento de soporte y no una fusión automática;
- la operación no se habilitará hasta definir su auditoría y reversibilidad.

#### El proveedor está temporalmente indisponible

- la API puede validar access tokens no vencidos mientras conserva una clave pública confiable dentro de la política de caché;
- login, refresh, recuperación, MFA y revocación online pueden no estar disponibles;
- un token vencido, issuer desconocido, firma no verificable o `kid` no resoluble falla de forma cerrada;
- no existe contraseña maestra, bypass local ni token propio de emergencia;
- la app distingue indisponibilidad temporal de credenciales inválidas y ofrece reintento seguro.

## Tokens y sesiones

### Tipos de credencial

| Credencial | Finalidad | Persistencia permitida | Validación/limitación |
|---|---|---|---|
| Authorization code | Intercambio único del callback OAuth | Nunca se persiste | Permitido transitoriamente en el callback registrado; PKCE `S256`, `state` y redirect exacto |
| Access token | Llamar a la API de Copiloto | En memoria; si el SDK exige persistencia, solo almacenamiento seguro | Firma, algoritmo, `iss`, `aud`, `exp` y claims mínimos |
| ID token | Comunicar el resultado OIDC al cliente | Solo lo que gestione de forma segura el SDK | Nunca autentica la API |
| Refresh token | Renovar access tokens | Keychain/Keystore exclusivamente | Rotación, detección de reutilización, expiración y revocación |
| Cookie del proveedor | Sesión en Universal Login | Controlada por el navegador/proveedor | No se copia a la app ni a NestJS |
| OTP o código de recuperación | Prueba de un solo uso | No se persiste después de consumir | Nunca en logs, analítica, prompts ni URLs persistidas o registradas |

### Expiración y renovación

La política deberá configurar, no codificar de forma dispersa:

- access tokens de vida corta proporcional al riesgo y costo de renovación;
- refresh tokens rotatorios con expiración absoluta finita;
- expiración por inactividad;
- límite absoluto de sesión que no se extienda indefinidamente con actividad;
- ventana de tolerancia mínima para concurrencia de rotación;
- clock skew acotado y observable;
- reautenticación reciente para cambios sensibles;
- revocación ante reutilización, recuperación, bloqueo o incidente.

No se fijan minutos o días arbitrarios en este ADR. Los valores iniciales concretos deberán definirse antes de implementar sesiones, considerando el plan de Auth0, el riesgo aceptado, la experiencia móvil y pruebas con dispositivos reales. La configuración y sus límites quedarán cubiertos por pruebas.

### Validación del access token

NestJS deberá:

1. extraer un único bearer token del header esperado;
2. imponer tamaño y formato razonables antes de procesarlo;
3. seleccionar solo algoritmos asimétricos permitidos por configuración;
4. resolver la clave por `kid` desde JWKS del issuer previamente configurado;
5. verificar firma antes de confiar en claims;
6. comprobar `iss` exacto, incluyendo normalización prohibida o barra final según el proveedor;
7. comprobar que `aud` contiene la audience exacta de la API;
8. comprobar `exp`, `nbf` y coherencia temporal con skew acotado;
9. exigir `sub` no vacío y claims de tipo de token/sesión cuando apliquen;
10. rechazar token de otro tenant, entorno, cliente, audience, issuer o tipo;
11. resolver `issuer + subject` al `User` interno;
12. verificar estados internos de bloqueo o sesión cuando la política lo requiera.

Decodificar un JWT sin verificarlo no autentica. Tampoco se aceptará cambiar de issuer dinámicamente a partir del contenido del token.

### JWKS, caché y rotación de claves

- La URL de discovery/JWKS provendrá de un issuer allowlisted en configuración del servidor.
- La descarga usará HTTPS, límites de tamaño, timeout y validación del contenido.
- Las claves se cachearán con TTL acotado y respetando rotación; no se descargará JWKS en cada request.
- Un `kid` desconocido puede provocar una sola actualización controlada, con protección contra stampede y rate abuse.
- Si sigue sin resolverse, la autenticación falla.
- Una clave conocida en caché puede seguir validando hasta el límite de stale autorizado; ese límite se definirá y observará.
- La rotación se probará antes de producción y tendrá runbook.

### Múltiples dispositivos y revocación

- Cada instalación/autorización tendrá una sesión o grant independiente cuando el proveedor lo permita.
- La app no asumirá que cerrar la pantalla o borrar estado visual revoca el servidor.
- Cerrar “este dispositivo” revoca su credencial de renovación y limpia SecureStore.
- Cerrar “otro dispositivo” requiere una sesión autenticada y una operación server-side; el cliente no aporta un token de la sesión remota.
- Cerrar “todas” revoca grants/sesiones disponibles y fuerza reautenticación tras expirar cualquier access token residual.
- La revocación remota granular se implementará con las capacidades del plan Auth0 seleccionado cuando sean suficientes o mediante un registro interno futuro de sesiones/dispositivos.
- Este ADR no diseña ese registro. La decisión concreta se tomará durante la historia de sesiones de Fase 2, antes de prometer administración granular de dispositivos.
- Si se ofrece UI de sesiones en el futuro, mostrará información mínima y no usará fingerprinting invasivo.

## Aplicación móvil

### Almacenamiento seguro

- Se usará el credentials manager oficial del proveedor si demuestra que guarda en iOS Keychain y Android Keystore.
- Si se requiere una abstracción propia, usará `expo-secure-store` o equivalente compatible con Expo.
- AsyncStorage, localStorage, SQLite sin cifrado, archivos, variables globales persistidas y backups no controlados quedan prohibidos para credenciales.
- El access token se mantendrá en memoria cuando el SDK lo permita.
- Al cerrar sesión se borrarán credenciales, perfil sensible, caches, estado de navegación y requests pendientes.
- La app siempre revalidará la sesión con el servidor/proveedor: en iOS Keychain puede sobrevivir una reinstalación y en Android el almacenamiento puede desaparecer al desinstalar.
- Si biometría protege una credencial y cambia el enrolamiento biométrico, la app tratará la credencial como inaccesible y pedirá autenticación; no intentará recuperarla por un fallback inseguro.

### Restauración y pantalla inicial

Al iniciar, la app tendrá un estado explícito `restoring` o equivalente:

1. muestra una pantalla de carga neutra sin datos financieros;
2. consulta el credentials manager;
3. comprueba si las credenciales son utilizables o renovables;
4. resuelve el `User` interno mediante la API;
5. solo entonces muestra contenido autenticado;
6. si falla por revocación o expiración, limpia credenciales y muestra acceso;
7. si falla por red, presenta estado offline/indeterminado sin afirmar que la sesión es válida.

No habrá un destello de contenido privado antes de terminar la restauración.

### Token vencido y renovación concurrente

- El cliente REST pedirá una credencial al coordinador de sesión, no leerá directamente SecureStore en cada request.
- Solo una renovación podrá ejecutarse por sesión a la vez.
- Solicitudes concurrentes compartirán la promesa/resultado.
- Tras renovar, una request podrá reintentarse una sola vez.
- Una respuesta `401` no se convertirá en un bucle ni se tratará como `403`.
- Al cerrar sesión, el coordinador abortará requests y descartará respuestas tardías.
- Una futura escritura financiera conservará además su propia idempotencia; renovar o reintentar autenticación nunca sustituirá esa protección.

### Conectividad

- Perder conectividad no cierra automáticamente la sesión ni demuestra que siga vigente.
- Mientras no pueda validarse o renovarse, la app mostrará un estado seguro y no iniciará acciones sensibles.
- No se promete operación offline en este ADR.
- Errores de red no borrarán credenciales válidas de inmediato; revocación o `invalid_grant` sí requerirán reautenticación.

### Enlaces profundos y entorno Expo

- Redirect URIs se registrarán exactamente, sin comodines amplios.
- Producción preferirá app/universal links reclamados cuando el proveedor y las plataformas lo permitan; un esquema privado se limitará a los usos aprobados y siempre con PKCE.
- La app comprobará `state`, `nonce`, origen esperado y que exista una transacción pendiente.
- Ningún parámetro del deep link decidirá `User`, hogar, rol o permiso.
- Expo Go no sirve como evidencia final de OAuth/OIDC porque no ofrece un esquema estable y no contiene todos los módulos nativos.
- Las pruebas reales usarán un development build con identificadores y callbacks de desarrollo separados de producción.

Este ADR no configura development builds, EAS ni pantallas.

## API NestJS

### Límite de autenticación

Un guard o middleware futuro hará únicamente autenticación y construcción de contexto. No implementará roles de hogar.

El contexto autenticado interno podrá contener conceptualmente:

- referencia al `User` interno;
- `issuer` y `subject` ya verificados;
- identificador de sesión verificado cuando exista;
- instante de autenticación y métodos/factores solo cuando sean necesarios;
- audience y scopes técnicos mínimos;
- correlation ID no sensible.

No contendrá el token crudo, secretos, claims arbitrarios ni `householdId` como autorización.

### Separación de responsabilidades

1. El adaptador de proveedor verifica la credencial.
2. El resolver de identidad traduce `issuer + subject` a `User`.
3. El guard expone un contexto autenticado mínimo.
4. ADR-006 definirá la política que resuelve membresía, hogar, rol y visibilidad.
5. El servicio de aplicación aplicará autorización y reglas de negocio.

Un token válido puede recibir `401` si la sesión o cuenta están revocadas y `403` si el `User` autenticado carece de permiso. El formato público seguirá ADR-001 y ADR-007 con `code` estable, `message` localizable y metadata mínima.

### Errores, enumeración y abuso

- No se devolverán stack traces, claims, issuer interno, motivo criptográfico, correo, existencia de usuario o estado de invitación.
- Errores de inicio, recuperación e invitación tendrán respuestas uniformes cuando revelar diferencias permita enumeración.
- `Authorization` y cookies se redactarán en el primer límite de observabilidad.
- Rate limiting, protección contra credential stuffing y límites de recuperación se configurarán antes de exponer el flujo; el proveedor no elimina los límites propios de la API.
- Se auditarán alta, enlace/desenlace, recuperación, cambio de factores, revocación, bloqueo y aceptación de invitación sin registrar credenciales.

### Pruebas mínimas futuras

La implementación no podrá considerarse terminada sin probar:

- token válido para issuer y audience correctos;
- token ausente;
- token vencido y todavía no válido;
- firma manipulada;
- algoritmo no permitido o `none`;
- issuer correcto con audience incorrecta;
- audience correcta con issuer de otro tenant o ambiente;
- ID token presentado como access token;
- `kid` desconocido y rotación de claves;
- clock skew dentro y fuera del límite;
- subject sin vínculo y alta controlada;
- `User` bloqueado;
- sesión revocada y access token residual;
- renovación concurrente y reutilización detectada;
- proveedor/JWKS temporalmente indisponible;
- respuestas no enumerables;
- redacción de logs y errores;
- intento de usar `userId`, correo o `householdId` del cliente como identidad;
- intento de aceptar invitación sin sesión.

## Invitaciones al hogar

ADR-005 establece únicamente el límite de autenticación:

- una invitación no equivale a autenticación y no sustituye una sesión;
- aceptar una invitación exige primero un `User` autenticado;
- el mecanismo de invitación deberá ser opaco, temporal, revocable y de uso único;
- no contendrá permisos confiables decididos por el cliente.

El transporte concreto de la invitación, su UX y la creación de `HouseholdMembership`, incluidos estados, roles y visibilidad, se resolverán exclusivamente en ADR-006.

## Futura aplicación web

- El proveedor deberá permitir registrar un cliente web separado.
- La aplicación web no almacenará refresh tokens en localStorage.
- Se evaluará un backend-for-frontend con cookies `HttpOnly`, `Secure` y `SameSite`, o el patrón recomendado por el proveedor y el modelo de amenazas vigente.
- Los clients móviles y web tendrán audiences, redirect URIs, orígenes y políticas explícitas.
- Compartir `User` interno se hará por identidades verificadas, no por copiar sesiones.
- La arquitectura web concreta requerirá revisión al entrar en alcance; este ADR solo preserva compatibilidad.

## Desarrollo local y pruebas

### Ambientes

- desarrollo, integración/staging y producción usarán tenants o ambientes separados;
- los redirect URIs, audiences, issuers y claves no se compartirán entre producción y pruebas;
- los usuarios serán ficticios y claramente identificables como pruebas;
- ninguna persona colaboradora compartirá contraseña, refresh token, OTP o sesión;
- un client ID/publishable key podrá documentarse solo si el proveedor lo clasifica como público; secretos administrativos nunca estarán en `EXPO_PUBLIC_*`;
- `.env.example` futuro contendrá únicamente nombres y ejemplos genéricos;
- archivos locales con valores reales estarán ignorados y fuera del repositorio.

### Niveles de prueba

| Nivel | Fuente de identidad | Objetivo |
|---|---|---|
| Unitario | Issuer/JWKS y tokens sintéticos, deterministas y locales | Guard, claims, errores, clock y redacción sin red |
| Integración | Authorization server controlado o tenant de pruebas | Rotación, revocación, alta y vínculo interno |
| E2E móvil | Usuarios ficticios en development build | Browser, callback, SecureStore, restauración, renovación y logout |
| Resiliencia | Fallos simulados de red, JWKS y proveedor | Fail closed, caché, recuperación y UX |
| Seguridad | Tokens manipulados y casos adversariales | Confusión de token, enumeración, replay, deep link y fuga |

No se agregará un “modo sin autenticación” a builds distribuibles. Un mock solo podrá sustituir el adaptador en pruebas y nunca aceptar identidad libre enviada por el cliente.

## Consecuencias

### Positivas

- Copiloto no custodia contraseñas ni implementa recuperación/MFA desde cero.
- Expo y NestJS se relacionan mediante estándares y un contrato verificable.
- La identidad externa permanece separada del `User`, hogar y datos financieros.
- Cambiar correo o añadir un método no cambia automáticamente propiedad o historial.
- Rotación, detección de reutilización y revocación limitan sesiones robadas.
- Keychain/Keystore reduce exposición frente a almacenamiento móvil común.
- La API puede validar tokens sin confiar en identificadores del cliente.
- Se conserva una ruta futura de web, exportación y migración.
- ADR-006 puede diseñar autorización sin depender de roles del proveedor.

### Negativas

- Existe costo y dependencia de un proveedor crítico.
- El desarrollo móvil real requiere development builds, no solo Expo Go o Expo Web.
- Configurar Universal Login, redirects, enlaces sociales, correo y tiendas móviles añade trabajo operativo.
- La revocación de refresh token deja una ventana residual del access token.
- Funciones necesarias pueden cambiar de precio o plan.
- El mapeo externo/interno, enlace de identidades y soporte de recuperación siguen siendo responsabilidad de Copiloto.
- La indisponibilidad del proveedor puede impedir login y renovación.
- Migrar de proveedor obligaría a reautenticar sesiones y quizá algunos métodos.

### Riesgos

- almacenar por error tokens en AsyncStorage, logs, crash reports o analítica;
- aceptar un ID token o token de otro audience/issuer;
- usar el correo como identidad y reasignar datos tras un cambio o reciclaje;
- auto-link inseguro de identidades;
- deep link interceptado o callback demasiado amplio;
- múltiples renovaciones que disparen detección de reutilización;
- considerar logout local como revocación remota;
- creer que revocar refresh invalida access tokens de inmediato;
- cachear JWKS indefinidamente o descargarlo en cada request;
- aceptar claims de roles/organizaciones como hogares;
- habilitar magic links prematuramente o filtrar credenciales mediante callbacks;
- depender de una función no incluida en el plan contratado;
- no poder recuperar MFA después de perder todos los factores;
- una caída del proveedor o rotación de claves bloqueará acceso;
- una exportación insuficiente aumentará lock-in;
- exposición de datos de identidad fuera de la región aprobada;
- invitación usada como sustituto de autenticación.

### Mitigaciones

- wrapper único de credenciales y pruebas que prohíban storage inseguro;
- allowlist fija de issuer, audience, algoritmos y tipos de token;
- unicidad por `issuer + subject` y prohibición de merge por correo;
- linking explícito con reautenticación de ambas identidades;
- PKCE `S256`, navegador externo, `state`, `nonce` y redirects exactos;
- coordinador single-flight y ventana de rotación mínima;
- acciones diferenciadas de limpieza local y revocación server-side;
- access token corto y chequeo de estado para acciones de riesgo cuando se justifique;
- caché JWKS acotada, refresh controlado y runbook de rotación;
- pruebas negativas de claims de organización/hogar;
- mantener magic links fuera del primer incremento y probar redacción de callbacks;
- revisión contractual y de precios antes de implementar y nuevamente antes de beta;
- recuperación de factores y cierre global probados con usuarios ficticios;
- exportación periódica verificable y plan de migración;
- revisión de DPA, región, subprocessors y borrado;
- invitación opaca, expirable, revocable y siempre posterior a autenticación.

### Trabajo derivado

Solo después de aceptar este ADR y autorizar expresamente una tarea de Fase 2 se deberá:

1. crear y configurar ambientes del proveedor;
2. registrar clientes móvil y API con redirects y audiences exactos;
3. documentar variables genéricas y secretos fuera del repositorio;
4. instalar el SDK móvil y la librería de verificación seleccionados;
5. implementar el coordinador de sesión y almacenamiento seguro;
6. implementar el guard/adaptador de NestJS y contexto autenticado;
7. representar el vínculo `issuer + subject` con el `User` interno;
8. definir sesiones/dispositivos internos si el proveedor no cubre la revocación requerida;
9. implementar alta, recuperación, logout y revocación;
10. crear pruebas unitarias, integración, E2E móvil y seguridad;
11. documentar runbooks de pérdida de dispositivo, proveedor caído y rotación de claves;
12. actualizar OpenAPI y contratos según ADR-007;
13. revisar ADR-006 por separado antes de crear hogares, invitaciones o membresías.

Nada de este trabajo se ejecuta mediante este ADR documental.

### Trabajo diferido expresamente a ADR-006

- modelo y estados de `HouseholdMembership`;
- roles y matriz de permisos;
- recursos personales, compartidos y su visibilidad;
- selección y validación de `householdId`;
- invitación, aceptación y creación transaccional de membresía;
- aislamiento multi-hogar, prevención de IDOR y posible RLS;
- quién puede invitar, revocar, salir o eliminar integrantes;
- autorización de exportación o eliminación compartida;
- auditoría específica de cambios de membresía.

## Validación

### Validación documental realizada

- Fase 1 aparece cerrada y Fase 2 no iniciada.
- ADR-001, ADR-005 y ADR-007 aparecen Aceptados.
- ADR-006 está Aceptado y su implementación queda diferida a una tarea posterior.
- Auth0 es el proveedor vigente; los demás candidatos son alternativas evaluadas.
- Authorization Code + PKCE `S256` y su callback efímero están permitidos bajo la política aprobada.
- Correo y contraseña, y Google, son los métodos iniciales; magic links quedan fuera del primer incremento.
- Autenticación, sesión, autorización, membresía e invitación están separadas.
- `issuer + subject`, no el correo, define la identidad externa estable.
- Solo un access token dirigido a la audience de la API autentica NestJS; un ID token no sirve para ese fin.
- Keychain/Keystore es obligatorio y AsyncStorage/localStorage quedan prohibidos para credenciales.
- Renovación, rotación, reutilización, cierre actual, cierre global, varios dispositivos y pérdida de dispositivo están contemplados sin presumir revocación granular en todos los planes.
- La invitación no sustituye una sesión autenticada.
- Privacidad, compliance y operación requeridos antes de beta siguen registrados.
- No se definen tablas, roles, pantallas ni código.

### Escenarios futuros de implementación

1. Un token válido para la API resuelve el mismo `User` después de cambiar el correo.
2. Un token de issuer, audience o entorno distinto recibe `401` sin filtrar detalles.
3. Dos identidades con el mismo correo no se unen sin prueba de control de ambas.
4. Diez requests concurrentes con token vencido producen una sola renovación.
5. Reutilizar un refresh token rotado revoca la familia y exige autenticación.
6. Cuando exista revocación granular aprobada, revocar un dispositivo no cierra los demás; cierre global sí impide renovar todos.
7. Reiniciar la app restaura desde almacenamiento seguro sin mostrar contenido antes de validar.
8. Cerrar sesión cancela requests, limpia estado sensible y revoca cuando hay red.
9. Una caída del proveedor permite solo la validación limitada aprobada y nunca un bypass.
10. Una invitación válida sin sesión no crea membresía.
11. Un `householdId` enviado por el cliente no concede acceso.
12. Logs, errores, analítica y prompts no contienen credenciales ni códigos.

## Plan de adopción o migración

1. Registrar ADR-005 como **Aceptado** y sincronizar los documentos de estado.
2. Mantener ADR-006 como decisión documental separada; no iniciar Fase 2 como parte de este ADR.
3. Autorizar Fase 2 únicamente en otra tarea posterior y completar las decisiones de categoría B aplicables.
4. Implementar primero un flujo de autenticación no financiero con usuarios ficticios.
5. Validar development build, rotación, reutilización, cierre actual/global, recuperación y pérdida de dispositivo antes de hogares.
6. Decidir durante la historia de sesiones si las capacidades del plan de Auth0 bastan para revocación granular o si hará falta un registro interno futuro.
7. Agregar hogares y membresías solo después de aplicar ADR-006.
8. Antes de beta, completar la categoría C y probar exportación, eliminación y recuperación operativa.

Si se cambia de proveedor después de implementar:

- no se reescribirán los IDs de `User` internos;
- se exportarán identidades según el procedimiento aprobado;
- se habilitará temporalmente más de un issuer allowlisted durante una migración controlada;
- cada nueva identidad se vinculará mediante autenticación comprobada, nunca por correo solamente;
- las sesiones anteriores se revocarán y las personas deberán reautenticarse;
- se medirá adopción sin registrar datos sensibles;
- el proveedor anterior se retirará solo después de verificar accesos, exportación y eliminación;
- un ADR sustituto documentará la migración y sus riesgos.

## Referencias oficiales

Todas las fuentes externas se consultaron el **2026-07-31**.

### Estándares y seguridad

- [RFC 8252: OAuth 2.0 for Native Apps](https://www.rfc-editor.org/rfc/rfc8252.html)
- [RFC 9700: Best Current Practice for OAuth 2.0 Security](https://www.rfc-editor.org/rfc/rfc9700.html)
- [RFC 8725: JSON Web Token Best Current Practices](https://www.rfc-editor.org/rfc/rfc8725.html)
- [RFC 7009: OAuth 2.0 Token Revocation](https://www.rfc-editor.org/rfc/rfc7009.html)
- [OpenID Connect Core 1.0](https://openid.net/specs/openid-connect-core-1_0.html)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
- [OWASP Multifactor Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Mobile: Android KeyStore](https://mas.owasp.org/MASTG/knowledge/android/MASVS-STORAGE/MASTG-KNOW-0043/)

### Expo

- [Expo: Authentication with OAuth or OpenID providers](https://docs.expo.dev/guides/authentication/)
- [Expo: SecureStore](https://docs.expo.dev/versions/latest/sdk/securestore/)
- [Expo: Linking into your app](https://docs.expo.dev/linking/into-your-app/)
- [Expo: Development builds](https://docs.expo.dev/develop/development-builds/introduction/)

### Auth0

- [Auth0: Add Login to Your Expo Application](https://auth0.com/docs/quickstart/native/react-native-expo)
- [Auth0: React Native SDK](https://github.com/auth0/react-native-auth0)
- [Auth0: Authorization Code Flow with PKCE](https://auth0.com/docs/get-started/authentication-and-authorization-flow/authorization-code-flow-with-pkce)
- [Auth0: Validate Access Tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens)
- [Auth0: Protect a Node.js API](https://auth0.com/docs/quickstart/backend/nodejs)
- [Auth0: Refresh Token Rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation)
- [Auth0: Revoke Refresh Tokens](https://auth0.com/docs/secure/tokens/refresh-tokens/revoke-refresh-tokens)
- [Auth0: Sessions](https://auth0.com/docs/manage-users/sessions)
- [Auth0: Universal Login](https://auth0.com/docs/authenticate/login/auth0-universal-login/universal-login-vs-classic-login/universal-experience)
- [Auth0: Passwordless Authentication](https://auth0.com/docs/authenticate/passwordless)
- [Auth0: Passkey APIs](https://auth0.com/docs/authenticate/database-connections/passkeys/passkey-apis)
- [Auth0: Enable MFA](https://auth0.com/docs/secure/multi-factor-authentication/enable-mfa)
- [Auth0: Social connections](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers)
- [Auth0: User Account Linking](https://auth0.com/docs/manage-users/user-accounts/user-account-linking)
- [Auth0: Import and Export User Data](https://auth0.com/docs/manage-users/user-migration)
- [Auth0: Create tenants and choose a region](https://auth0.com/docs/get-started/auth0-overview/create-tenants)
- [Auth0: Set up multiple environments](https://auth0.com/docs/get-started/auth0-overview/create-tenants/set-up-multiple-environments)
- [Auth0: Pricing](https://auth0.com/pricing)

### Clerk

- [Clerk: Expo Quickstart](https://clerk.com/docs/expo/getting-started/quickstart)
- [Clerk: Authenticate a backend request](https://clerk.com/docs/reference/backend/authenticate-request)
- [Clerk: Verify a token](https://clerk.com/docs/reference/backend/verify-token)
- [Clerk: Manual JWT verification](https://clerk.com/docs/guides/sessions/manual-jwt-verification)
- [Clerk: Expo Session object](https://clerk.com/docs/expo/reference/objects/session)
- [Clerk: Session options](https://clerk.com/docs/guides/secure/session-options)
- [Clerk: Revoke a session](https://clerk.com/docs/reference/backend/sessions/revoke-session)
- [Clerk: OAuth account linking](https://clerk.com/docs/guides/configure/auth-strategies/social-connections/account-linking)
- [Clerk: Managing environments](https://clerk.com/docs/guides/development/managing-environments)
- [Clerk: User migration and export](https://clerk.com/docs/guides/development/migrating/overview)
- [Clerk: Data Processing Addendum](https://clerk.com/legal/dpa)
- [Clerk: Subprocessors](https://clerk.com/legal/subprocessors)
- [Clerk: Pricing](https://clerk.com/pricing)

### Supabase Auth

- [Supabase: Expo React Native social auth](https://supabase.com/docs/guides/auth/quickstarts/with-expo-react-native-social-auth)
- [Supabase: Native mobile deep linking](https://supabase.com/docs/guides/auth/native-mobile-deep-linking)
- [Supabase: JWT and JWKS](https://supabase.com/docs/guides/auth/jwts)
- [Supabase: Sessions](https://supabase.com/docs/guides/auth/sessions)
- [Supabase: User identities](https://supabase.com/docs/guides/auth/identities)
- [Supabase: Identity linking](https://supabase.com/docs/guides/auth/auth-identity-linking)
- [Supabase: Auth architecture](https://supabase.com/docs/guides/auth/architecture)
- [Supabase: Local development](https://supabase.com/docs/guides/local-development/cli/getting-started)
- [Supabase: Pricing](https://supabase.com/pricing)

### Better Auth y Keycloak

- [Better Auth: NestJS integration](https://better-auth.com/docs/integrations/nestjs)
- [Better Auth: Expo integration](https://better-auth.com/docs/integrations/expo)
- [Better Auth: Session management](https://better-auth.com/docs/concepts/session-management)
- [Better Auth: Users and accounts](https://better-auth.com/docs/concepts/users-accounts)
- [Better Auth: Security](https://better-auth.com/docs/reference/security)
- [Better Auth: Pricing](https://better-auth.com/pricing)
- [Keycloak: Securing applications and services](https://www.keycloak.org/securing-apps/overview)
- [Keycloak: Server Administration Guide](https://www.keycloak.org/docs/latest/server_admin/)

### Documentos del proyecto

- [`AGENTS.md`](../../AGENTS.md)
- [`README.md`](../../README.md)
- [`docs/00-index.md`](../00-index.md)
- [`docs/01-product-vision.md`](../01-product-vision.md)
- [`docs/03-mvp-scope.md`](../03-mvp-scope.md)
- [`docs/04-architecture.md`](../04-architecture.md)
- [`docs/05-roadmap.md`](../05-roadmap.md)
- [`docs/06-ai-behavior.md`](../06-ai-behavior.md)
- [`docs/07-security-and-privacy.md`](../07-security-and-privacy.md)
- [`docs/08-definition-of-done.md`](../08-definition-of-done.md)
- [ADR-001: Idioma y vocabulario canónico](0001-idioma-y-vocabulario-canonico.md)
- [ADR-007: Contratos, validación, OpenAPI y cliente](0007-contratos-validacion-openapi-y-cliente.md)
- [Registro y plantilla de ADR](README.md)
