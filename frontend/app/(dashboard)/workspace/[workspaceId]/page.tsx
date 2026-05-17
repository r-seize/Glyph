'use client';

import { use, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi, accountsApi, filesApi } from '@/lib/api';
import { useProjects, useCreateProject } from '@/hooks/useProject';
import { Workspace, WorkspaceMember, ConnectedAccount } from '@/types';
import ProjectCard from '@/components/project/ProjectCard';
import GitHubReposPicker from '@/components/project/GitHubReposPicker';
import GitLabReposPicker from '@/components/project/GitLabReposPicker';
import WorkspaceNav from '@/components/layout/WorkspaceNav';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { Plus, FolderGit2, Link2, HardDrive, Upload, X, File as FileIcon, CloudUpload } from 'lucide-react';
import GithubIcon from '@/components/ui/icons/GithubIcon';

function GitLabIcon({ size = 14 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
    );
}

type Tab = 'github' | 'gitlab' | 'url' | 'local';

interface RepoLike {
    name: string;
    description: string | null;
    clone_url: string;
    default_branch: string;
}

export default function WorkspacePage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = use(params);
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [tab, setTab] = useState<Tab>('github');
    const [form, setForm] = useState({ name: '', repo_url: '', description: '', default_branch: 'main' });
    const [localForm, setLocalForm] = useState({ name: '', description: '' });
    const [localStep, setLocalStep] = useState<1 | 2>(1);
    const [localProjectId, setLocalProjectId] = useState<string | null>(null);
    const [fileEntries, setFileEntries] = useState<{ file: File; path: string }[]>([]);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const [dragOver, setDragOver] = useState(false);
    const filesInputRef = useRef<HTMLInputElement>(null);

    const { data: workspace } = useQuery<Workspace>({
        queryKey: ['workspace', workspaceId],
        queryFn: async () => { const res = await workspacesApi.get(workspaceId); return res.data; },
    });

    const { data: members } = useQuery<WorkspaceMember[]>({
        queryKey: ['workspaceMembers', workspaceId],
        queryFn: async () => { const res = await workspacesApi.members(workspaceId); return res.data; },
    });

    const { data: allAccounts } = useQuery<ConnectedAccount[]>({
        queryKey: ['connectedAccounts'],
        queryFn: async () => (await accountsApi.list()).data,
    });

    const { data: projects, isLoading: loadingProjects } = useProjects(workspaceId);
    const createProject = useCreateProject(workspaceId);

    const hasGithub = (allAccounts ?? []).some((a) => a.provider === 'github');
    const hasGitlab = (allAccounts ?? []).some((a) => a.provider === 'gitlab');

    const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
        { key: 'github', label: 'GitHub', icon: <GithubIcon size={12} /> },
        { key: 'gitlab', label: 'GitLab', icon: <GitLabIcon size={12} /> },
        { key: 'url', label: 'URL Git', icon: <Link2 size={12} /> },
        { key: 'local', label: 'Local', icon: <HardDrive size={12} /> },
    ];

    const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', '.nuxt', 'out', '.turbo', '.cache', 'vendor', 'target', '.gradle', '.idea', '.vscode', 'coverage', '.mypy_cache', '.pytest_cache', 'tmp', 'temp', 'Pods', 'DerivedData']);
    const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock', 'bun.lockb']);
    const IGNORE_EXTS = new Set(['.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe', '.bin', '.log', '.map']);

    const isIgnored = (path: string): boolean => {
        const parts = path.split('/');
        const filename = parts[parts.length - 1];
        if (filename === '.env' || filename.startsWith('.env.')) return true;
        for (const part of parts.slice(0, -1)) {
            if (IGNORE_DIRS.has(part) || part.startsWith('.env')) return true;
        }
        if (IGNORE_FILES.has(filename)) return true;
        const ext = filename.includes('.') ? '.' + filename.split('.').pop()!.toLowerCase() : '';
        return IGNORE_EXTS.has(ext);
    };

    const addEntries = (newEntries: { file: File; path: string }[]) => {
        const filtered = newEntries.filter(({ path }) => !isIgnored(path));
        setFileEntries((prev) => {
            const existing = new Set(prev.map((e) => e.path));
            return [...prev, ...filtered.filter((e) => !existing.has(e.path))];
        });
    };

    const readAllEntries = (reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> =>
        new Promise((resolve) => {
            const all: FileSystemEntry[] = [];
            const read = () => reader.readEntries((batch) => {
                if (batch.length === 0) resolve(all);
                else { all.push(...batch); read(); }
            });
            read();
        });

    const collectEntries = async (entry: FileSystemEntry, base: string): Promise<{ file: File; path: string }[]> => {
        if (entry.isFile) {
            const file = await new Promise<File>((res) => (entry as FileSystemFileEntry).file(res));
            return [{ file, path: base + entry.name }];
        }
        if (entry.isDirectory) {
            const reader = (entry as FileSystemDirectoryEntry).createReader();
            const children = await readAllEntries(reader);
            const results = await Promise.all(children.map((c) => collectEntries(c, base + entry.name + '/')));
            return results.flat();
        }
        return [];
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        setDragOver(false);
        const items = Array.from(e.dataTransfer.items);
        const all: { file: File; path: string }[] = [];
        for (const item of items) {
            const entry = item.webkitGetAsEntry?.();
            if (entry) {
                const entries = await collectEntries(entry, '');
                all.push(...entries);
            }
        }
        addEntries(all);
    };

    const handleFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = Array.from(e.target.files ?? []).map((f) => ({
            file: f,
            path: (f as any).webkitRelativePath || f.name,
        }));
        addEntries(picked);
        e.target.value = '';
    };

    const reset = () => {
        setForm({ name: '', repo_url: '', description: '', default_branch: 'main' });
        setLocalForm({ name: '', description: '' });
        setLocalStep(1);
        setLocalProjectId(null);
        setFileEntries([]);
        setUploadProgress(null);
        setUploading(false);
        setDragOver(false);
        setTab('github');
    };

    const closeModal = () => { setShowModal(false); reset(); };

    const handleCreate = async () => {
        if (!form.name) return;
        await createProject.mutateAsync(form);
        closeModal();
    };

    const handleLocalNext = async () => {
        if (!localForm.name) return;
        const res = await createProject.mutateAsync({ name: localForm.name, repo_url: '', description: localForm.description, default_branch: 'main' });
        setLocalProjectId(res.data.id);
        setLocalStep(2);
    };

    const handleUpload = async () => {
        if (!localProjectId) { closeModal(); return; }
        if (fileEntries.length === 0) { closeModal(); return; }
        setUploading(true);
        try {
            await filesApi.upload(
                localProjectId,
                fileEntries.map((e) => e.file),
                fileEntries.map((e) => e.path),
                setUploadProgress,
            );
            queryClient.invalidateQueries({ queryKey: ['project', localProjectId] });
            queryClient.invalidateQueries({ queryKey: ['fileTree', localProjectId] });
            queryClient.invalidateQueries({ queryKey: ['commits', localProjectId] });
        } finally {
            setUploading(false);
            closeModal();
        }
    };

    const handleRepoSelect = async (repo: RepoLike) => {
        await createProject.mutateAsync({
            name: repo.name,
            repo_url: repo.clone_url,
            description: repo.description || '',
            default_branch: repo.default_branch || 'main',
        });
        closeModal();
    };

    const breadcrumbs = [
        { label: workspace?.name || 'Workspace', href: `/workspace/${workspaceId}` },
    ];

    return (
        <>
            <Topbar breadcrumbs={breadcrumbs} />
            <div className="pt-12">
                <WorkspaceNav workspaceId={workspaceId} />

                <div className="max-w-6xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-semibold text-text-primary">{workspace?.name}</h1>
                            <p className="text-sm text-text-muted mt-0.5">
                                {projects?.length || 0} project{(projects?.length || 0) > 1 ? 's' : ''} · {members?.length || 0} member{(members?.length || 0) > 1 ? 's' : ''}
                            </p>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                            <Plus size={14} /> Add a project
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {loadingProjects ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="bg-surface-1 border border-border rounded-xl h-48 animate-pulse" />
                            ))
                        ) : projects?.length ? (
                            projects.map((project) => (
                                <ProjectCard key={project.id} project={project} workspaceId={workspaceId} />
                            ))
                        ) : (
                            <div className="col-span-3 flex flex-col items-center justify-center py-20 text-center">
                                <FolderGit2 size={32} className="text-text-muted mb-3" />
                                <p className="text-base text-text-secondary mb-1">No project</p>
                                <p className="text-sm text-text-muted">Import a Git repository to get started</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <Modal isOpen={showModal} onClose={closeModal} title="Add a project" size="lg">
                {/* Tabs */}
                <div className="flex gap-1 mb-4 p-1 bg-surface-1 border border-border rounded-lg w-fit">
                    {tabs.map((t) => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                                tab === t.key
                                    ? 'bg-surface text-text-primary border border-border shadow-sm'
                                    : 'text-text-muted hover:text-text-secondary'
                            )}
                        >
                            {t.icon} {t.label}
                            {t.key === 'github' && hasGithub && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                            )}
                            {t.key === 'gitlab' && hasGitlab && (
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5" />
                            )}
                        </button>
                    ))}
                </div>

                {tab === 'github' && (
                    <GitHubReposPicker onSelect={handleRepoSelect} />
                )}

                {tab === 'gitlab' && (
                    <GitLabReposPicker onSelect={handleRepoSelect} />
                )}

                {tab === 'local' && localStep === 1 && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2.5 text-xs text-text-muted bg-surface-1 rounded-lg px-3 py-2.5 border border-border">
                            <HardDrive size={13} className="flex-shrink-0 mt-0.5" />
                            <span>Create a local project then import your files or folders.</span>
                        </div>
                        {[
                            { label: 'Project name *', key: 'name', placeholder: 'My local project' },
                            { label: 'Description', key: 'description', placeholder: 'Optional description' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label className="block text-sm text-text-secondary mb-1.5">{field.label}</label>
                                <input
                                    type="text"
                                    value={localForm[field.key as keyof typeof localForm]}
                                    onChange={(e) => setLocalForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    placeholder={field.placeholder}
                                    className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                                />
                            </div>
                        ))}
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                            <Button variant="primary" onClick={handleLocalNext} isLoading={createProject.isPending} disabled={!localForm.name.trim()}>
                                Next →
                            </Button>
                        </div>
                    </div>
                )}

                {tab === 'local' && localStep === 2 && (
                    <div className="space-y-4">
                        <div className="flex items-start gap-2.5 text-xs text-text-muted bg-surface-1 rounded-lg px-3 py-2.5 border border-border">
                            <Upload size={13} className="flex-shrink-0 mt-0.5" />
                            <span>Drag your folder or files into the zone below to import them into <strong>{localForm.name}</strong>. You can also skip this step.</span>
                        </div>

                        {/* Drag-and-drop zone */}
                        <div
                            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                            onDragLeave={() => setDragOver(false)}
                            onDrop={handleDrop}
                            className={cn(
                                'flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors',
                                dragOver
                                    ? 'border-primary bg-primary/5 text-primary'
                                    : 'border-border text-text-muted'
                            )}
                        >
                            <CloudUpload size={26} />
                            <span className="text-sm font-medium">
                                {dragOver ? 'Release to import' : 'Drag your folder here'}
                            </span>
                            {!dragOver && (
                                <span className="text-xs text-text-muted text-center max-w-xs">
                                    Only drag-and-drop allows importing a folder without browser confirmation
                                </span>
                            )}
                        </div>

                        {/* File picker button */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => filesInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-text-muted hover:border-border-strong hover:text-text-secondary transition-colors"
                            >
                                <FileIcon size={14} /> Select files
                            </button>
                        </div>
                        <input
                            ref={filesInputRef}
                            type="file"
                            className="hidden"
                            multiple
                            onChange={handleFilePick}
                        />

                        {/* Selected files list */}
                        {fileEntries.length > 0 && (
                            <div className="border border-border rounded-xl overflow-hidden">
                                <div className="px-3 py-2 bg-surface-1 border-b border-border text-xs text-text-muted">
                                    {fileEntries.length} file{fileEntries.length > 1 ? 's' : ''} selected
                                </div>
                                <div className="max-h-40 overflow-y-auto divide-y divide-border">
                                    {fileEntries.map((entry, i) => (
                                        <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                                            <FileIcon size={11} className="text-text-muted flex-shrink-0" />
                                            <span className="flex-1 truncate text-text-secondary font-mono">{entry.path}</span>
                                            <button
                                                onClick={() => setFileEntries((prev) => prev.filter((_, idx) => idx !== i))}
                                                className="text-text-muted hover:text-red-500 flex-shrink-0"
                                            >
                                                <X size={11} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Upload progress */}
                        {uploadProgress !== null && (
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-text-muted">
                                    <span>Import in progress…</span>
                                    <span>{uploadProgress}%</span>
                                </div>
                                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary rounded-full transition-all duration-200"
                                        style={{ width: `${uploadProgress}%` }}
                                    />
                                </div>
                            </div>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={closeModal} disabled={uploading}>Skip</Button>
                            <Button
                                variant="primary"
                                onClick={handleUpload}
                                isLoading={uploading}
                                disabled={fileEntries.length === 0 || uploading}
                            >
                                <Upload size={13} /> Import
                            </Button>
                        </div>
                    </div>
                )}

                {tab === 'url' && (
                    <div className="space-y-4">
                        {[
                            { label: 'Project name *', key: 'name', placeholder: 'My API', type: 'text' },
                            { label: 'Repository URL *', key: 'repo_url', placeholder: 'https://github.com/user/repo.git', type: 'url' },
                            { label: 'Description', key: 'description', placeholder: 'Optional description', type: 'text' },
                            { label: 'Default branch', key: 'default_branch', placeholder: 'main', type: 'text' },
                        ].map((field) => (
                            <div key={field.key}>
                                <label className="block text-sm text-text-secondary mb-1.5">{field.label}</label>
                                <input
                                    type={field.type}
                                    value={form[field.key as keyof typeof form]}
                                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                                    placeholder={field.placeholder}
                                    className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                                />
                            </div>
                        ))}
                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                            <Button variant="primary" onClick={handleCreate} isLoading={createProject.isPending}>
                                Import
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
