# Estado del proyecto

## Etapa 1: Arquitectura, base de datos y autenticación

| Elemento | Estado |
|---|---|
| Monorepo (npm workspaces), Docker Compose (Postgres + Redis) | Escrito, **no probado** |
| Esquema Prisma: Tenant, User, Plan, Subscription, Session, AuditLog | Escrito, **sin migración generada** |
| Seed de planes y superadministrador | Escrito, **no probado** |
| Registro, login, refresh con rotación, logout, /auth/me | Escrito, **no probado** |
| Guards globales de JWT y roles, rate limiting, Helmet, validación, Swagger | Escrito, **no probado** |
| Auditoría de eventos de autenticación | Escrito, **no probado** |
| Pruebas unitarias de AuthService (3) | Escritas, **no ejecutadas** |

El código se escribió en un entorno sin acceso a internet: no se pudieron instalar dependencias, compilar ni ejecutar pruebas. Hasta correr los pasos del README y confirmar que compila y las pruebas pasan, la etapa **no se considera terminada**.

## Entrega por GitHub
| Elemento | Estado |
|---|---|
| Workflow CI (instala, compila y prueba) | Escrito, **no ejecutado** |
| render.yaml (despliegue gratuito de la API desde GitHub) | Escrito, **no probado** |
| Web (apps/web) y APK por GitHub Actions | **Pendiente** (Etapa 2 en adelante) |

## Pendiente
- Etapas 2 a 8 (multiempresa completa y paneles, agentes y agenda, WhatsApp, motor de IA, notificaciones, suscripciones, seguridad y despliegue)
- Frontend (apps/web) y worker (apps/worker)
- Pruebas de integración y end-to-end
- Credenciales externas (Meta, proveedor de IA, Mercado Pago): aún no solicitadas
