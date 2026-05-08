import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  AlertCircle,
  Check,
  ExternalLink,
  KeyRound,
  LoaderCircle,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Shield,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { getApiBaseUrl, logout, superAdminApi } from '../lib/api';
import { useSession } from '../hooks/useSession';
import type {
  AuditLog,
  Project,
  ProjectAdmin,
  ProjectDetail,
  ProjectFormInput,
  ProjectPermission,
  ProjectStatus,
} from '../types';

const emptyProjectForm: ProjectFormInput = {
  projectId: '',
  name: '',
  baseUrl: 'http://localhost:8000',
  status: 'active',
  syncSecret: '',
};

const emptyDetail: ProjectDetail = {
  permissions: [],
  admins: [],
  permissionSets: [],
  auditLogs: [],
};

export default function ConsolePage() {
  const session = useSession();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [projectError, setProjectError] = useState<string | null>(null);

  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projectForm, setProjectForm] = useState<ProjectFormInput>(emptyProjectForm);
  const [savingProject, setSavingProject] = useState(false);

  const [detail, setDetail] = useState<ProjectDetail>(emptyDetail);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [selectedAdminId, setSelectedAdminId] = useState('');
  const [selectedPermissionKeys, setSelectedPermissionKeys] = useState<Set<string>>(new Set());
  const [savingPermissions, setSavingPermissions] = useState(false);

  const [adminQuery, setAdminQuery] = useState('');
  const [permissionQuery, setPermissionQuery] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  const selectedProject = projects.find((project) => project.projectId === selectedProjectId) ?? null;
  const selectedAdmin = detail.admins.find((admin) => admin.userId === selectedAdminId) ?? null;

  const filteredAdmins = useMemo(() => {
    const query = adminQuery.trim().toLowerCase();
    if (!query) return detail.admins;
    return detail.admins.filter((admin) =>
      [admin.username, admin.email, admin.fullName ?? '', admin.role]
        .join(' ')
        .toLowerCase()
        .includes(query),
    );
  }, [adminQuery, detail.admins]);

  const filteredPermissions = useMemo(() => {
    const query = permissionQuery.trim().toLowerCase();
    return detail.permissions.filter((permission) => {
      if (!query) return true;
      return [permission.permissionKey, permission.permissionName]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [detail.permissions, permissionQuery]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, ProjectPermission[]>();
    for (const permission of filteredPermissions) {
      const group = permission.permissionKey.split(/[_.:]/)[0] || 'general';
      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredPermissions]);

  const selectedProjectAudit = useMemo(
    () => detail.auditLogs.filter((log) => !selectedProjectId || log.projectId === selectedProjectId),
    [detail.auditLogs, selectedProjectId],
  );

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (!selectedAdmin) {
      setSelectedPermissionKeys(new Set());
      return;
    }
    setSelectedPermissionKeys(new Set(selectedAdmin.permissionKeys ?? []));
  }, [selectedAdminId, detail.admins, selectedAdmin]);

  async function loadProjects() {
    setLoadingProjects(true);
    setProjectError(null);
    try {
      const data = await superAdminApi.listProjects();
      setProjects(data);
      if (!selectedProjectId && data[0]) {
        await openProject(data[0]);
      }
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Cannot load projects.');
    } finally {
      setLoadingProjects(false);
    }
  }

  async function openProject(project: Project) {
    setSelectedProjectId(project.projectId);
    setSelectedAdminId('');
    setDetail(emptyDetail);
    setDetailError(null);
    setLoadingDetail(true);
    setNotice(null);

    try {
      const [permissions, admins, permissionSets, auditLogs] = await Promise.all([
        superAdminApi.listPermissions(project.projectId),
        superAdminApi.listAdmins(project.projectId),
        superAdminApi.listPermissionSets(project.projectId),
        superAdminApi.listAuditLogs(project.projectId, 40),
      ]);

      setDetail({ permissions, admins, permissionSets, auditLogs });
      setSelectedAdminId(admins[0]?.userId ?? '');
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Cannot sync project data.');
    } finally {
      setLoadingDetail(false);
    }
  }

  function startCreateProject() {
    setFormMode('create');
    setEditingProjectId(null);
    setProjectForm(emptyProjectForm);
    setProjectError(null);
    setNotice(null);
  }

  function startEditProject(project: Project) {
    setFormMode('edit');
    setEditingProjectId(project.projectId);
    setProjectForm({
      projectId: project.projectId,
      name: project.name,
      baseUrl: project.baseUrl,
      status: project.status,
      syncSecret: '',
    });
    setProjectError(null);
    setNotice(null);
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateProjectForm(projectForm, formMode);
    if (validationError) {
      setProjectError(validationError);
      return;
    }

    setSavingProject(true);
    setProjectError(null);
    setNotice(null);
    try {
      if (formMode === 'create') {
        const created = await superAdminApi.createProject({
          ...projectForm,
          projectId: projectForm.projectId.trim(),
          name: projectForm.name.trim(),
          baseUrl: normalizeBaseUrl(projectForm.baseUrl),
          syncSecret: projectForm.syncSecret.trim(),
        });
        setProjects((current) => [created, ...current]);
        setProjectForm(emptyProjectForm);
        setNotice('Project registered.');
        await openProject(created);
      } else if (editingProjectId) {
        const payload: Partial<ProjectFormInput> = {
          name: projectForm.name.trim(),
          baseUrl: normalizeBaseUrl(projectForm.baseUrl),
          status: projectForm.status,
        };
        if (projectForm.syncSecret.trim()) {
          payload.syncSecret = projectForm.syncSecret.trim();
        }

        const updated = await superAdminApi.updateProject(editingProjectId, payload);
        setProjects((current) =>
          current.map((project) => (project.projectId === updated.projectId ? updated : project)),
        );
        setNotice('Project updated.');
        startCreateProject();
        if (selectedProjectId === updated.projectId) {
          await openProject(updated);
        }
      }
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Cannot save project.');
    } finally {
      setSavingProject(false);
    }
  }

  async function deleteProject(project: Project) {
    const confirmed = window.confirm(`Delete project "${project.name}"?`);
    if (!confirmed) return;

    setProjectError(null);
    setNotice(null);
    try {
      await superAdminApi.deleteProject(project.projectId);
      setProjects((current) => current.filter((item) => item.projectId !== project.projectId));
      if (selectedProjectId === project.projectId) {
        setSelectedProjectId('');
        setDetail(emptyDetail);
      }
      if (editingProjectId === project.projectId) {
        startCreateProject();
      }
      setNotice('Project deleted.');
    } catch (err) {
      setProjectError(err instanceof Error ? err.message : 'Cannot delete project.');
    }
  }

  function togglePermission(permissionKey: string) {
    setSelectedPermissionKeys((current) => {
      const next = new Set(current);
      if (next.has(permissionKey)) {
        next.delete(permissionKey);
      } else {
        next.add(permissionKey);
      }
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedPermissionKeys((current) => {
      const next = new Set(current);
      for (const permission of filteredPermissions) {
        next.add(permission.permissionKey);
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedPermissionKeys(new Set());
  }

  async function saveAdminPermissions() {
    if (!selectedProject || !selectedAdmin) return;
    if (selectedPermissionKeys.size === 0) {
      const confirmed = window.confirm(
        `Save zero permissions for ${selectedAdmin.email}? This creates an explicit empty override.`,
      );
      if (!confirmed) return;
    }

    setSavingPermissions(true);
    setDetailError(null);
    setNotice(null);
    try {
      const keys = [...selectedPermissionKeys].sort();
      await superAdminApi.applyPermissions(
        selectedProject.projectId,
        selectedAdmin.userId,
        keys,
        selectedAdmin.email,
      );

      setDetail((current) => ({
        ...current,
        admins: current.admins.map((admin) =>
          admin.userId === selectedAdmin.userId
            ? { ...admin, hasOverride: true, permissionKeys: keys }
            : admin,
        ),
      }));
      setNotice('Permissions synced to project backend.');
      const [permissionSets, auditLogs] = await Promise.all([
        superAdminApi.listPermissionSets(selectedProject.projectId),
        superAdminApi.listAuditLogs(selectedProject.projectId, 40),
      ]);
      setDetail((current) => ({ ...current, permissionSets, auditLogs }));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Cannot sync permissions.');
    } finally {
      setSavingPermissions(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  return (
    <div className="console-page">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <span className="brand-icon">
              <Shield size={20} />
            </span>
            <div>
              <strong>Central Super Admin</strong>
              <span>{session?.user.email}</span>
            </div>
          </div>

          <div className="topbar-actions">
            <span className="api-chip">{getApiBaseUrl()}</span>
            <button type="button" className="ghost-button" onClick={() => void handleLogout()}>
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="console-main">
        {(projectError || detailError || notice) && (
          <div className="status-stack">
            {projectError ? <Status tone="error" message={projectError} /> : null}
            {detailError ? <Status tone="error" message={detailError} /> : null}
            {notice ? <Status tone="success" message={notice} /> : null}
          </div>
        )}

        <section className="workspace">
          <aside className="project-column">
            <div className="section-header">
              <div>
                <p className="eyebrow">Registry</p>
                <h1>Projects</h1>
              </div>
              <button type="button" className="icon-button" onClick={startCreateProject} title="New project">
                <Plus size={17} />
              </button>
            </div>

            <form className="project-form" onSubmit={(event) => void saveProject(event)}>
              <div className="two-col">
                <Field
                  label="Project ID"
                  value={projectForm.projectId}
                  disabled={formMode === 'edit'}
                  onChange={(value) => setProjectForm((current) => ({ ...current, projectId: value }))}
                  placeholder="da-quanaosop"
                />
                <Field
                  label="Status"
                  type="select"
                  value={projectForm.status}
                  onChange={(value) =>
                    setProjectForm((current) => ({ ...current, status: value as ProjectStatus }))
                  }
                  options={[
                    { value: 'active', label: 'Active' },
                    { value: 'disabled', label: 'Disabled' },
                  ]}
                />
              </div>
              <Field
                label="Name"
                value={projectForm.name}
                onChange={(value) => setProjectForm((current) => ({ ...current, name: value }))}
                placeholder="Quan Ao Shop"
              />
              <Field
                label="Backend base URL"
                value={projectForm.baseUrl}
                onChange={(value) => setProjectForm((current) => ({ ...current, baseUrl: value }))}
                placeholder="https://project-api.onrender.com"
              />
              <Field
                label={formMode === 'create' ? 'Sync secret' : 'New sync secret'}
                value={projectForm.syncSecret}
                onChange={(value) => setProjectForm((current) => ({ ...current, syncSecret: value }))}
                placeholder={formMode === 'create' ? 'Minimum 16 characters' : 'Leave empty to keep current'}
                type="password"
              />
              <div className="form-actions">
                {formMode === 'edit' ? (
                  <button type="button" className="ghost-button" onClick={startCreateProject}>
                    <X size={15} />
                    Cancel
                  </button>
                ) : null}
                <button type="submit" className="primary-button" disabled={savingProject}>
                  {savingProject ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                  {formMode === 'create' ? 'Register' : 'Save'}
                </button>
              </div>
            </form>

            <div className="project-list">
              {loadingProjects ? (
                <InlineLoading label="Loading projects" />
              ) : projects.length === 0 ? (
                <p className="empty-text">No registered projects.</p>
              ) : (
                projects.map((project) => (
                  <article
                    key={project.projectId}
                    className={`project-item ${selectedProjectId === project.projectId ? 'selected' : ''}`}
                  >
                    <button type="button" onClick={() => void openProject(project)}>
                      <span>
                        <strong>{project.name}</strong>
                        <small>{project.projectId}</small>
                      </span>
                      <StatusPill status={project.status} />
                    </button>
                    <div className="project-actions">
                      <button
                        type="button"
                        className="icon-button flat"
                        onClick={() => startEditProject(project)}
                        title="Edit project"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        className="icon-button danger"
                        onClick={() => void deleteProject(project)}
                        title="Delete project"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </aside>

          <section className="detail-column">
            {!selectedProject ? (
              <div className="empty-state">
                <Shield size={34} />
                <h2>Select a project</h2>
                <p>Project permissions and admins will appear here.</p>
              </div>
            ) : (
              <>
                <div className="project-summary">
                  <div>
                    <p className="eyebrow">Selected project</p>
                    <h2>{selectedProject.name}</h2>
                    <a href={selectedProject.baseUrl} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} />
                      {selectedProject.baseUrl}
                    </a>
                  </div>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void openProject(selectedProject)}
                    disabled={loadingDetail}
                  >
                    {loadingDetail ? <LoaderCircle className="spin" size={16} /> : <RefreshCw size={16} />}
                    Sync
                  </button>
                </div>

                {loadingDetail ? (
                  <InlineLoading label="Syncing project data" />
                ) : (
                  <div className="detail-grid">
                    <section className="admin-panel">
                      <div className="section-header">
                        <div>
                          <p className="eyebrow">Accounts</p>
                          <h2>Admin and staff</h2>
                        </div>
                        <span className="count-chip">{detail.admins.length}</span>
                      </div>
                      <SearchInput
                        value={adminQuery}
                        onChange={setAdminQuery}
                        placeholder="Search account"
                      />
                      <div className="admin-list">
                        {filteredAdmins.map((admin) => (
                          <button
                            type="button"
                            key={admin.userId}
                            className={`admin-row ${selectedAdminId === admin.userId ? 'selected' : ''}`}
                            onClick={() => setSelectedAdminId(admin.userId)}
                          >
                            <span className="avatar">{getInitials(admin)}</span>
                            <span className="admin-meta">
                              <strong>{admin.fullName || admin.username}</strong>
                              <small>{admin.email}</small>
                            </span>
                            <span className="role-chip">{admin.role}</span>
                          </button>
                        ))}
                        {filteredAdmins.length === 0 ? <p className="empty-text">No matching accounts.</p> : null}
                      </div>
                    </section>

                    <section className="permission-panel">
                      <div className="section-header">
                        <div>
                          <p className="eyebrow">Permission override</p>
                          <h2>{selectedAdmin ? selectedAdmin.email : 'Choose account'}</h2>
                        </div>
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void saveAdminPermissions()}
                          disabled={!selectedAdmin || savingPermissions}
                        >
                          {savingPermissions ? <LoaderCircle className="spin" size={16} /> : <Save size={16} />}
                          Apply
                        </button>
                      </div>

                      {selectedAdmin ? (
                        <>
                          <div className="override-note">
                            <KeyRound size={16} />
                            {selectedAdmin.hasOverride
                              ? `${selectedPermissionKeys.size} explicit permissions selected.`
                              : 'This account uses role defaults until you apply an override.'}
                          </div>

                          <div className="permission-toolbar">
                            <SearchInput
                              value={permissionQuery}
                              onChange={setPermissionQuery}
                              placeholder="Search permission"
                            />
                            <button type="button" className="ghost-button" onClick={selectAllVisible}>
                              <Check size={15} />
                              Select visible
                            </button>
                            <button type="button" className="ghost-button" onClick={clearSelection}>
                              <X size={15} />
                              Clear
                            </button>
                          </div>

                          <div className="permission-groups">
                            {groupedPermissions.map(([group, permissions]) => (
                              <div key={group} className="permission-group">
                                <div className="group-title">
                                  <span>{group}</span>
                                  <small>{permissions.length}</small>
                                </div>
                                <div className="permission-grid">
                                  {permissions.map((permission) => {
                                    const checked = selectedPermissionKeys.has(permission.permissionKey);
                                    return (
                                      <label
                                        key={permission.permissionKey}
                                        className={`permission-tile ${checked ? 'checked' : ''}`}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          onChange={() => togglePermission(permission.permissionKey)}
                                        />
                                        <span>
                                          <strong>{permission.permissionName}</strong>
                                          <small>{permission.permissionKey}</small>
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                            {groupedPermissions.length === 0 ? (
                              <p className="empty-text">No matching permissions.</p>
                            ) : null}
                          </div>
                        </>
                      ) : (
                        <div className="empty-state compact">
                          <Users size={28} />
                          <p>Choose an admin or staff account.</p>
                        </div>
                      )}
                    </section>
                  </div>
                )}

                <section className="activity-panel">
                  <div className="section-header">
                    <div>
                      <p className="eyebrow">Audit</p>
                      <h2>Recent changes</h2>
                    </div>
                    <span className="count-chip">{detail.permissionSets.length} overrides</span>
                  </div>
                  <AuditList logs={selectedProjectAudit} />
                </section>
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'select';
  disabled?: boolean;
  options?: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {type === 'select' ? (
        <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      )}
    </label>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="search-input">
      <Search size={15} />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Status({ tone, message }: { tone: 'error' | 'success'; message: string }) {
  const Icon = tone === 'success' ? Check : AlertCircle;
  return (
    <div className={`alert alert-${tone}`}>
      <Icon size={16} />
      <span>{message}</span>
    </div>
  );
}

function StatusPill({ status }: { status: ProjectStatus }) {
  return <span className={`status-pill ${status}`}>{status}</span>;
}

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading">
      <LoaderCircle className="spin" size={18} />
      <span>{label}</span>
    </div>
  );
}

function AuditList({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return <p className="empty-text">No audit events.</p>;
  }

  return (
    <div className="audit-list">
      {logs.map((log) => (
        <div key={log._id} className="audit-row">
          <span>
            <strong>{log.action}</strong>
            <small>{log.actorEmail || 'system'}</small>
          </span>
          <span>
            <small>{log.targetUserId || log.projectId || 'global'}</small>
            <time>{formatDate(log.createdAt)}</time>
          </span>
        </div>
      ))}
    </div>
  );
}

function validateProjectForm(input: ProjectFormInput, mode: 'create' | 'edit') {
  if (mode === 'create' && input.projectId.trim().length < 2) {
    return 'Project ID must be at least 2 characters.';
  }
  if (input.name.trim().length < 2) {
    return 'Project name must be at least 2 characters.';
  }
  try {
    new URL(input.baseUrl);
  } catch {
    return 'Backend base URL is invalid.';
  }
  if (mode === 'create' && input.syncSecret.trim().length < 16) {
    return 'Sync secret must be at least 16 characters.';
  }
  if (mode === 'edit' && input.syncSecret.trim() && input.syncSecret.trim().length < 16) {
    return 'New sync secret must be at least 16 characters.';
  }
  return null;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function getInitials(admin: ProjectAdmin) {
  const label = admin.fullName || admin.username || admin.email;
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(value?: string) {
  if (!value) return '';
  return new Date(value).toLocaleString();
}
