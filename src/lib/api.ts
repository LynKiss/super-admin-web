import {
  getSession,
  isAccessTokenExpired,
  setSession,
} from './session';
import type {
  AuditLog,
  PermissionSet,
  Project,
  ProjectAdmin,
  ProjectFormInput,
  ProjectPermission,
  Session,
} from '../types';

const API_BASE_URL =
  (import.meta.env.VITE_SUPER_ADMIN_API_BASE_URL as string | undefined)?.replace(/\/+$/, '') ??
  'http://localhost:8100/api/super-admin';

type Envelope<T> = {
  statusCode: number;
  message: string;
  data: T;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const body = text ? (JSON.parse(text) as Envelope<T> | { message?: string | string[] }) : null;

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'message' in body && body.message
        ? Array.isArray(body.message)
          ? body.message[0]
          : body.message
        : `Yeu cau that bai voi HTTP ${response.status}`;
    throw new ApiError(message, response.status);
  }

  if (body && typeof body === 'object' && 'data' in body) {
    return (body as Envelope<T>).data;
  }

  return body as T;
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const headers = new Headers(init?.headers);
  const session = getSession();

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (session?.accessToken) {
    headers.set('Authorization', `Bearer ${session.accessToken}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && retry) {
    try {
      await refreshSession();
      return request<T>(path, init, false);
    } catch {
      setSession(null);
    }
  }

  return parseResponse<T>(response);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function bootstrapSession() {
  const session = getSession();
  if (session && !isAccessTokenExpired(session.accessToken)) {
    return session;
  }

  try {
    return await refreshSession();
  } catch {
    setSession(null);
    return null;
  }
}

export async function login(email: string, password: string) {
  const data = await request<{
    access_token: string;
    access_token_expires_in: number;
    refresh_token_expires_in: number;
    user: Session['user'];
  }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    },
    false,
  );

  const session: Session = {
    accessToken: data.access_token,
    user: data.user,
  };
  setSession(session);
  return session;
}

export async function refreshSession() {
  const data = await request<{
    access_token: string;
    access_token_expires_in: number;
    user: Session['user'];
  }>('/auth/refresh', { method: 'GET' }, false);

  const session: Session = {
    accessToken: data.access_token,
    user: data.user,
  };
  setSession(session);
  return session;
}

export async function logout() {
  try {
    await request('/auth/logout', { method: 'POST' }, false);
  } finally {
    setSession(null);
  }
}

export const superAdminApi = {
  listProjects: () => request<Project[]>('/projects'),

  createProject: (input: ProjectFormInput) =>
    request<Project>('/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  updateProject: (
    projectId: string,
    input: Partial<Pick<ProjectFormInput, 'name' | 'baseUrl' | 'status' | 'syncSecret'>>,
  ) =>
    request<Project>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteProject: (projectId: string) =>
    request<{ deleted: boolean; projectId: string }>(`/projects/${encodeURIComponent(projectId)}`, {
      method: 'DELETE',
    }),

  listPermissions: (projectId: string) =>
    request<ProjectPermission[]>(`/projects/${encodeURIComponent(projectId)}/permissions`),

  listAdmins: (projectId: string) =>
    request<ProjectAdmin[]>(`/projects/${encodeURIComponent(projectId)}/admins`),

  listPermissionSets: (projectId: string) =>
    request<PermissionSet[]>(`/projects/${encodeURIComponent(projectId)}/permission-sets`),

  applyPermissions: (
    projectId: string,
    userId: string,
    permissionKeys: string[],
    targetEmail?: string,
  ) =>
    request(`/projects/${encodeURIComponent(projectId)}/admins/${encodeURIComponent(userId)}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissionKeys, targetEmail }),
    }),

  listAuditLogs: (projectId?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (projectId) params.set('projectId', projectId);
    return request<AuditLog[]>(`/audit-logs?${params.toString()}`);
  },
};
