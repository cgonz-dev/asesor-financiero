# Domain — instrucciones locales

Aplica además el [`AGENTS.md` raíz](../../AGENTS.md) y el execution plan activo.

- Conserva lógica de dominio pura e independiente de NestJS, Prisma, Expo, OpenAI y adaptadores.
- Expresa invariantes y policies puras con entradas explícitas y denegación por defecto cuando
  corresponda; pruébalas sin framework ni base de datos.
- Usa el vocabulario de [ADR-001](../../docs/adr/0001-idioma-y-vocabulario-canonico.md) y las reglas
  de [`docs/02-domain-rules.md`](../../docs/02-domain-rules.md).
- Para roles, membresías, visibilidad y aislamiento sigue
  [ADR-006](../../docs/adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md).
- No introduzcas dinero, ledger ni reglas futuras sin el execution plan y los ADR bloqueantes.

