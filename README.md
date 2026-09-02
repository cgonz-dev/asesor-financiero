# Copiloto Financiero

Copiloto Financiero es una aplicación móvil de gestión financiera personal y para hogares,
inicialmente enfocada en parejas. Convertirá lenguaje natural en propuestas financieras
estructuradas y explicaciones útiles, sin convertir a la IA en fuente de verdad.

> La IA interpreta, pregunta, propone y solicita acciones. El backend valida, calcula, persiste y
> conserva la verdad financiera.

## Estado actual

- **Fase 1 cerrada:** bootstrap reproducible, health contractual, OpenAPI, cliente móvil mínimo,
  CI inicial y modo LAN completados y verificados.
- La ejecución real de GitHub Actions terminó correctamente en verde.
- **Fase 2 cerrada:** las Historias 1 a 6, las validaciones Android de invitaciones y acceso
  Google-only, y la matriz completa fueron revisadas formalmente en verde. Fase 3 no ha iniciado.
- Existe código no financiero para API, móvil, contratos, dominio mínimo y persistencia PostgreSQL.
- Existen invitaciones dirigidas, opacas, expirables, revocables y de un solo uso. La aceptación con
  una segunda identidad/dispositivo Android fue validada después de conectar la Post Login Action
  al Login Flow de Auth0.
- No existen administración avanzada de integrantes, ledger, operaciones monetarias ni integración
  de IA.
- ADR-001, ADR-005, ADR-006 y ADR-007 permanecen aceptados.

## Arquitectura implementada en este incremento

- monorepo TypeScript con pnpm workspaces;
- API NestJS con health/readiness públicos, `/me` y endpoints Household autenticados, y
  documentación local en `/api/docs`;
- PostgreSQL con Prisma 7.9.1, migración versionada y adaptadores dentro de `apps/api`;
- `User`, `ExternalIdentity`, `Household`, `HouseholdMembership`, `HouseholdInvitation` y auditoría
  mínima de invitaciones, sin modelos financieros;
- casos de uso para resolver identidad verificada, crear un hogar con Owner inicial, listar hogares,
  resolver un contexto Household autorizado e incorporar un `Member Active` mediante invitación;
- `GET /api/v1/readiness`, que comprueba PostgreSQL sin revelar configuración o errores internos;
- Auth0 como proveedor OAuth 2.0/OIDC: el móvil usa Authorization Code + PKCE y la API verifica
  access tokens RS256 por issuer, audience y JWKS antes de resolver `issuer + subject`;
- aplicación React Native con Expo Router, coordinadores de sesión, Households e invitaciones,
  Credentials Manager nativo para Keychain/Keystore y una preferencia no sensible de Household
  seleccionado;
- `packages/contracts` independiente de frameworks, con Zod como fuente canónica;
- cliente REST móvil con transporte inyectable, timeout, cancelación y validación de respuesta;
- configuraciones compartidas de TypeScript, ESLint y Prettier;
- OpenAPI 3.1 reproducible en `apps/api/openapi/openapi.json`;
- pruebas unitarias, de integración, E2E y de límites arquitectónicos.

`health` indica que el proceso HTTP está vivo; `readiness` indica si PostgreSQL está disponible para
las operaciones que dependen de persistencia.

La arquitectura completa prevista se mantiene en
[`docs/04-architecture.md`](docs/04-architecture.md).

## Versiones de bootstrap

| Herramienta | Versión seleccionada |
|---|---|
| Node.js | 24.x LTS |
| pnpm | 11.9.0 |
| TypeScript | 5.9.3 |
| NestJS | 11.1.28 |
| Zod | 4.4.3 |
| `nestjs-zod` | 5.5.0 |
| Expo / Expo Router | 57.0.16 |
| Expo Dev Client | 57.0.15 |
| React Native / React | 0.86.2 / 19.2.3 |
| Auth0 React Native SDK | 5.11.0 |
| AsyncStorage | 2.2.0 |
| JOSE | 6.2.10 |
| Prisma | 7.9.1 |
| PostgreSQL en CI | 18.4 |

El adaptador `nestjs-zod` vive solo en `apps/api`: `createZodDto` deriva el adaptador de Nest y
OpenAPI desde el schema compartido, y el interceptor de serialización valida la salida. El servidor
usa una variante estricta; el cliente usa una variante compatible derivada del mismo schema base.
`cleanupOpenApiDoc` produce el JSON Schema/OpenAPI 3.1 sin introducir NestJS en
`packages/contracts`.

## Estructura

```text
apps/
  api/                 # NestJS, auth, Households, Prisma, health/readiness y OpenAPI
  mobile/              # Expo Router, sesión Auth0, Households y cliente REST
packages/
  contracts/           # schemas Zod y tipos inferidos, sin acoplamiento a Auth0
  domain/              # reglas mínimas de identidad y Household, sin frameworks
  config/              # esqueleto de configuración no sensible
  eslint-config/
  typescript-config/
tests/                 # verificaciones arquitectónicas
docs/
  adr/
  exec-plans/          # trabajo operacional activo y completado
  mobile/              # fuente de verdad del sistema visual móvil
  project-state.md     # snapshot operacional actual
```

## PostgreSQL local y migraciones

El desarrollo local usa el comando oficial `prisma dev`. Se eligió porque Docker y Compose estaban
instalados, pero el motor de Docker Desktop no estaba operativo durante esta historia. Es una
instancia local para desarrollo, no una base de producción ni un despliegue público.

En una terminal abierta en la raíz ejecuta:

```bash
pnpm db:dev
```

El comando mantiene una instancia llamada `copiloto-financiero` y muestra su URL TCP directa en el
puerto 51214. Crea `apps/api/.env` —está ignorado por Git—, asigna esa URL a `DATABASE_URL`, cópiala
en `SHADOW_DATABASE_URL` y cambia solo el puerto a 51215, reservado por el script para la shadow
database. No versiones las credenciales locales. Después, desde otra terminal:

```bash
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
```

Los scripts de base de datos tienen responsabilidades distintas:

| Comando | Responsabilidad |
|---|---|
| `pnpm db:dev` | Inicia la infraestructura PostgreSQL local y muestra sus URLs |
| `pnpm db:generate` | Genera Prisma Client; no altera la base |
| `pnpm db:migrate` | Crea y aplica migraciones durante desarrollo del schema |
| `pnpm db:migrate:deploy` | Aplica únicamente migraciones versionadas existentes |
| `pnpm db:status` | Informa el estado de las migraciones |
| `pnpm db:studio` | Abre Prisma Studio contra la URL configurada |
| `pnpm db:dev:stop` | Detiene la instancia local nombrada |

Prisma 7 no ejecuta `generate` ni seed implícitamente después de `migrate dev`; por eso los comandos
permanecen separados. Una migración aplicada/versionada no se modifica: cualquier cambio posterior
usa una migración nueva. Para detener la base, presiona `Ctrl+C` en su terminal o ejecuta
`pnpm db:dev:stop` desde otra terminal.

Las pruebas de integración limpian únicamente las seis tablas no financieras actuales. El guard de
pruebas acepta solo la instancia local documentada (`template1` en el puerto 51214) o la base
efímera nominal de CI; rechaza cualquier otra URL, incluso si apunta a `localhost`.

## Guía rápida para verlo en el navegador

La primera vez, abre una terminal en la raíz del proyecto y ejecuta:

```bash
pnpm install
```

Configura e inicia PostgreSQL con la sección anterior. Después usa dos terminales adicionales
abiertas en la raíz:

```bash
# Terminal API
pnpm dev:api
```

Espera a que aparezca `Nest application successfully started`.

```bash
# Terminal aplicación web
pnpm --filter @copiloto/mobile web
```

Abre `http://localhost:8081`. La pantalla web explica que el login real requiere un development
build; no guarda tokens en el navegador. Verifica `http://localhost:3000/api/v1/health` y
`http://localhost:3000/api/v1/readiness`; readiness debe responder `ready`. La documentación
interactiva queda en `http://localhost:3000/api/docs`. Para detener todo, presiona `Ctrl+C` en cada
terminal.

## Instalación y ejecución

Requisitos: Node.js 24 LTS y pnpm 11.9.0. El `packageManager` de la raíz permite que Corepack
seleccione la versión exacta. Antes de iniciar la API, inicia PostgreSQL, configura `apps/api/.env`
con `DATABASE_URL`, `AUTH0_ISSUER` y `AUTH0_AUDIENCE`, genera Prisma Client y aplica las migraciones
como se explica arriba. Si ambas variables Auth0 están ausentes, solo health/readiness arrancan y
`/me` falla cerrado; una configuración parcial o inválida impide iniciar. No existe bypass local.

```bash
pnpm install
pnpm dev:api
```

La API escucha de forma predeterminada en `http://localhost:3000` y admite el loopback local tanto
por IPv4 como por IPv6:

- health: `http://localhost:3000/api/v1/health`;
- readiness: `http://localhost:3000/api/v1/readiness`;
- Swagger UI: `http://localhost:3000/api/docs`.

Para navegador, la API permite por defecto solo los orígenes locales de Expo
`http://localhost:8081` y `http://127.0.0.1:8081`, sin credenciales. Si el servidor web usa otro
origen, define `CORS_ALLOWED_ORIGINS` como una lista explícita separada por comas antes de arrancar
la API. No uses `*`.

En otra terminal:

```bash
pnpm dev:mobile
```

Expo usa `http://localhost:3000` como valor local predeterminado. Para configurar otro host, usa
`.env.example` como referencia y crea `apps/mobile/.env.local` únicamente con las variables
`EXPO_PUBLIC_*` necesarias; establece `EXPO_PUBLIC_API_URL` sin una diagonal final:

- web: `http://localhost:3000`;
- emulador Android: `http://10.0.2.2:3000`;
- dispositivo físico: `http://<IP-LAN-DE-LA-COMPUTADORA>:3000`.

No se debe guardar una IP personal, token o secreto en archivos versionados.

## Auth0 de desarrollo y development build

La autenticación móvil real no funciona en Expo Go ni en Expo Web porque usa módulos nativos. La
pantalla propia ofrece únicamente `Continuar con Google`; al pulsarlo, el SDK abre el navegador
seguro del sistema y solicita a Auth0 la conexión fija `google-oauth2`. Auth0 conserva Authorization
Code + PKCE S256, `state`, `nonce`, tokens, refresh y logout; no se usa una WebView embebida y la app
nunca recibe la contraseña de Google. El Credentials Manager protege la credencial renovable
mediante iOS Keychain o Android Keystore. La API solo acepta un access token dirigido a su
audience. Nunca uses el ID token, un client secret o un `userId` del cliente como autenticación.

### Configuración manual del Dashboard

Usa un tenant exclusivo de desarrollo, sin personas ni datos reales:

1. Crea una **API** con un identifier propio —será `AUTH0_AUDIENCE` y
   `EXPO_PUBLIC_AUTH0_AUDIENCE`—, algoritmo RS256 y **Allow Offline Access** habilitado. El
   identifier debe ser distinto del Client ID.
2. Crea una **Native Application** pública. Mantén `Token Endpoint Authentication Method: None` y
   habilita solo Authorization Code y Refresh Token; no habilites Implicit ni Password grant.
3. Para el bundle/package de desarrollo `com.copilotofinanciero.dev` y el esquema
   `copilotofinanciero`, registra exactamente estas Allowed Callback URLs:

   ```text
   copilotofinanciero://<TU-DOMINIO-AUTH0>/ios/com.copilotofinanciero.dev/callback
   copilotofinanciero://<TU-DOMINIO-AUTH0>/android/com.copilotofinanciero.dev/callback
   ```

4. Registra las mismas dos URLs como Allowed Logout URLs. Allowed Web Origins no es necesario para
   este cliente nativo; no agregues `*`.
5. Activa Refresh Token Rotation, detección de reutilización y expiración absoluta/inactividad. La
   política inicial validada para desarrollo/MVP usa access tokens de 10 minutos, inactividad del
   refresh token de 7 días, máximo absoluto de 30 días y overlap de rotación de 3 segundos. Es una
   política inicial revisable, no una garantía legal o definitiva; el código no duplica ni
   sobreescribe estas duraciones del tenant.
6. Habilita únicamente la conexión social de Google para esta Native Application y confirma que su
   nombre interno sea exactamente `google-oauth2`. Deshabilita la Database Connection para este
   cliente —sin eliminarla del tenant si otro cliente legítimo la necesita—. Configura Google con
   credenciales de desarrollo propias; no pegues secretos en el repositorio. Apple, email/password,
   magic links, passwordless y passkeys permanecen fuera de esta versión.
7. Crea y despliega una **Post Login Action** que añada al access token de esta API el correo y su
   estado de verificación en los claims `<AUDIENCE-SIN-DIAGONAL-FINAL>/email` y
   `<AUDIENCE-SIN-DIAGONAL-FINAL>/email_verified`. Los valores deben provenir de `event.user.email`
   y `event.user.email_verified`; no agregues el correo si no está verificado. Vincula la Action al
   Login Flow. El prefijo debe coincidir exactamente con `AUTH0_AUDIENCE`. Estos claims solo limitan
   quién puede aceptar una invitación dirigida: no identifican al `User` ni conceden permisos.

En `apps/mobile/.env.local` guarda únicamente valores públicos:

```dotenv
EXPO_PUBLIC_API_URL=http://<HOST-DE-DESARROLLO>:3000
EXPO_PUBLIC_AUTH0_DOMAIN=<TU-DOMINIO-AUTH0-SIN-HTTPS>
EXPO_PUBLIC_AUTH0_CLIENT_ID=<CLIENT-ID-DE-LA-NATIVE-APPLICATION>
EXPO_PUBLIC_AUTH0_AUDIENCE=<IDENTIFIER-DE-LA-API>
```

En `apps/api/.env`, además de las URLs locales de PostgreSQL:

```dotenv
AUTH0_ISSUER=https://<TU-DOMINIO-AUTH0>/
AUTH0_AUDIENCE=<EL-MISMO-IDENTIFIER-DE-LA-API>
```

No hay client secret en móvil ni se necesita uno para validar la API. Ambos archivos locales están
ignorados por Git; `.env.example` conserva solo ejemplos genéricos.

### Crear y ejecutar el development build

#### Android sin Android Studio: APK interno con EAS

La vía más simple en Windows usa EAS Build en la nube. El perfil `development` de
`apps/mobile/eas.json` genera exclusivamente un development client Android en formato APK con
distribución interna: no crea un AAB, no publica en Play Store y no define un perfil de producción.
EAS CLI se ejecuta bajo demanda con la versión fijada en los scripts y `eas.json`; no se instala
globalmente ni permanece como dependencia local del proyecto.

Después de crear una cuenta de Expo, inicia y vincula el proyecto desde la raíz:

```bash
pnpm --filter @copiloto/mobile eas:login
pnpm --filter @copiloto/mobile eas:init
```

Registra en el ambiente remoto `development` solo los tres identificadores públicos de Auth0. Usa
los valores del tenant de desarrollo, nunca un Client Secret:

```bash
pnpm --filter @copiloto/mobile eas:env:set --name EXPO_PUBLIC_AUTH0_DOMAIN --value <DOMINIO-AUTH0-SIN-HTTPS> --environment development --visibility plaintext
pnpm --filter @copiloto/mobile eas:env:set --name EXPO_PUBLIC_AUTH0_CLIENT_ID --value <CLIENT-ID-PUBLICO> --environment development --visibility plaintext
pnpm --filter @copiloto/mobile eas:env:set --name EXPO_PUBLIC_AUTH0_AUDIENCE --value <IDENTIFIER-DE-LA-API> --environment development --visibility plaintext
```

Crea el APK interno:

```bash
pnpm --filter @copiloto/mobile android:build:cloud
```

Al terminar, abre en el Android el enlace o QR privado de instalación que muestra EAS. Permite la
instalación desde esa fuente únicamente para este APK de desarrollo. La URL LAN de la API sigue
viviendo solo en `apps/mobile/.env.local`; no se guarda la IP personal en EAS ni en Git. Con el APK
instalado, inicia API y Metro con `pnpm dev:api` y `pnpm dev:mobile:native` en terminales separadas.

#### Compilación local con Android SDK

Define las variables antes de generar el proyecto nativo, conecta un dispositivo de desarrollo y
ejecuta desde la raíz:

```bash
pnpm install --frozen-lockfile
pnpm --filter @copiloto/mobile android:dev
```

En Windows, el segundo comando requiere Android SDK/JDK y un dispositivo autorizado por ADB. En
macOS puede usarse `pnpm --filter @copiloto/mobile ios:dev`. Las carpetas nativas generadas están
ignoradas porque la configuración canónica vive en `app.config.ts`; esto no publica la app ni crea
un build de producción. Después de instalar el development build una vez, inicia Metro con:

```bash
pnpm dev:mobile:native
```

Inicia además PostgreSQL y `pnpm dev:api`. En un teléfono físico usa la IPv4 LAN de la computadora
en `EXPO_PUBLIC_API_URL`; `localhost` apuntaría al propio teléfono. Primero valida health/readiness,
después inicia sesión y pulsa **Consultar mi perfil**. El perfil solo devuelve el UUID opaco y el
estado del `User` interno.

La restauración muestra una pantalla neutral, renueva una sola vez para solicitudes concurrentes y
solo declara sesión activa después de que `/me` responde. Un segundo `401` limpia la sesión; logout
aborta solicitudes, limpia memoria y Keychain/Keystore inmediatamente e intenta revocar el refresh
token y cerrar la sesión de navegador sin conservarlo para un reintento offline.

El cierre de Historia 2 validó en un Android real los accesos por Google y Database Connection, la
consulta de `/me`, la restauración después de cerrar completamente la app, el logout, la reapertura
sin restaurar la sesión cerrada y un nuevo login. La revocación remota del proveedor continúa siendo
best effort; el cierre local y la limpieza de credenciales no dependen de ella.

Historia 6 conserva ese ciclo de sesión, pero fija Google como única conexión del acceso actual. La
pantalla propia no recibe correo ni contraseña y no implementa un SDK de Google directo: Auth0
sigue siendo el broker OAuth/OIDC. La validación en Android real confirmó que:

1. solo aparece `Continuar con Google`, con TalkBack, texto ampliado y Reduce Motion correctos;
2. el navegador llega directamente a Google, cancelar vuelve estable y un doble toque no duplica
   el flujo;
3. login, `/me`, restauración, renovación, logout y relogin permanecen funcionales;
4. después del logout la sesión cerrada no se restaura y un nuevo login funciona;
5. no aparece email/password ni el selector genérico de conexiones de Auth0.

## Households autenticados

Historia 3 agrega tres rutas protegidas por el mismo Bearer access token de Auth0:

- `GET /api/v1/households`: lista solo memberships `Active` del `User` interno autenticado;
- `POST /api/v1/households`: recibe únicamente `name` y crea atómicamente el Household junto con un
  Owner `Active`;
- `GET /api/v1/households/{householdId}`: devuelve el perfil mínimo solo después de resolver una
  membership `Active` del actor.

Un `householdId` de la URL es contexto solicitado, nunca autorización. El servidor vuelve a
comprobar `User + Household + Active HouseholdMembership` en cada consulta; hogares inexistentes,
ajenos e inactivos producen la misma respuesta pública `404`. No existe `X-Household-Id`, un hogar
activo guardado en sesión ni confianza en `userId`, `ownerId`, roles o subjects enviados por el
cliente.

Después de `/me`, el development build muestra los hogares autorizados, permite crear y seleccionar
uno, y revalida cualquier selección persistida contra `GET /households`. Solo el UUID opaco de esa
preferencia UX se guarda en AsyncStorage, separado por `User`; no es secreto ni prueba de acceso.
Los tokens continúan exclusivamente en Credentials Manager sobre Keychain/Keystore. Logout cancela
requests y elimina de memoria la lista y el hogar seleccionado antes de mostrar el login.

Para probarlo, inicia PostgreSQL, API y Metro como en la sección anterior, abre el development build,
inicia/restaura sesión y crea un nombre ficticio. Cierra completamente la app, vuelve a abrirla y
comprueba que la lista y una selección aún autorizada regresan. Crea un segundo hogar y cambia entre
ambos; finalmente cierra sesión y confirma que la lista deja de verse. Agregar AsyncStorage introduce
un módulo nativo, por lo que un development build creado antes de Historia 3 debe recompilarse e
instalarse una vez con `pnpm --filter @copiloto/mobile android:build:cloud`.

El `POST` evita dobles envíos desde el coordinador móvil, pero aún no define idempotencia general del
servidor; dos creaciones legítimas, incluso con el mismo nombre, producen dos Households distintos.
La idempotencia financiera pertenece a ADR-008 y no se adelantó aquí.

## Invitaciones dirigidas al Household

Historia 4 agrega cinco rutas autenticadas:

- `POST /api/v1/households/{householdId}/invitations`: el Owner crea una invitación dirigida;
- `GET /api/v1/households/{householdId}/invitations`: el Owner consulta metadata segura;
- `POST /api/v1/households/{householdId}/invitations/{invitationId}/revoke`: el Owner revoca una
  invitación pendiente;
- `POST /api/v1/invitations/accept`: otro `User` autenticado acepta enviando el código en el body;
- `GET /api/v1/households/{householdId}/members`: un integrante activo consulta la proyección mínima
  de membresías activas.

El código es un secreto opaco de 256 bits codificado en base64url. Se muestra únicamente en la
respuesta de creación y la app lo conserva solo en memoria hasta compartirlo o descartarlo. La base
guarda exclusivamente SHA-256, nunca el código original. No se coloca en URLs, deep links,
AsyncStorage ni SecureStore. La duración inicial es configurable con
`HOUSEHOLD_INVITATION_TTL_HOURS` y por defecto es de siete días.

La invitación está restringida al correo normalizado indicado por el Owner. Al aceptar, la API toma
un correo verificado del access token validado; nunca recibe correo, `userId`, `householdId`, rol o
permiso como autoridad del body. Coincidir por correo no enlaza identidades. La invitación determina
el Household y siempre crea `Member Active` dentro de la misma transacción que consume el código.
Un reintento del mismo `User` es seguro; otro `User`, un código vencido/revocado o una membresía
histórica no activa reciben un error público uniforme.

## Visibilidad y auditoría básica

Historia 5 agrega en `packages/domain` una policy pura de lectura para las audiencias `Private`,
`SelectedMembers` y `Household`. La decisión combina acción, capability, membership `Active`, mismo
Household, ownership y selección explícita. El rol Owner no concede acceso a un recurso `Private`
ajeno y toda combinación desconocida se deniega.

Esta policy es deliberadamente no financiera: todavía no existen cuentas, movimientos, endpoints o
tablas de recursos que la consuman. La creación de Household ahora audita `household.created` de
forma atómica, además de los tres eventos de invitaciones ya existentes. No cambiaron contratos,
OpenAPI, migraciones ni mobile.

### Deuda de validación manual en Android

Para completar la evidencia manual pendiente, usa dos cuentas ficticias con correos verificados:

1. Con User A Owner, crea una invitación para el correo verificado de User B y comparte el código
   mediante la hoja del sistema.
2. Cierra sesión, entra como User B, pega el código y acepta. Confirma que el Household aparece y que
   User B figura como `Member`.
3. Regresa como User A y confirma que la lista mínima muestra dos integrantes.
4. Como User B intenta crear una invitación y confirma el rechazo seguro.
5. Como User A crea y revoca otra invitación; como User B confirma que ese código ya no puede
   aceptarse.

No uses datos reales en esta validación. Si la aceptación falla aun con el correo correcto, revisa
primero la Post Login Action descrita arriba y vuelve a iniciar sesión para obtener un access token
nuevo con los claims verificados.

## Navegación y sistema visual de Fase 2

La experiencia móvil de identidad y hogares usa modo oscuro fijo, tipografía Manrope y navegación
inferior con tres destinos: `Inicio`, `Hogar` y `Perfil`. `Inicio` resume únicamente la configuración
no financiera; `Hogar` concentra selección, integrantes e invitaciones; `Perfil` conserva `/me` y el
cierre seguro de sesión. Crear hogar, invitar y aceptar una invitación viven en rutas modales
separadas para evitar la pantalla única y el desplazamiento excesivo de la primera versión.

Un `MobileAppProvider` mantiene una sola instancia de los coordinadores de Auth0, Households e
invitaciones durante la navegación. Los componentes visuales no leen credenciales ni duplican
reglas de autorización. Las acciones de Owner se muestran solo cuando la membresía autorizada lo
indica y la API sigue validando cada operación. El código crudo de una invitación permanece en
memoria, nunca viaja como parámetro de ruta y se elimina al compartir o cerrar el modal.

El tema usa componentes propios pequeños sobre React Native, Expo Router, `expo-linear-gradient`,
`@expo/vector-icons` y Manrope; no incorpora un framework de UI. Las microinteracciones, glows y
transiciones usan `Animated` y respetan Reduce Motion. La fuente visual vigente es
[`docs/mobile/design-system.md`](docs/mobile/design-system.md). La
integración de módulos visuales nativos requiere generar e instalar un development build nuevo:

```bash
pnpm --filter @copiloto/mobile android:build:cloud
```

Después de instalar el APK, ejecuta `pnpm dev:mobile:native`. Expo Web conserva el shell visual,
pero no reemplaza la validación de Auth0 ni de invitaciones en Android real.

Referencias oficiales verificadas el 24 de agosto de 2026: [Auth0 con
Expo](https://auth0.com/docs/quickstart/native/react-native-expo), [SDK React Native de
Auth0](https://github.com/auth0/react-native-auth0), [validación de access
tokens](https://auth0.com/docs/secure/tokens/access-tokens/validate-access-tokens), [refresh token
rotation](https://auth0.com/docs/secure/tokens/refresh-tokens/refresh-token-rotation), [revocación de
refresh tokens](https://auth0.com/docs/secure/tokens/refresh-tokens/revoke-refresh-tokens),
[development builds de Expo](https://docs.expo.dev/develop/development-builds/introduction/) y
[opciones de JWKS remoto de JOSE](https://github.com/panva/jose/blob/main/docs/jwks/remote/interfaces/RemoteJWKSetOptions.md).

## Probar desde un celular en la red local

Primero inicia PostgreSQL y aplica las migraciones. Después conecta la computadora y el celular a la
misma red Wi-Fi y, desde la raíz del proyecto, ejecuta:

```bash
pnpm dev:lan
```

El comando detecta una IPv4 privada activa, inicia API y Expo Web para la red local y muestra URLs
como `http://<IP-LAN>:8081` para la aplicación y
`http://<IP-LAN>:3000/api/v1/health` para health. Si hay más de una interfaz útil, selecciona una
con `LAN_IP`; en PowerShell, por ejemplo:

```powershell
$env:LAN_IP = '192.0.2.10'
pnpm dev:lan
```

Primero abre la URL de health desde el celular y confirma la respuesta JSON. Después abre la URL de
la aplicación. El modo LAN configura la API del navegador con esa misma IPv4 y una allowlist CORS
que conserva solo los orígenes locales y el origen LAN concreto.

Si el celular no puede abrir las URLs, revisa manualmente Windows Firewall y permite Node.js/Expo
en redes **privadas** para los puertos 3000 y 8081; este comando no modifica reglas de Firewall.
No es un despliegue público ni crea un APK. Presiona `Ctrl+C` para detener ambos procesos.

## Controles

La interfaz habitual es:

```bash
pnpm verify
pnpm verify:full
```

`verify` no requiere PostgreSQL ni Auth0 real. `verify:full` añade migraciones y suites con base de
datos; requiere la instancia local documentada o PostgreSQL efímero de CI. Ambos conservan el primer
exit code fallido y no despliegan ni publican. Los comandos individuales siguen disponibles:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
pnpm db:migrate:deploy
pnpm db:status
pnpm lint
pnpm format
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm openapi:generate
pnpm openapi:check
pnpm peers check
git diff --check
```

`openapi:check` compara el artefacto existente con una generación canónica y falla si está
desactualizado. El artefacto generado queda fuera de Prettier para que ambos controles no compitan.
El formato cubre los demás archivos técnicos; la documentación fundacional permanece fuera del
formateo automático para evitar reescrituras masivas no relacionadas.

## Integración continua

El workflow [Copiloto Financiero CI](.github/workflows/ci.yml) se ejecuta en cada push a `main`,
en pull requests dirigidos a `main` y de forma manual. Levanta PostgreSQL 18.4 efímero con
credenciales ficticias de CI, genera Prisma Client, aplica únicamente migraciones versionadas y
comprueba su estado antes de ejecutar los controles. También falla si OpenAPI generado difiere del
artefacto versionado. Las pruebas criptográficas usan issuer, JWKS, claves y tokens sintéticos
locales; CI no necesita un tenant ni secretos Auth0. No despliega ni publica paquetes.

Para reproducirlo localmente, ejecuta el bloque de **Controles** desde la raíz del monorepo. La
ejecución remota se consulta en la pestaña [Actions del repositorio](https://github.com/cgonz-dev/asesor-financiero/actions).

## Alcance del MVP

El MVP contempla cuentas personales y compartidas, ingresos, gastos, transferencias, dinero
restringido o comprometido, efectivo, vales, tarjetas, deudas, compras a meses, tandas,
conciliación, presupuestos y un asistente sujeto a herramientas tipadas y confirmación. Este
incremento no implementa todavía ninguno de esos flujos.

## Fuera del MVP

Quedan fuera las integraciones bancarias, pagos automáticos, panel web, asesoría financiera
profesional garantizada y funcionamiento offline completo.

## Documentación y colaboración

Antes de modificar el proyecto:

1. Lee [`AGENTS.md`](AGENTS.md).
2. Sigue el orden de [`docs/00-index.md`](docs/00-index.md) y revisa
   [`docs/project-state.md`](docs/project-state.md).
3. Ejecuta únicamente el plan aplicable de [`docs/exec-plans/active/`](docs/exec-plans/README.md) y
   consulta sus ADR relacionados.
4. No asumas decisiones que afecten saldos, auditoría, seguridad o privacidad.
5. No incluyas secretos ni hagas commit, push o cambios de rama sin autorización explícita.

## Limitaciones conocidas

- El análisis de cambios incompatibles de OpenAPI aún no existe; CI solo verifica que el artefacto
  generado permanezca actualizado.
- `health` no comprueba PostgreSQL por diseño; usa `readiness` para esa señal.
- La estrategia local `prisma dev` es únicamente para desarrollo; producción aún no está diseñada.
- La API todavía no tiene infraestructura general de rate limiting. La aceptación de invitaciones
  mitiga enumeración con 256 bits de entropía, input de longitud fija, errores uniformes y fail
  closed; debe añadirse una política operativa antes de exponer el servicio públicamente.
- La auditoría de Fase 2 cubre eventos exitosos de creación de Household e invitaciones. La
  correlación y auditoría general de intentos fallidos continúan como parte del gate de
  observabilidad de ADR-019.

## Próximo paso recomendado

Planear y ejecutar el spike de RLS exigido por ADR-006 antes de cualquier tabla financiera de Fase
3. No iniciar Fase 3 mientras ese gate siga pendiente.
