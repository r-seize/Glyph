import axios, { AxiosInstance } from 'axios';
import { getToken, removeToken } from './auth';

const api: AxiosInstance = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000',
});

api.interceptors.request.use((config) => {
    const token = getToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

api.interceptors.response.use(
    (response) => response,
    (error) => {
        const url: string = error.config?.url ?? '';
        const isAuthEndpoint = url.includes('/api/auth/login') || url.includes('/api/auth/register');
        if (error.response?.status === 401 && !isAuthEndpoint) {
            removeToken();
            if (typeof window !== 'undefined') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const authApi = {
    register: (data: { username: string; email: string; password: string }) =>
        api.post('/api/auth/register', data),
    login: (data: { email: string; password: string }) =>
        api.post('/api/auth/login', data),
    me: () => api.get('/api/auth/me'),
    config: () => api.get<{ github_oauth: boolean; gitlab_oauth: boolean }>('/api/auth/config'),
    githubUrl: (state?: string) => `${API_BASE}/api/auth/github${state ? `?state=${encodeURIComponent(state)}` : ''}`,
    gitlabUrl: (state?: string) => `${API_BASE}/api/auth/gitlab${state ? `?state=${encodeURIComponent(state)}` : ''}`,
};

export const accountsApi = {
    list: () => api.get('/api/accounts/'),
    disconnect: (accountId: string) => api.delete(`/api/accounts/${accountId}`),
    addGithubToken: (token: string) => api.post('/api/accounts/github/token', { token }),
    addGitlabToken: (token: string) => api.post('/api/accounts/gitlab/token', { token }),
};

export const workspacesApi = {
    list: () => api.get('/api/workspaces/'),
    create: (data: { name: string }) => api.post('/api/workspaces/', data),
    get: (id: string) => api.get(`/api/workspaces/${id}`),
    update: (id: string, data: Partial<{ name: string }>) =>
        api.put(`/api/workspaces/${id}`, data),
    delete: (id: string) => api.delete(`/api/workspaces/${id}`),
    members: (id: string) => api.get(`/api/workspaces/${id}/members`),
    invite: (id: string, data: { email: string; role: string }) =>
        api.post(`/api/workspaces/${id}/invite`, data),
    updateMember: (workspaceId: string, userId: string, data: { role: string }) =>
        api.put(`/api/workspaces/${workspaceId}/members/${userId}`, data),
    removeMember: (workspaceId: string, userId: string) =>
        api.delete(`/api/workspaces/${workspaceId}/members/${userId}`),
    leave: (workspaceId: string) =>
        api.delete(`/api/workspaces/${workspaceId}/leave`),
};

export const projectsApi = {
    list: (workspaceId: string) =>
        api.get(`/api/projects/workspace/${workspaceId}`),
    create: (workspaceId: string, data: {
        name: string;
        repo_url: string;
        description?: string;
        default_branch?: string;
    }) => api.post(`/api/projects/workspace/${workspaceId}`, data),
    get: (id: string) => api.get(`/api/projects/${id}`),
    update: (id: string, data: Partial<{ description: string; default_branch: string; visibility: string }>) =>
        api.put(`/api/projects/${id}`, data),
    delete: (id: string) => api.delete(`/api/projects/${id}`),
    sync: (id: string, force?: boolean, discard_deleted?: boolean) =>
        api.post(`/api/projects/${id}/sync`, null, {
            params: {
                ...(force ? { force: true } : {}),
                ...(discard_deleted ? { discard_deleted: true } : {}),
            },
        }),
    contributors: (id: string, branch?: string) =>
        api.get<{ name: string; email: string; commits: number }[]>(`/api/projects/${id}/contributors`, { params: branch ? { branch } : {} }),
    branches: (id: string) => api.get<string[]>(`/api/files/${id}/branches`),
};

export const filesApi = {
    tree: (projectId: string, commitSha?: string) =>
        api.get(`/api/files/${projectId}/tree`, { params: { commit: commitSha } }),
    content: (projectId: string, path: string, commitSha?: string) =>
        api.get(`/api/files/${projectId}/content`, { params: { path, commit: commitSha } }),
    history: (projectId: string, path: string, branch?: string) =>
        api.get(`/api/files/${projectId}/history`, { params: { path, branch } }),
    languages: (projectId: string) =>
        api.get(`/api/files/${projectId}/languages`),
    branches: (projectId: string) =>
        api.get<string[]>(`/api/files/${projectId}/branches`),
    upload: (projectId: string, files: File[], paths: string[], onProgress?: (pct: number) => void) => {
        const form = new FormData();
        files.forEach((f) => form.append('files', f));
        paths.forEach((p) => form.append('paths', p));
        return api.post(`/api/files/${projectId}/upload`, form, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: onProgress
                ? (e) => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)); }
                : undefined,
        });
    },
};

export const commitsApi = {
    list: (projectId: string, params?: { branch?: string }) =>
        api.get(`/api/commits/${projectId}`, { params }),
    get: (projectId: string, sha: string) =>
        api.get(`/api/commits/${projectId}/${sha}`),
    diff: (projectId: string, sha: string, path?: string) =>
        api.get(`/api/commits/${projectId}/${sha}/diff`, { params: { path } }),
};

export const docsApi = {
    get: (projectId: string, path: string, commitSha: string) =>
        api.get(`/api/docs/${projectId}`, { params: { path, commit: commitSha } }),
    save: (projectId: string, data: { file_path: string; commit_sha: string; content: string }) =>
        api.post(`/api/docs/${projectId}`, data),
    history: (projectId: string, path: string) =>
        api.get(`/api/docs/${projectId}/history`, { params: { path } }),
    comments: (projectId: string, path: string, commitSha: string) =>
        api.get(`/api/docs/${projectId}/comments`, { params: { path, commit: commitSha } }),
    addComment: (projectId: string, data: { content: string; line_number?: number; file_path: string; commit_sha: string }) =>
        api.post(`/api/docs/${projectId}/comments`, { content: data.content, line_number: data.line_number }, {
            params: { path: data.file_path, commit: data.commit_sha },
        }),
    updateComment: (projectId: string, commentId: string, data: { content: string }) =>
        api.put(`/api/docs/${projectId}/comments/${commentId}`, data),
    deleteComment: (projectId: string, commentId: string) =>
        api.delete(`/api/docs/${projectId}/comments/${commentId}`),
};

export const searchApi = {
    search: (query: string, workspaceId?: string, type?: string) =>
        api.get('/api/search/', { params: { q: query, workspace_id: workspaceId, type: type || 'all' } }),
};

export const codeRefsApi = {
    listAll: (projectId: string) =>
        api.get(`/api/code-refs/${projectId}/all`),
    list: (projectId: string, path: string, commitSha: string) =>
        api.get(`/api/code-refs/${projectId}`, { params: { path, commit: commitSha } }),
    create: (projectId: string, data: {
        file_path: string;
        commit_sha: string;
        lines?: number[];
        line_start?: number;
        line_end?: number;
        label?: string | null;
        note?: string | null;
        color?: string | null;
    }) => api.post(`/api/code-refs/${projectId}`, data),
    update: (projectId: string, refId: string, data: Partial<{
        lines: number[];
        line_start: number;
        line_end: number;
        label: string | null;
        note: string | null;
        color: string | null;
    }>) => api.put(`/api/code-refs/${projectId}/${refId}`, data),
    delete: (projectId: string, refId: string) =>
        api.delete(`/api/code-refs/${projectId}/${refId}`),
};

export const githubApi = {
    status: () => api.get('/api/github/status'),
    repos: (accountId?: string) =>
        api.get('/api/github/repos', { params: accountId ? { account_id: accountId } : {} }),
};

export const gitlabApi = {
    status: () => api.get('/api/gitlab/status'),
    repos: (accountId: string) =>
        api.get('/api/gitlab/repos', { params: { account_id: accountId } }),
};

export const invitesApi = {
    getByToken: (token: string) => api.get(`/api/invites/${token}`),
    accept: (token: string) => api.post(`/api/invites/${token}/accept`),
    create: (workspaceId: string, data: { role: string; email?: string }) =>
        api.post(`/api/workspaces/${workspaceId}/invites`, data),
    list: (workspaceId: string) => api.get(`/api/workspaces/${workspaceId}/invites`),
    revoke: (workspaceId: string, inviteId: string) =>
        api.delete(`/api/workspaces/${workspaceId}/invites/${inviteId}`),
};

export const usersApi = {
    profile: (username: string) => api.get(`/api/users/profile/${username}`),
    updateMe: (data: { username?: string; avatar_url?: string }) =>
        api.put('/api/users/me', data),
    changePassword: (data: { current_password: string; new_password: string }) =>
        api.put('/api/users/me/password', data),
    deleteMe: () => api.delete('/api/users/me'),
};

export default api;