export const MODE: Record<string, string> = { OWN: 'Propio del negocio', PLATFORM: 'De la plataforma' };
export const NUMBER_STATUS: Record<string, string> = { PENDING: 'Pendiente de conexión', CONNECTED: 'Conectado', DISCONNECTED: 'Desconectado' };
export const SUB_STATUS: Record<string, string> = { TRIALING: 'En prueba', ACTIVE: 'Activa', PAST_DUE: 'Pago vencido', SUSPENDED: 'Suspendida', CANCELED: 'Cancelada' };
export const ROLE_LABEL: Record<string, string> = { SUPER_ADMIN: 'Superadministrador', TENANT_ADMIN: 'Administrador', OPERATOR: 'Operador' };
export const money = (cents: number | null) => (cents === null ? '—' : (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' }));
