export type Role = 'owner' | 'admin' | 'developer' | 'viewer';

export interface WorkspaceInvite {
    id: string;
    token: string;
    url: string;
    role: Role;
    email?: string;
    expires_at: string;
    created_at: string;
}
export type Visibility = 'public' | 'private';
export type Provider = 'github' | 'gitlab';

export interface ConnectedAccount {
    id: string;
    provider: Provider;
    username: string;
    avatar_url?: string;
    created_at: string;
}

export interface User {
    id: string;
    email: string;
    username: string;
    avatar_url?: string;
    created_at: string;
}

export interface Token {
    access_token: string;
    token_type: string;
}

export interface WorkspaceMember {
    user: User;
    role: Role;
    joined_at: string;
}

export interface Workspace {
    id: string;
    name: string;
    slug: string;
    owner_id: string;
    member_count: number;
    created_at: string;
}

export interface ProjectStats {
    documented_files: number;
    total_files: number;
    documented_commits: number;
    total_commits: number;
    active_contributors: number;
    documentation_coverage: number;
}

export interface Project {
    id: string;
    workspace_id: string;
    name: string;
    slug: string;
    description?: string;
    repo_url: string;
    default_branch: string;
    local_path?: string;
    visibility: Visibility;
    last_synced_at?: string;
    created_at: string;
    stats?: ProjectStats;
}

export interface Commit {
    id?: string;
    sha: string;
    message: string;
    author_name: string;
    author_email: string;
    committed_at: string;
    is_documented: boolean;
    files_changed?: string[];
}

export interface FileNode {
    path: string;
    name: string;
    type: 'file' | 'directory';
    language?: string;
    is_documented?: boolean;
    is_modified?: boolean;
    children?: FileNode[];
}

export interface Document {
    id: string;
    project_id: string;
    file_path: string;
    commit_sha: string;
    content: string;
    author: User;
    created_at: string;
    updated_at: string;
}

export interface Comment {
    id: string;
    document_id: string;
    author: User;
    content: string;
    line_number?: number;
    created_at: string;
    updated_at: string;
}

export interface CodeReference {
    id: string;
    project_id: string;
    file_path: string;
    commit_sha: string;
    line_start: number;
    line_end: number;
    lines?: number[] | null;
    label?: string | null;
    note?: string | null;
    color?: string | null;
    author?: User | null;
    created_at: string;
    updated_at: string;
}

export interface SearchResult {
    type: 'code' | 'doc' | 'commit' | 'file' | 'project';
    title: string;
    excerpt?: string;
    path?: string;
    language?: string;
    project_id?: string;
    workspace_id?: string;
    sha?: string;
}

export interface SearchResults {
    docs: SearchResult[];
    commits: SearchResult[];
    files: SearchResult[];
    code: SearchResult[];
    projects: SearchResult[];
    total: number;
}

export interface Notification {
    id: string;
    content: string;
    read: boolean;
    created_at: string;
}