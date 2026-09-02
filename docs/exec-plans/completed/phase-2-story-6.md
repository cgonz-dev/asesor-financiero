# Fase 2 — Historia 6: Auth UX Google-only y branding de login

Status: Completed — 2026-09-02
Phase: 2
Story: 6

## Goal

Reemplazar la compuerta visual genérica de acceso por una experiencia propia de Copiloto
Financiero con una sola acción, `Continuar con Google`, manteniendo a Auth0 como único responsable
de OAuth 2.0/OIDC, Authorization Code + PKCE, tokens, renovación, logout y sesión. La aplicación no
recibirá, capturará ni administrará la contraseña de Google.

## Context / references

- [Project state](../../project-state.md)
- [Roadmap — Fase 2](../../05-roadmap.md#fase-2-autenticación-hogares-e-integrantes)
- [ADR-005](../../adr/0005-autenticacion-y-ciclo-de-sesion-movil.md)
- [Seguridad y privacidad](../../07-security-and-privacy.md)
- [Definition of Done](../../08-definition-of-done.md)
- [Sistema visual móvil](../../mobile/design-system.md)
- [Instrucciones mobile](../../../apps/mobile/AGENTS.md)
- [Auth0 Universal Login y parámetro `connection`](https://auth0.com/docs/authenticate/login/auth0-universal-login)
- [SDK oficial `react-native-auth0`](https://github.com/auth0/react-native-auth0)
- [Google: Sign in with Google Branding Guidelines](https://developers.google.com/identity/branding-guidelines)

## Current baseline

- `apps/mobile/app/index.tsx` ya es la compuerta no autenticada y usa el sistema visual oscuro,
  Manrope, `BrandMark`, glows y componentes compartidos.
- `MobileAppProvider` conserva un solo runtime de sesión y expone la acción de login; no recrea el
  SDK por pantalla.
- `Auth0NativeSessionSdk` inicia `webAuth.authorize` con audience y scopes
  `openid profile email offline_access`, guarda credenciales mediante Credentials Manager y usa
  Keychain/Keystore.
- El coordinador ya cubre restauración, cancelación, renovación single-flight, invalidación, logout
  local inmediato, revocación remota best effort y un solo cambio de navegación.
- La autenticación actual no fija una conexión, por lo que Auth0 puede mostrar Universal Login con
  todas las conexiones habilitadas para la aplicación.
- La Post Login Action de desarrollo ya añade los claims namespaced de correo verificado y permitió
  completar correctamente la aceptación real de una invitación con una segunda identidad.

## Scope

### 1. Decisión Google-only sin reemplazar Auth0

- Mantener `react-native-auth0`; no integrar Google Sign-In nativo ni otro emisor de tokens.
- Mantener el navegador seguro del sistema, Authorization Code + PKCE, callback exacto, audience,
  scopes, Credentials Manager, refresh token rotation y logout implementados en Historia 2.
- Fijar en el adaptador Auth0 la conexión social conocida `google-oauth2` al llamar
  `webAuth.authorize`. La conexión no vendrá de la UI, parámetros de ruta, deep links ni datos
  controlados por la persona usuaria.
- Conservar la interfaz y semántica del coordinador de sesión salvo el mínimo cambio de nombres que
  haga explícita la única acción Google en la capa de presentación.
- No implementar fallback silencioso a Universal Login genérico, Database Connection u otro
  método. Un fallo de la conexión Google produce un error público seguro y permite reintentar.
- Reconocer el límite técnico: Auth0 seguirá procesando `/authorize` y podrá mostrar páginas
  controladas por Auth0 o Google para consentimiento, selección de cuenta, políticas o errores;
  el camino normal debe saltar el selector genérico de conexiones mediante `connection`.

### 2. Configuración manual del tenant y proveedor

- En la Native Application de desarrollo, habilitar `google-oauth2` y deshabilitar la Database
  Connection para este cliente. No eliminar una conexión global que pudiera pertenecer a otro
  cliente o ambiente.
- Confirmar que el nombre real de la conexión sea exactamente `google-oauth2` antes de fijarlo en
  código.
- Mantener Authorization Code y Refresh Token como grants permitidos; no habilitar implicit ni
  password grant.
- Conservar callbacks/logout URLs exactos, Offline Access, Refresh Token Rotation y la política de
  expiración ya validada.
- Mantener desplegada y conectada al Post Login Flow la Action que agrega
  `<AUTH0_AUDIENCE-SIN-DIAGONAL>/email` y `/email_verified` al access token únicamente cuando Google
  entrega un correo verificado.
- Revisar en Auth0/Google Cloud el nombre visible, soporte y branding de la aplicación de
  desarrollo. Credenciales privadas de Google permanecen únicamente en el proveedor/configuración
  segura; nunca entran en `EXPO_PUBLIC_*`, código, logs o documentación.
- Aplicar branding mínimo coherente al New Universal Login de Auth0 solo para páginas inevitables
  de error/política. No usar Classic Login, HTML personalizado que capture credenciales ni WebView.

### 3. Pantalla propia de Copiloto Financiero

- Rediseñar únicamente el estado no autenticado de `apps/mobile/app/index.tsx` sobre
  `AppScreen`; conservar la pantalla neutral de `restoring` y la protección raíz existente.
- Eliminar vocabulario interno como `FASE 2`, el botón genérico `Iniciar sesión` y cualquier opción
  visible de email/password, registro, Apple, passkeys o MFA.
- Presentar marca temporal de Copiloto Financiero, una propuesta breve y no financiera, y una nota
  clara: Google abrirá un navegador seguro y Copiloto Financiero no recibe ni guarda la contraseña.
- Mostrar exactamente una acción de autenticación: `Continuar con Google`.
- Crear una primitiva acotada `GoogleAuthButton` o equivalente, separada de `AppButton` porque la
  marca del proveedor no debe usar el degradado primario de Copiloto.
- Usar un asset oficial local del `G` multicolor o un botón preaprobado descargado de las guías de
  Google; no usar un icono monocromático, inventado, remoto o descargado en runtime. Conservar
  proporción, padding, contraste y colores exigidos por Google. Cualquier excepción tipográfica se
  limita al botón de proveedor y se documenta; el resto de la pantalla continúa en Manrope.
- Mantener objetivo táctil mínimo de 44 px, etiqueta accesible, estado disabled/loading,
  prevención de doble toque, ripple/press feedback y contraste suficiente.
- Reutilizar `usePressMotion`, entradas y ambiente vigentes; todas las animaciones obedecen Reduce
  Motion. No agregar librería de animación, blur ni framework de UI.
- Durante `authenticating`, bloquear nuevos intentos, comunicar que Google se abrió en el navegador
  seguro y conservar el retorno por cancelación sin mostrar un error falso.
- En errores recuperables, usar `FeedbackCard` con texto seguro y la misma única acción para
  reintentar. Nunca presentar códigos OAuth, claims, tokens, correos o detalles del proveedor.

### 4. Límites de implementación

- No cambiar `MobileAppProvider`, Stack protegido, limpieza de Household/invitaciones ni rutas más
  allá del ajuste mínimo necesario para nombrar o conectar la acción Google.
- No cambiar la API, contratos, OpenAPI, Prisma, migraciones o autorización Household. No se
  espera ningún cambio backend.
- Si una incompatibilidad real del backend impide aceptar el access token sin alterar Historia 2,
  detener la implementación, registrar evidencia y actualizar este plan antes de tocar la API.
- No agregar secretos, Google client secret, ID token como credencial de API, token propio, bypass
  de desarrollo o almacenamiento alternativo.
- No generar un development build nuevo si solo cambian TypeScript y assets empaquetados. Si se
  descubre una necesidad nativa real, justificarla y actualizar el plan antes de reconstruir.

### 5. Pruebas automatizadas

- Agregar una prueba del adaptador `Auth0NativeSessionSdk` que demuestre que `authorize` recibe:
  audience exacta, scopes vigentes, `connection: 'google-oauth2'` y custom scheme; la prueba no usa
  un tenant real ni imprime credenciales.
- Demostrar que la conexión está fijada internamente y no puede sustituirse desde UI o navegación.
- Cubrir la presentación no autenticada: existe una sola acción Google, no se renderizan opciones
  de email/password/Apple y el estado autenticando impide doble envío.
- Cubrir cancelación, error de red y error no recuperable con mensajes públicos seguros.
- Confirmar que las pruebas existentes de restauración, `/me`, renovación concurrente, logout,
  protección raíz y limpieza de contexto siguen pasando sin cambiar su semántica.
- No conectar pruebas automáticas al tenant Auth0 ni a cuentas Google reales.

## Out of scope

- Apple, email/password, registro por correo, recuperación de contraseña, passwordless, passkeys o
  MFA nuevo.
- Google Sign-In SDK directo, One Tap o credenciales Google procesadas por la app.
- Sustituir Auth0, OAuth/OIDC, Authorization Code + PKCE, Credentials Manager o el guard NestJS.
- Nuevas rutas autenticadas, cambios de tabs, hogares, invitaciones, roles o visibilidad.
- Backend salvo el bloqueo estricto y previamente documentado descrito en Scope.
- Finanzas, cuentas, saldos, ledger, IA, RLS o Fase 3.
- Logo definitivo, rebranding global, custom domain de Auth0, analítica o telemetría nueva.
- Commit, push, despliegue productivo o publicación en tiendas.

## Acceptance criteria

- En Android no autenticado se ve una pantalla propia de Copiloto Financiero compatible con el
  design system y exactamente un control de acceso: `Continuar con Google`.
- El control cumple las guías de marca vigentes de Google, accesibilidad táctil y Reduce Motion.
- Al pulsarlo, el SDK abre el navegador seguro con `connection: 'google-oauth2'`; el camino normal
  llega a selección/consentimiento de Google sin mostrar el selector genérico de Universal Login.
- La aplicación nunca recibe, renderiza, registra ni almacena una contraseña de Google.
- Auth0 continúa emitiendo y renovando el access token para la audience existente; NestJS continúa
  autenticando solo por token verificado y `issuer + subject`.
- Restauración, login, `/me`, hogares, invitaciones, refresh y logout conservan el comportamiento de
  Historia 2 a 5.
- Cancelar Google regresa a la pantalla propia una sola vez; un error de red o configuración ofrece
  reintento seguro sin fallback a otro método.
- Para esta Native Application, Auth0 tiene únicamente Google habilitado y la Post Login Action de
  correo verificado continúa activa.
- No cambian backend, contratos, OpenAPI, Prisma, migraciones ni autorización Household.
- La validación manual Android descrita abajo está completada con evidencia no sensible.

## Required verification

- `pnpm install --frozen-lockfile`.
- Pruebas unitarias enfocadas de auth, presentación, provider y navegación móvil.
- `pnpm verify`.
- `pnpm verify:full` con PostgreSQL local permitido para demostrar regresión completa de Fase 2.
- Revisión explícita de que no cambien OpenAPI, schema Prisma ni migraciones.
- `git diff --check` y revisión de secretos/credenciales en el diff.

Si un control falla, no se silencia ni se excluye. El plan permanece activo hasta corregirlo o
registrar una excepción válida conforme a la Definition of Done.

## Manual validation

Usar un development build Android real, el tenant exclusivo de desarrollo y cuentas Google
ficticias/verificadas. No guardar capturas con correos o avatares reales sin redacción.

1. Abrir la app sin sesión y comprobar layout, safe areas, texto ampliado, TalkBack y que solo
   exista `Continuar con Google`.
2. Activar Reduce Motion y comprobar que no se ejecuten entradas, glows o presión animada.
3. Pulsar una vez y confirmar navegador seguro, selección de cuenta Google y ausencia del selector
   genérico de conexiones Auth0 en el camino normal.
4. Cancelar desde Google/navegador y confirmar retorno estable, botón rehabilitado y ningún ciclo
   de navegación o error engañoso.
5. Completar Google, confirmar sesión activa, `/me`, tabs, hogar seleccionado y consulta de perfil.
6. Cerrar y reabrir la app; confirmar restauración sin destello de contenido privado.
7. Forzar una renovación o usar una sesión cercana a expiración y confirmar que continúa la
   renovación single-flight existente.
8. Cerrar sesión, confirmar limpieza local/navegación única y volver a entrar únicamente con
   Google.
9. Revalidar con la segunda identidad que los claims de correo verificado siguen permitiendo
   aceptar una invitación dirigida y que Member no recibe acciones de Owner.
10. Probar sin red o con Google temporalmente indisponible y confirmar mensaje seguro, reintento y
    ausencia de fallback a contraseña.
11. Obtener capturas finales no sensibles de acceso, autenticando y error recuperable para revisar
    consistencia visual.

### Evidence recorded — 2026-09-02

La validación manual fue completada correctamente en Android real y se registró sin datos
sensibles. Se confirmó que:

- la Native Application de Auth0 tiene únicamente Google habilitado y conserva conectada la Post
  Login Action;
- login, cancelación, reintento, restauración de sesión, logout y un nuevo login funcionan;
- después del logout la sesión cerrada no se restaura;
- no aparece email/password ni el selector genérico de conexiones de Auth0.

Esta evidencia, junto con la aceptación real previa de invitaciones mediante una segunda
identidad/dispositivo Android, satisface la validación manual requerida por la historia.

### Verification rerun resolved — 2026-09-02

- La inserción directa de la prueba derivaba `expiresAt` de `START`, pero dejaba que la base de
  datos asignara el `createdAt` actual. Al llegar la fecha del entorno después de la expiración
  fijada, la constraint `household_invitation_expiration_after_creation` fallaba antes de la
  unicidad.
- Prisma 7.9.1 expuso ese `check_violation` de PostgreSQL (`23514`) como `P2039`; no fue una
  regresión de Prisma ni de `@prisma/adapter-pg`, y la constraint única
  `uq_household_invitation_token_hash` sigue siendo la que corresponde al caso esperado.
- La prueba fija ahora `createdAt` en sus dos inserciones directas, por lo que alcanza de forma
  determinista la unicidad (`P2002`) y la relación creadora de otro Household (`P2003`) que debe
  validar.
- La prueba afectada aprobó 9/9 y `pnpm verify:full` aprobó 195 pruebas en 37 archivos, con ambas
  migraciones, lint, formato, typecheck, builds, OpenAPI, peers, Expo Doctor 21/21 y diff en verde.

## Documentation updates

- Actualizar `README.md` con la configuración Google-only por Native Application, conexión directa,
  Post Login Action y pasos de validación Android.
- Actualizar `docs/mobile/design-system.md` con composición de acceso, botón de proveedor, asset de
  marca y comportamiento de movimiento/accesibilidad.
- Añadir a ADR-005 una nota de implementación fechada que documente que email/password queda
  diferido y Google es la única conexión habilitada en esta versión, sin reescribir la decisión
  histórica sobre Auth0, PKCE, sesión ni una futura evolución.
- Actualizar `docs/05-roadmap.md` y `docs/project-state.md` al completar la historia con resultados
  y evidencia real; no declarar Fase 2 cerrada automáticamente.
- Si se agrega un asset con términos de uso, conservar su procedencia y licencia/nota de marca en
  el lugar documental apropiado sin copiar material innecesario.

## Completion

La matriz automática está verde y el flujo Google-only fue validado en Android real. Todos los
criterios de Historia 6 están satisfechos. El plan se archiva en `completed/`; el cierre de Fase 2
requiere su propio execution plan y no inicia Fase 3.

No hacer commit ni push.
