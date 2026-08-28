# API — instrucciones locales

Aplica además el [`AGENTS.md` raíz](../../AGENTS.md) y el execution plan activo.

- La identidad proviene exclusivamente de `AuthenticatedUserContext`, después de verificar el
  access token. No aceptes `userId`, correo, roles o permisos del cliente como autoridad.
- `householdId` es contexto solicitado, nunca autorización. Resuelve `User + Household +
  Active HouseholdMembership` y aplica policies con denegación por defecto.
- No disperses decisiones de acceso en controladores o repositorios; usa resolvers/policies y
  consultas acotadas por hogar. No expongas existencia de recursos ajenos ni errores internos.
- Toda interfaz pública nace en `packages/contracts`, mantiene OpenAPI y consumidores sincronizados
  y serializa modelos de salida explícitos.
- Las escrituras relacionadas son atómicas y las acciones sensibles conservan auditoría sin
  secretos ni datos privados innecesarios.
- Consulta [ADR-005](../../docs/adr/0005-autenticacion-y-ciclo-de-sesion-movil.md),
  [ADR-006](../../docs/adr/0006-autorizacion-roles-visibilidad-y-aislamiento.md) y
  [ADR-007](../../docs/adr/0007-contratos-validacion-openapi-y-cliente.md) según el límite tocado.

