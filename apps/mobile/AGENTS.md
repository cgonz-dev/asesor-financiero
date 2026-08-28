# Mobile — instrucciones locales

Aplica además el [`AGENTS.md` raíz](../../AGENTS.md) y el execution plan activo.

- Conserva [`docs/mobile/design-system.md`](../../docs/mobile/design-system.md) como fuente visual y
  actualízala junto con cualquier cambio deliberado de tokens, componentes o navegación.
- `MobileAppProvider` mantiene el runtime compartido actual de sesión, hogares e invitaciones. No
  recrees coordinadores por pantalla ni muevas credenciales a componentes visuales.
- Auth0 Credentials Manager sobre Keychain/Keystore es el único almacenamiento de credenciales.
  AsyncStorage guarda solo la preferencia no sensible de hogar, revalidada por la API.
- El token crudo de invitación vive únicamente en memoria: nunca parámetros de ruta, URLs, logs o
  almacenamiento persistente; se elimina al compartir, cerrar o abandonar el flujo.
- Mantén el Stack raíz, las tabs `Inicio`/`Hogar`/`Perfil` y los modales actuales salvo que el plan
  activo autorice un cambio.
- Respeta safe areas, navegación inferior de Android, teclado, controles táctiles y texto ampliado.
  Toda animación debe obedecer Reduce Motion.
- La UI solo presenta capacidades derivadas; la API decide permisos. No inventes cuentas, saldos,
  movimientos ni UI financiera antes de su fase.

