# Conexión de WhatsApp (Meta Cloud API)

Estado: el servidor recibe y envía mensajes por la API oficial de Meta. **No está probado contra Meta** (requiere credenciales reales).

## Qué se necesita (una sola vez, en developers.facebook.com)
1. Crear una app de tipo **Empresa** y agregar el producto **WhatsApp**.
2. En **Configuración de la app > Básica**: copiar el **Secreto de la app** y cargarlo en Render (servicio `aiba-api` > Environment) como `META_APP_SECRET`.
3. En **WhatsApp > Configuración**: agregar el webhook.
   - URL de devolución de llamada: `https://aiba-api.onrender.com/webhooks/whatsapp`
   - Token de verificación: el valor de `META_VERIFY_TOKEN` en Render.
   - Suscribirse al campo **messages**.
4. Número de prueba: Meta ofrece uno gratuito para desarrollo (envía solo a números verificados). Para números reales hay que agregar y verificar el número del negocio.
5. Token permanente: en **Business settings > Usuarios del sistema** crear un usuario, asignarle la app y la cuenta de WhatsApp y generar un token con los permisos `whatsapp_business_messaging` y `whatsapp_business_management`.

## Conectar un número en la plataforma
Panel de superadmin > Empresas > (empresa) > Números > **Conectar con Meta**: pegar el *Phone Number ID*, el *ID de la cuenta de WhatsApp (WABA)* y el token. Se verifica con Meta antes de guardar; el token queda cifrado (AES-256-GCM, clave `ENCRYPTION_KEY`).

## Reglas de WhatsApp que ya se respetan
- Los pedidos del webhook se aceptan solo con firma válida (`X-Hub-Signature-256`).
- Los mensajes repetidos por reintentos de Meta se descartan (`waMessageId` único).
- Solo se puede responder dentro de las 24 horas desde el último mensaje del cliente; fuera de esa ventana hace falta una plantilla aprobada (pendiente).

## Limitaciones actuales
- No hay Embedded Signup (que cada negocio conecte su propia cuenta con el flujo oficial de Meta): pendiente; requiere una app de Meta verificada.
- Mensajes multimedia: se registran como `[imagen]`, `[audio]`, etc.; todavía no se descargan.
- El plan gratuito de Render duerme el servicio tras 15 minutos sin uso; Meta reintenta los mensajes, pero la primera respuesta puede demorar.
- Las respuestas automáticas con IA llegan en la Etapa 5.
