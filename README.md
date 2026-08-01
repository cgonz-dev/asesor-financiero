# Copiloto Financiero

Copiloto Financiero es una aplicación móvil de gestión financiera personal y para hogares,
inicialmente enfocada en parejas. Convertirá lenguaje natural en propuestas financieras
estructuradas y explicaciones útiles, sin convertir a la IA en fuente de verdad.

> La IA interpreta, pregunta, propone y solicita acciones. El backend valida, calcula, persiste y
> conserva la verdad financiera.

## Estado actual

- **Fase 1 iniciada:** se completó su historia inicial de bootstrap técnico y health contractual.
- La Fase 1 completa continúa abierta.
- Existe código mínimo no financiero para API, móvil, contratos y configuración compartida.
- No existen autenticación, base de datos, ledger, operaciones monetarias ni integración de IA.
- ADR-001 y ADR-007 permanecen aceptados.

## Arquitectura implementada en este incremento

- monorepo TypeScript con pnpm workspaces;
- API NestJS con `GET /api/v1/health` y documentación local en `/api/docs`;
- aplicación React Native con Expo y Expo Router, exportable para web;
- `packages/contracts` independiente de frameworks, con Zod como fuente canónica;
- cliente REST móvil con transporte inyectable, timeout, cancelación y validación de respuesta;
- configuraciones compartidas de TypeScript, ESLint y Prettier;
- OpenAPI 3.1 reproducible en `apps/api/openapi/openapi.json`;
- pruebas unitarias, de integración, E2E y de límites arquitectónicos.

No se añadió `/readiness`: todavía no hay base de datos, cola ni otra dependencia externa que
permita distinguir readiness de health.

La arquitectura completa prevista se mantiene en
[`docs/04-architecture.md`](docs/04-architecture.md).

## Versiones de bootstrap

| Herramienta | Versión seleccionada |
|---|---|
| Node.js | 24.x LTS |
| pnpm | 11.9.0 |
| TypeScript | 6.0.3 |
| NestJS | 11.1.28 |
| Zod | 4.4.3 |
| `nestjs-zod` | 5.5.0 |
| Expo / Expo Router | 57.0.9 |
| React Native / React | 0.86.2 / 19.2.3 |

El adaptador `nestjs-zod` vive solo en `apps/api`: `createZodDto` deriva el adaptador de Nest y
OpenAPI desde el schema compartido, y el interceptor de serialización valida la salida. El servidor
usa una variante estricta; el cliente usa una variante compatible derivada del mismo schema base.
`cleanupOpenApiDoc` produce el JSON Schema/OpenAPI 3.1 sin introducir NestJS en
`packages/contracts`.

## Estructura

```text
apps/
  api/                 # NestJS, health y OpenAPI
  mobile/              # Expo Router y cliente REST
packages/
  contracts/           # schemas Zod y tipos inferidos
  domain/              # esqueleto documental, todavía sin reglas
  config/              # esqueleto de configuración no sensible
  eslint-config/
  typescript-config/
tests/                 # verificaciones arquitectónicas
docs/
  adr/
```

## Guía rápida para verlo en el navegador

La primera vez, abre una terminal en la raíz del proyecto y ejecuta:

```bash
pnpm install
```

Después usa dos terminales abiertas en la raíz:

```bash
# Terminal 1: API
pnpm dev:api
```

Espera a que aparezca `Nest application successfully started`.

```bash
# Terminal 2: aplicación web
pnpm --filter @copiloto/mobile web
```

Abre `http://localhost:8081`. La pantalla debe indicar que la API está conectada. La documentación
interactiva de la API queda en `http://localhost:3000/api/docs`. Para detener todo, presiona
`Ctrl+C` en cada terminal.

## Instalación y ejecución

Requisitos: Node.js 24 LTS y pnpm 11.9.0. El `packageManager` de la raíz permite que Corepack
seleccione la versión exacta.

```bash
pnpm install
pnpm dev:api
```

La API escucha de forma predeterminada en `http://localhost:3000` y admite el loopback local tanto
por IPv4 como por IPv6:

- health: `http://localhost:3000/api/v1/health`;
- Swagger UI: `http://localhost:3000/api/docs`.

Para navegador, la API permite por defecto solo los orígenes locales de Expo
`http://localhost:8081` y `http://127.0.0.1:8081`, sin credenciales. Si el servidor web usa otro
origen, define `CORS_ALLOWED_ORIGINS` como una lista explícita separada por comas antes de arrancar
la API. No uses `*`.

En otra terminal:

```bash
pnpm dev:mobile
```

Expo usa `http://localhost:3000` como valor local predeterminado. Para configurar otro host, copia
`.env.example` como `apps/mobile/.env.local` y establece `EXPO_PUBLIC_API_URL` sin una diagonal
final:

- web: `http://localhost:3000`;
- emulador Android: `http://10.0.2.2:3000`;
- dispositivo físico: `http://<IP-LAN-DE-LA-COMPUTADORA>:3000`.

No se debe guardar una IP personal, token o secreto en archivos versionados.

## Controles

```bash
pnpm install --frozen-lockfile
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
en pull requests dirigidos a `main` y de forma manual. Instala con lockfile congelado y ejecuta los
controles anteriores, incluida la generación y comprobación de OpenAPI; también falla si el
artefacto generado difiere del versionado. No despliega ni publica paquetes.

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
2. Sigue el orden de [`docs/00-index.md`](docs/00-index.md).
3. Consulta el roadmap y los ADR relacionados con una sola historia activa.
4. No asumas decisiones que afecten saldos, auditoría, seguridad o privacidad.
5. No incluyas secretos ni hagas commit, push o cambios de rama sin autorización explícita.

## Limitaciones conocidas

- El análisis de cambios incompatibles de OpenAPI aún no existe; CI solo verifica que el artefacto
  generado permanezca actualizado.
- No se validó un binario nativo en Android/iOS; sí se validó la exportación web de Expo.
- Health solo representa la vida del proceso porque todavía no hay dependencias externas.

## Próxima historia recomendada

Revisar, versionar y publicar la CI inicial; después comprobar una ejecución real en GitHub Actions
antes de declarar cerrada la Fase 1.
