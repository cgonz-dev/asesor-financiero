# Sistema visual móvil

## Propósito y fuentes

Esta es la fuente de verdad del diseño móvil implementado durante Fase 2. Documenta el código
actual; no propone un rediseño ni autoriza UI financiera.

Fuentes principales:

- [`apps/mobile/src/ui/theme.ts`](../../apps/mobile/src/ui/theme.ts): tokens.
- [`apps/mobile/src/ui/components.tsx`](../../apps/mobile/src/ui/components.tsx): componentes.
- [`apps/mobile/src/ui/motion.ts`](../../apps/mobile/src/ui/motion.ts): movimiento.
- [`apps/mobile/app/_layout.tsx`](../../apps/mobile/app/_layout.tsx) y
  [`apps/mobile/app/(tabs)/_layout.tsx`](<../../apps/mobile/app/(tabs)/_layout.tsx>): navegación,
  fuentes y safe areas.

Ante una discrepancia, el código actual demuestra la implementación; cualquier cambio deliberado
debe actualizar este documento en la misma tarea.

## Fundamentos

- Modo oscuro permanente (`userInterfaceStyle: dark`) y barra de estado clara.
- Fondo del sistema y de navegación: `#080A0F`.
- Tipografía Manrope cargada antes de montar la navegación: Regular 400, Medium 500, SemiBold 600
  y Bold 700.
- Ionicons como familia de iconos; no se usan emojis como iconografía funcional.
- Marca temporal: monograma `CF` en degradado. No es un logo definitivo.
- Ancho de contenido máximo de 720 px, centrado; en móvil usa 24 px laterales.

## Tokens vigentes

### Color

| Token | Valor | Uso principal |
|---|---|---|
| `background` | `#080A0F` | Fondo global |
| `surface` | `#11151C` | Tarjetas, tab bar y botones secundarios |
| `surfaceElevated` | `#181D26` | Inputs, iconos y superficies internas |
| `text` | `#F7F8FA` | Texto principal |
| `textMuted` | `#9AA4B2` | Texto secundario |
| `textSubtle` | `#6F7A89` | Notas y estados inactivos |
| `primary` | `#4B6FFF` | Acción/identidad principal |
| `accentViolet` | `#8B5CF6` | Degradado principal |
| `accentCyan` | `#2DD4BF` | Foco, selección y acentos |
| `success` | `#5EE6A8` | Éxito |
| `warning` | `#F6C85F` | Advertencia |
| `danger` | `#FF6B7A` | Error y acción destructiva |
| `border` | `rgba(255, 255, 255, 0.10)` | Bordes sutiles |

Los tonos semitransparentes de éxito, advertencia, peligro y glows viven también en `theme.ts`.

### Degradados

- `primary`: azul `#4B6FFF` → violeta `#8B5CF6`; marca y acciones principales.
- `selected`: `#1A2A55` → `#241D45` → `#122B34`; hogar seleccionado.
- `ambient`: azul/violeta transparente; token disponible para ambiente. Los glows actuales usan
  las superficies `glowBlue` y `glowViolet` animadas.

Los degradados son acentos. No codifican permisos, estado financiero ni resultados por sí solos.

### Espaciado, radios y elevación

| Grupo | Valores |
|---|---|
| Spacing | `xs 8`, `sm 12`, `md 16`, `lg 24`, `xl 32`, `xxl 44` |
| Radios | `button 18`, `input 18`, `card 24`, `pill 999` |
| Elevación | `elevation: 8` en superficies destacadas |

Se prefieren combinaciones de estos tokens; valores locales solo se usan para ajustes tipográficos,
iconos o composiciones concretas.

## Componentes compartidos

- `AppScreen`: SafeAreaView, fondo, glows, teclado, scroll y entrada escalonada del contenido.
- `ScreenHeader`: eyebrow, título de hasta dos líneas, descripción opcional y acción superior
  derecha. El cierre de un modal vive en esa acción, no bajo el título.
- `BrandMark`: monograma temporal con degradado.
- `AppCard` / `GradientCard`: superficie estándar y superficie seleccionada.
- `SectionHeader`: título, descripción y acción contextual.
- `AppButton`: variantes `primary`, `secondary`, `ghost` y `danger`; mínimo 54 px, loading,
  disabled, ripple Android e interacción por presión.
- `IconButton`: objetivo táctil de 48 × 48 px, etiqueta accesible y ripple Android.
- `AppTextInput`: label visible, foco cian, error rojo, selección cian y mínimo 56 px.
- `FeedbackCard`: tonos neutral, success, warning y danger; anuncia cambios mediante live region.
- `EmptyState`: estado vacío con icono, título y explicación.
- `ListRow`: fila de mínimo 72 px, estado seleccionado, caption y trailing opcional.
- `StatusPill`: etiquetas neutrales o de éxito.

No se introduce un framework de componentes. Las nuevas variantes deben reutilizar estas primitivas
antes de crear componentes aislados.

## Navegación y pantallas

### Stack raíz

- `index`: compuerta de sesión (`restoring`, acceso, error recuperable o redirección autenticada).
- `(tabs)`: área autenticada.
- `households/create`, `households/invite` e `invitations/accept`: presentación modal con entrada
  desde abajo.
- Transición raíz `fade_from_bottom`; gestures habilitados y botón Atrás de Android respetado.

### Tabs autenticadas

- `Inicio`: resumen no financiero y acciones rápidas permitidas.
- `Hogar`: selección, integrantes e invitaciones.
- `Perfil`: identidad interna, consulta `/me` y cierre de sesión.

La tab bar se oculta con el teclado. Su alto es `64 + bottomInset`, usa al menos 8 px de padding
inferior y anima icono/glow al cambiar de destino. Así no colisiona con la navegación del sistema
Android.

## Safe areas y teclado

- Pantallas dentro de tabs protegen top/left/right; la tab bar absorbe el inset inferior.
- Compuerta y modales usan `safeBottom`, incluyendo top/bottom/left/right.
- `KeyboardAvoidingView`: `padding` en iOS y `height` en Android.
- Scroll: `keyboardShouldPersistTaps="handled"`; dismiss interactivo en iOS y al arrastrar en
  Android. Los modales con formulario son desplazables en pantallas pequeñas.
- La barra de tabs se oculta mientras el teclado está abierto.

## Movimiento

Las animaciones usan `Animated` de React Native, sin motor adicional:

- entrada: 460 ms, opacidad + 16 px vertical + escala 0.985 → 1;
- stagger: 65 ms por bloque, limitado a 260 ms;
- presión: spring (`damping 18`, `mass 0.55`, `stiffness 360`), normalmente escala 0.975;
- tabs: spring con escala hasta 1.1, desplazamiento −2 px y glow;
- ambiente: dos glows en loop de 7.2 s por dirección, movimiento corto y escala hasta 1.06;
- transiciones: Stack y Tabs de Expo Router.

`AccessibilityInfo.isReduceMotionEnabled()` y el evento `reduceMotionChanged` desactivan entrada,
presión, tabs y ambiente cuando la persona solicita movimiento reducido. Native driver se usa en
iOS/Android; web usa el driver JS compatible.

## Estados y retroalimentación

- Loading: spinner cian, botones bloqueados y texto de acción presente.
- Empty: `EmptyState` con una acción cercana cuando procede.
- Error: `FeedbackCard danger`, mensaje público seguro y reintento explícito.
- Success: `FeedbackCard success` o pill de estado; no depende solo del color.
- Warning: explicación de una limitación o permiso sin presentar datos sensibles.
- Restoring: pantalla neutral sin contenido privado antes de validar sesión.

Los errores mostrados provienen de mensajes públicos seguros; nunca se presentan stack traces,
tokens o detalles internos.

## Owner y Member en presentación

- `getHouseholdCapabilities` traduce el rol autorizado a presentación.
- Owner ve acciones para crear/revocar invitaciones.
- Member no recibe esas acciones y obtiene un estado explicativo si intenta abrir el flujo.
- Ocultar UI no autoriza ni protege: la API vuelve a resolver membresía y policy.
- Ser Owner no implica acceso a recursos privados. El futuro diseño de visibilidad debe conservar
  `Private`, `SelectedMembers` y `Household` según ADR-006.

## Límites actuales

- No hay cuentas, saldos, movimientos, ledger, dashboard ni datos financieros simulados.
- Web conserva el shell visual, pero Auth0 real requiere development build móvil.
- El monograma es temporal; no iniciar branding definitivo sin un plan autorizado.
- No agregar blur, navegación nueva, animaciones decorativas intensas ni librerías de UI fuera del
  execution plan activo.
