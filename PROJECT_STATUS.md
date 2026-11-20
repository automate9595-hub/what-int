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

## Etapa 1 verificada por el usuario
CI en verde, API desplegada en Render con base en Neon, registro y login probados en `/docs`.

## Etapa 2, parte 1: servidor (nueva)
| Elemento | Estado |
|---|---|
| /admin: empresas, suspender/reactivar, planes, auditoría (solo SUPER_ADMIN) | Escrito, **no probado** |
| /users: listar, crear, editar, desactivar, con límite de plan | Escrito, **no probado** |
| /tenant/me: datos, plan y uso | Escrito, **no probado** |
| Pruebas unitarias de UsersService (4) | Escritas, **no ejecutadas** |
| Limitación conocida: una empresa suspendida puede usar su token de acceso hasta 15 min (no se puede renovar) | Documentada |
| Web: login, registro, panel de empresa, panel de superadmin (apps/web) | Escrita, **no compilada ni probada** |
| Web: estilos propios (CSS) en lugar de Tailwind; sesión guardada en localStorage (a migrar a cookies httpOnly) | Decisión provisoria |
| Web: Dashboard con gráficos, calendario, conversaciones, agentes | **Pendiente** (etapas siguientes) |

## Etapa 3, parte 1: servidor (nueva)
| Elemento | Estado |
|---|---|
| Servicios, clientes, horarios, bloqueos, disponibilidad | Escrito, **no probado** |
| Reservas con validación de horario, bloqueos, pasado y choques, y candado por empresa | Escrito, **no probado contra la base real** |
| Agentes (solo configuración, límite por plan) | Escrito, **no probado** |
| Pruebas unitarias nuevas (fechas y reservas: 10) | Escritas, **no ejecutadas** |
| Las tablas nuevas se crean al redesplegar (prisma db push) | Pendiente de verificar |
| Superadmin: crear empresa (plan, administrador, contacto, números), editar, plan y suscripción, números, contraseñas | Escrito, **no probado** |
| Números de WhatsApp: solo registro y asignación (estado “Pendiente de conexión”); sin conexión real con Meta | Pendiente (Etapa 4) |
| Web de empresa: Agenda, Clientes, Servicios, Horarios, Agentes | Escrita, **no compilada ni probada** |
| Agenda web: sin reprogramar reservas todavía (el servidor sí lo permite); sin vista semanal/mensual | Pendiente |
| Limitaciones: sin feriados, sin descansos, una sola agenda por empresa (sin profesionales) | Pendiente |

## Etapa 4: WhatsApp oficial (nueva)
| Elemento | Estado |
|---|---|
| Webhook (verificación, firma, mensajes, estados) y envío de texto | Escrito, **no probado contra Meta** |
| Conexión de números con verificación y token cifrado | Escrito, **pendiente de credenciales de Meta** |
| Bandeja de mensajes (API y web) | Escrita, **no probada** |
| Pruebas unitarias nuevas (webhook, envío, cifrado: 14) | Escritas, **no ejecutadas** |
| Embedded Signup, plantillas, multimedia, cola de procesamiento (Redis/BullMQ) | **Pendiente** |
| Requiere credenciales: META_APP_SECRET, token permanente, Phone Number ID, WABA ID | Pendiente del usuario (ver docs/WHATSAPP.md) |

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
