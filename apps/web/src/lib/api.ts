export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001').replace(/\/$/, '');
const KEY = 'aiba.tokens';

export interface Tokens { accessToken: string; refreshToken: string }
export type Role = 'SUPER_ADMIN' | 'TENANT_ADMIN' | 'OPERATOR';

export interface Me {
  id: string; email: string; name: string; role: Role;
  tenant: { id: string; name: string; slug: string; status: string } | null;
}
export interface TenantSummary {
  id: string; name: string; slug: string; status: 'ACTIVE' | 'SUSPENDED'; createdAt: string; users: number;
  subscription: { status: string; currentPeriodEnd: string; plan: { code: string; name: string } } | null;
}
export interface Plan {
  id: string; code: string; name: string; priceCents: number; currency: string; limits: Record<string, number>; isActive: boolean;
}
export interface TenantInfo {
  id: string; name: string; slug: string; status: string;
  subscription: { status: string; currentPeriodEnd: string; plan: { code: string; name: string; limits: Record<string, number> } } | null;
  usage: { users: number };
}
export interface UserRow { id: string; email: string; name: string; role: Role; isActive: boolean; createdAt: string }
export interface AuditRow {
  id: string; action: string; entity: string | null; entityId: string | null;
  tenantId: string | null; userId: string | null; ip: string | null; createdAt: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Ocurrió un error inesperado');

export function loadTokens(): Tokens | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Tokens) : null;
  } catch { return null; }
}
export function saveTokens(t: Tokens) { try { window.localStorage.setItem(KEY, JSON.stringify(t)); } catch { /* sin almacenamiento */ } }
export function clearTokens() { try { window.localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ } }

function messageOf(body: unknown, fallback: string): string {
  const m = (body as { message?: unknown } | null)?.message;
  if (Array.isArray(m)) return m.join('. ');
  if (typeof m === 'string') return m;
  return fallback;
}

async function send(path: string, method: string, body: unknown, token?: string) {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(0, 'No se pudo conectar con el servidor. Si recién lo abriste, esperá unos segundos y reintentá.');
  }
  const data: unknown = await res.json().catch(() => null);
  return { res, data };
}

// Una sola renovación a la vez: el refresh token rota y reutilizarlo cerraría todas las sesiones.
let refreshing: Promise<Tokens | null> | null = null;
function refreshTokens(): Promise<Tokens | null> {
  if (!refreshing) {
    refreshing = (async () => {
      const current = loadTokens();
      if (!current) return null;
      const { res, data } = await send('/auth/refresh', 'POST', { refreshToken: current.refreshToken });
      if (!res.ok) { clearTokens(); return null; }
      saveTokens(data as Tokens);
      return data as Tokens;
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function api<T = unknown>(path: string, opts: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const method = opts.method ?? 'GET';
  const auth = opts.auth !== false;
  const tokens = auth ? loadTokens() : null;
  let { res, data } = await send(path, method, opts.body, tokens?.accessToken);
  if (res.status === 401 && auth && tokens) {
    const fresh = await refreshTokens();
    if (fresh) ({ res, data } = await send(path, method, opts.body, fresh.accessToken));
  }
  if (!res.ok) throw new ApiError(res.status, messageOf(data, `Error ${res.status}`));
  return data as T;
}

export async function logout() {
  const t = loadTokens();
  if (t) { try { await api('/auth/logout', { method: 'POST', body: { refreshToken: t.refreshToken }, auth: false }); } catch { /* se cierra igual */ } }
  clearTokens();
}
