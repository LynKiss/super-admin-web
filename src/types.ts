export type SuperAdminUser = {
  _id: string;
  email: string;
  fullName?: string | null;
  isSuperAdmin: true;
  mfaEnabled?: boolean;
};

export type Session = {
  accessToken: string;
  user: SuperAdminUser;
};

export type ProjectStatus = 'active' | 'disabled';

export type Project = {
  _id: string;
  projectId: string;
  name: string;
  baseUrl: string;
  status: ProjectStatus;
  syncSecretConfigured: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectFormInput = {
  projectId: string;
  name: string;
  baseUrl: string;
  status: ProjectStatus;
  syncSecret: string;
};

export type ProjectPermission = {
  permissionId?: string;
  permissionKey: string;
  permissionName: string;
};

export type ProjectAdmin = {
  userId: string;
  username: string;
  email: string;
  fullName: string | null;
  role: string;
  isActive: boolean;
  hasOverride: boolean;
  permissionKeys: string[] | null;
};

export type PermissionSet = {
  _id: string;
  projectId: string;
  targetUserId: string;
  targetEmail: string | null;
  permissionKeys: string[];
  updatedBy: string;
  createdAt?: string;
  updatedAt?: string;
};

export type AuditLog = {
  _id: string;
  actorEmail?: string | null;
  action: string;
  projectId?: string | null;
  targetUserId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  createdAt?: string;
};

export type ProjectDetail = {
  permissions: ProjectPermission[];
  admins: ProjectAdmin[];
  permissionSets: PermissionSet[];
  auditLogs: AuditLog[];
};
