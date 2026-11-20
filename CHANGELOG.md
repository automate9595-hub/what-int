# Changelog

## 0.4.0 (Etapa 4: WhatsApp oficial)
- Webhook de Meta con verificación de firma; recepción de mensajes y estados; sin duplicados
- Envío de texto por Cloud API (ventana de 24 h), tokens cifrados, conexión de números verificada con Meta
- Bandeja de mensajes: conversaciones, historial, respuesta humana, pausar IA, importante, asignar, cerrar

## 0.3.1
- Superadmin: crear empresas completas (plan, administrador, contacto y números de WhatsApp), editar datos, plan y suscripción, asignar/quitar números, cambiar contraseñas
- Datos de contacto y ubicación por empresa; números de WhatsApp registrados (conexión real en la Etapa 4)
- Web de empresa: Agenda, Clientes, Servicios, Horarios y Agentes

## 0.3.0 (Etapa 3, parte 1: servidor)
- Servicios, clientes, horarios de atención, bloqueos, disponibilidad y reservas (sin dobles reservas: candado por empresa en transacción)
- Agentes de IA (solo configuración) con límite según plan
- Zona horaria por empresa (por defecto Buenos Aires)
- Panel de planes simplificado (campos en vez de JSON)

## 0.2.1 (Etapa 2, parte 2: web)
- apps/web: login, registro, panel de empresa (datos, plan, usuarios) y panel de superadmin (empresas, planes, auditoría), modo claro/oscuro
- render.yaml: sitio estático aiba-web; CI compila también la web

## 0.2.0 (Etapa 2, parte 1: servidor)
- Panel de superadmin: empresas, suspensión/reactivación (revoca sesiones), planes, auditoría
- Gestión de usuarios por empresa con aislamiento por tenantId y límite según plan
- Datos y uso de la empresa propia (/tenant/me)

## 0.1.0 (Etapa 1)
- Monorepo, Docker Compose, esquema Prisma inicial, seed
- API NestJS: autenticación JWT con refresh rotativo, roles, auditoría, health, Swagger
