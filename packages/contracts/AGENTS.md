# Contracts — instrucciones locales

Aplica además el [`AGENTS.md` raíz](../../AGENTS.md) y el execution plan activo.

- Sigue schema-first: Zod es la fuente de formas públicas y los tipos TypeScript se infieren.
- Mantén el paquete independiente de NestJS, Prisma, Auth0, Expo, React Native y OpenAI.
- Separa variantes de servidor estrictas y cliente compatibles desde el mismo schema base.
- No incluyas reglas de dominio, autorización, persistencia ni cálculos financieros.
- Todo cambio público actualiza consumidores, DTO/adaptadores, OpenAPI, pruebas y documentación en
  la misma tarea.
- Sigue [ADR-007](../../docs/adr/0007-contratos-validacion-openapi-y-cliente.md); dinero y fechas no
  se estabilizan antes de sus ADR bloqueantes.

