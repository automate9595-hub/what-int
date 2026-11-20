# Arquitectura (Etapa 1)

- `apps/api`: NestJS. Guards globales: throttling, JWT (`@Public()` para excepciones) y roles (`@Roles()`).
- `packages/database`: esquema Prisma y seed.
- Roles: SUPER_ADMIN (sin tenant), TENANT_ADMIN y OPERATOR (con tenant).
- Sesiones: access token de 15 min; refresh token aleatorio guardado como hash SHA-256, rotado en cada uso. Si se reutiliza uno ya rotado, se revocan todas las sesiones del usuario.
- Cuentas suspendidas (usuario o empresa) no pueden iniciar sesión ni renovar tokens.
- Próximas carpetas: `apps/web`, `apps/worker`, `packages/{shared,ai-engine,whatsapp,scheduling,billing}`.
