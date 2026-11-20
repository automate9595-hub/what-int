# AI Business Assistant

Plataforma SaaS multiempresa de agentes de IA para WhatsApp. Este repositorio contiene la **Etapa 1**: monorepo, base de datos, autenticación y API base.

## Requisitos
- Node.js 20+
- Docker (para PostgreSQL y Redis locales)

## Sin consola: todo desde GitHub
1. Subí todo el contenido del zip al repositorio (incluida la carpeta oculta `.github`; si tu navegador no la sube, creá `.github/workflows/ci.yml` con "Add file > Create new file" y pegá su contenido).
2. En la pestaña **Actions** de GitHub, el workflow **CI** instala, compila y prueba solo. Si queda en verde, la Etapa 1 funciona.
3. Creá una base gratis en **Neon** y copiá su `DATABASE_URL`.
4. En **Render** elegí "New > Blueprint", conectá el repositorio y completá `DATABASE_URL`, `CORS_ORIGINS`, `SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`. Cada vez que subas cambios a GitHub, Render vuelve a desplegar.
5. Abrí `https://TU-SERVICIO.onrender.com/health` y `/docs`.

Nota: el plan gratuito de Render duerme el servicio tras 15 minutos sin uso y tarda unos segundos en despertar. El arranque usa `prisma db push` (crea las tablas sin migraciones); antes de tener clientes reales lo cambiamos por migraciones versionadas.

## Web (apps/web)
Next.js exportado como sitio estático (`output: 'export'`), servido gratis por Render como `aiba-web`. Páginas: `/login/`, `/register/`, `/admin/` (superadmin) y, para cada empresa: `/dashboard/`, `/mensajes/`, `/agenda/`, `/clientes/`, `/servicios/`, `/horarios/`, `/agentes/`. Usa la API definida en `NEXT_PUBLIC_API_URL`.
Después del primer despliegue, en el servicio `aiba-api` de Render poné `CORS_ORIGINS` con la dirección de la web (sin barra final), por ejemplo `https://aiba-web.onrender.com`.

## Puesta en marcha local (opcional)
```bash
cp .env.example .env        # editá JWT_SECRET (mínimo 32 caracteres) y la clave del superadmin
docker compose up -d        # PostgreSQL y Redis
npm install
npm run db:generate
npm run db:migrate -- --name init   # crea la primera migración y las tablas
npm run db:seed             # planes y superadministrador
npm run dev                 # API en http://localhost:3001  (Swagger: /docs)
npm test
```

## Endpoints de la Etapa 1
| Método | Ruta | Descripción |
|---|---|---|
| POST | /auth/register | Crea empresa + administrador (prueba de 14 días) |
| POST | /auth/login | Inicio de sesión |
| POST | /auth/refresh | Rota el refresh token |
| POST | /auth/logout | Revoca la sesión |
| GET | /auth/me | Perfil del usuario autenticado |
| GET | /health | Estado de la API y la base de datos |
| GET | /tenant/me | Datos, plan y uso de mi empresa (admin y operador) |
| PATCH | /tenant/me | Cambiar el nombre de mi empresa (admin) |
| GET, POST | /users | Listar y crear usuarios de mi empresa (admin) |
| PATCH | /users/:id | Editar, cambiar rol o desactivar usuario (admin) |
| GET | /admin/tenants, /admin/tenants/:id | Empresas (solo superadmin) |
| PATCH | /admin/tenants/:id/status | Suspender o reactivar empresa (superadmin) |
| GET, PATCH | /admin/plans, /admin/plans/:id | Planes y límites (superadmin) |
| GET | /admin/audit-logs | Registro de auditoría (superadmin) |
| GET, POST, PATCH | /services | Servicios de la empresa (crear y editar: admin) |
| GET, POST, PATCH | /contacts | Clientes (búsqueda con `?q=`) |
| GET, PUT | /schedule/hours | Horarios de atención (editar: admin) |
| GET, POST, DELETE | /schedule/blocks | Bloqueos de agenda |
| GET | /schedule/availability?date=AAAA-MM-DD&serviceId= | Horarios libres |
| GET, POST, PATCH | /appointments | Reservas: listar por fechas, crear, reprogramar, cancelar |
| POST | /admin/tenants | Crear empresa completa: plan, administrador, contacto y números (superadmin) |
| PATCH | /admin/tenants/:id, /admin/tenants/:id/subscription | Editar datos, plan y suscripción (superadmin) |
| POST, DELETE | /admin/tenants/:id/numbers, /admin/numbers/:id | Asignar y quitar números de WhatsApp (superadmin) |
| POST | /admin/users/:id/password | Cambiar la contraseña de un usuario de una empresa (superadmin) |
| POST | /admin/numbers/:id/connect, /admin/numbers/:id/disconnect | Conectar (verificando con Meta) o desconectar un número (superadmin) |
| GET, POST | /webhooks/whatsapp | Webhook de Meta (verificación y mensajes firmados) |
| GET, PATCH | /conversations, /conversations/:id | Bandeja de mensajes: listar, ver, pausar IA, asignar, cerrar |
| POST | /conversations/:id/messages | Responder a un cliente por WhatsApp |
| GET, POST, PATCH | /agents | Agentes de IA (configuración; el motor llega en la Etapa 5) |

## Despliegue gratuito (referencia)
- PostgreSQL: Neon o Supabase (plan gratis) → `DATABASE_URL`
- Redis: Upstash (plan gratis) → `REDIS_URL`
- API: VM Oracle Cloud Always Free con Docker (`infrastructure/Dockerfile.api`) u otro hosting gratuito
- Archivos (Etapa 3+): Cloudflare R2, 10 GB gratis, con límites por plan

## Aislamiento multiempresa
Cada tabla de negocio tendrá `tenantId`. El `tenantId` sale **solo del token verificado** (nunca del cuerpo de la petición) y toda consulta se filtra por él.
