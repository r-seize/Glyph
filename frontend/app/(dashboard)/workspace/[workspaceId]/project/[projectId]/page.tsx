'use client';

import { use, useRef, useState } from 'react';
import { useProject, useSyncProject, useBranches, useContributors } from '@/hooks/useProject';
import { useCommits } from '@/hooks/useCommits';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi, filesApi } from '@/lib/api';
import FileTree from '@/components/project/FileTree';
import BranchSelector from '@/components/code/BranchSelector';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { cn } from '@/lib/utils';
import { RefreshCw, Clock, Users, AlertTriangle, Upload, CloudUpload, X, File as FileIcon } from 'lucide-react';
import { formatRelativeTime, shortenSha } from '@/lib/utils';
import Link from 'next/link';
import { Workspace } from '@/types';
import { useRouter } from 'next/navigation';

export default function ProjectPage({ params }: { params: Promise<{ workspaceId: string; projectId: string }> }) {
    const { workspaceId, projectId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    const { data: project, isLoading } = useProject(projectId);
    const sync = useSyncProject();

    const defaultBranch = project?.default_branch ?? 'main';
    const [selectedBranch, setSelectedBranch] = useState<string | null>(null);
    const branch = selectedBranch ?? defaultBranch;

    const { data: branches } = useBranches(projectId);
    const { data: commits } = useCommits(projectId, branch);
    const { data: contributors } = useContributors(projectId, branch);

    // Branch deleted warning modal state
    const [branchDeletedInfo, setBranchDeletedInfo] = useState<{
        branch: string;
        available: string[];
    } | null>(null);

    // Commits deleted warning modal state
    const [commitsDeletedInfo, setCommitsDeletedInfo] = useState<{
        branch: string;
        deleted_commits: { sha: string; short_sha: string; message: string; author_name: string }[];
    } | null>(null);

    // Local import state
    const [importOpen, setImportOpen] = useState(false);
    const [fileEntries, setFileEntries] = useState<{ file: File; path: string }[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    const [uploading, setUploading] = useState(false);
    const filesInputRef = useRef<HTMLInputElement>(null);

    const IGNORE_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '__pycache__', '.venv', 'venv', '.next', '.nuxt', 'out', '.turbo', '.cache', 'vendor', 'target', '.gradle', '.idea', '.vscode', 'coverage', '.mypy_cache', '.pytest_cache', 'tmp', 'temp', 'Pods', 'DerivedData']);
    const IGNORE_FILES = new Set(['.DS_Store', 'Thumbs.db', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'composer.lock', 'Gemfile.lock', 'poetry.lock', 'Pipfile.lock', 'bun.lockb']);
    const IGNORE_EXTS = new Set(['.pyc', '.pyo', '.pyd', '.so', '.dll', '.exe', '.bin', '.log', '.map']);

    const isIgnored = (path: string) => {
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
            if (entry) all.push(...await collectEntries(entry, ''));
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

    const closeImport = () => {
        setImportOpen(false);
        setFileEntries([]);
        setUploadProgress(null);
        setUploading(false);
        setDragOver(false);
    };

    const handleUpload = async () => {
        if (!fileEntries.length) { closeImport(); return; }
        setUploading(true);
        try {
            await filesApi.upload(
                projectId,
                fileEntries.map((e) => e.file),
                fileEntries.map((e) => e.path),
                setUploadProgress,
            );
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            queryClient.invalidateQueries({ queryKey: ['fileTree', projectId] });
            queryClient.invalidateQueries({ queryKey: ['commits', projectId] });
        } finally {
            setUploading(false);
            closeImport();
        }
    };

    const { data: workspace } = useQuery<Workspace>({
        queryKey: ['workspace', workspaceId],
        queryFn: async () => { const res = await workspacesApi.get(workspaceId); return res.data; },
    });

    const handleSync = async () => {
        try {
            await sync.mutateAsync({ projectId });
        } catch (err: any) {
            const detail = err?.response?.data?.detail;
            if (detail?.type === 'branch_deleted') {
                setBranchDeletedInfo({
                    branch: detail.branch,
                    available: detail.available_branches ?? [],
                });
            } else if (detail?.type === 'commits_deleted') {
                setCommitsDeletedInfo({
                    branch: detail.branch,
                    deleted_commits: detail.deleted_commits ?? [],
                });
            }
        }
    };

    const handleForceSync = async () => {
        setBranchDeletedInfo(null);
        await sync.mutateAsync({ projectId, force: true });
    };

    const handleForceSyncDiscard = async () => {
        setCommitsDeletedInfo(null);
        await sync.mutateAsync({ projectId, force: true, discard_deleted: true });
    };

    const handleForceSyncKeep = async () => {
        setCommitsDeletedInfo(null);
        await sync.mutateAsync({ projectId, force: true, discard_deleted: false });
    };

    const breadcrumbs = [
        { label: workspace?.name || 'Workspace', href: `/workspace/${workspaceId}` },
        { label: project?.name || 'Project' },
    ];

    return (
        <>
            <Topbar breadcrumbs={breadcrumbs} />
            <div className="pt-12 flex h-[calc(100vh-0px)] overflow-hidden">
                {/* File tree sidebar */}
                <aside className="w-60 border-r border-border bg-surface-1 flex flex-col flex-shrink-0 overflow-hidden">
                    <div className="px-3 py-2.5 border-b border-border">
                        {project && branches && branches.length > 0 ? (
                            <BranchSelector
                                branches={branches}
                                selected={branch}
                                onSelect={(b) => setSelectedBranch(b)}
                                className="w-full"
                            />
                        ) : (
                            <div className="flex items-center gap-1.5 text-xs text-text-muted font-mono">
                                {defaultBranch}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 overflow-y-auto">
                        {project && (
                            <FileTree
                                projectId={projectId}
                                onSelect={(path) => {
                                    router.push(`/workspace/${workspaceId}/project/${projectId}/file/${path.split('/').map(encodeURIComponent).join('/')}`);
                                }}
                            />
                        )}
                    </div>
                </aside>

                {/* Main content */}
                <main className="flex-1 overflow-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-full text-text-muted text-sm">Loading...</div>
                    ) : project ? (
                        <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
                            {/* Project header */}
                            <div className="flex items-start justify-between">
                                <div>
                                    <h1 className="text-2xl font-semibold text-text-primary mb-1">{project.name}</h1>
                                    {project.description && <p className="text-base text-text-muted">{project.description}</p>}
                                    <div className="flex items-center gap-3 mt-2 text-sm text-text-muted">
                                        <span className="font-mono">{project.repo_url}</span>
                                        {project.last_synced_at && (
                                            <span className="flex items-center gap-1">
                                                <Clock size={11} /> {formatRelativeTime(project.last_synced_at)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {!project.repo_url && (
                                        <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
                                            <Upload size={13} /> Import files
                                        </Button>
                                    )}
                                    {project.repo_url && (
                                        <Button variant="primary" size="sm" onClick={handleSync} isLoading={sync.isPending}>
                                            <RefreshCw size={13} /> Sync
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Stats */}
                            {project.stats && (
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: 'Documented files', value: project.stats.documented_files },
                                        { label: 'Total files', value: project.stats.total_files },
                                        { label: 'Commits', value: commits?.length ?? project.stats.total_commits },
                                        { label: 'Contributors', value: contributors?.length ?? project.stats.active_contributors },
                                    ].map((stat) => (
                                        <div key={stat.label} className="bg-surface-1 border border-border rounded-xl px-4 py-3">
                                            <p className="text-xl font-semibold text-text-primary">{stat.value}</p>
                                            <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Contributors table */}
                            {contributors && contributors.length > 0 && (
                                <div>
                                    <h2 className="text-base font-medium text-text-secondary mb-3 flex items-center gap-2">
                                        <Users size={14} className="text-text-muted" />
                                        Contributors
                                        <span className="text-xs text-text-muted font-normal">({contributors.length})</span>
                                    </h2>
                                    <div className="border border-border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: '35vh' }}>
                                        <table className="w-full text-sm table-fixed">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="border-b border-border bg-surface-1">
                                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Name</th>
                                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted hidden sm:table-cell">Email</th>
                                                    <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted w-24">Commits</th>
                                                </tr>
                                            </thead>
                                        </table>
                                        <div className="overflow-y-auto flex-1">
                                            <table className="w-full text-sm table-fixed">
                                                <tbody className="divide-y divide-border">
                                                    {contributors.map((c) => (
                                                        <tr key={c.email} className="hover:bg-surface-1 transition-colors">
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2.5">
                                                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
                                                                        {c.name.charAt(0).toUpperCase()}
                                                                    </div>
                                                                    <span className="font-medium text-text-primary truncate">{c.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-text-muted hidden sm:table-cell truncate">{c.email}</td>
                                                            <td className="px-4 py-2.5 text-right w-24">
                                                                <span className="text-xs font-mono text-text-secondary">{c.commits}</span>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Commits table */}
                            {commits && commits.length > 0 && (
                                <div>
                                    <h2 className="text-base font-medium text-text-secondary mb-3">
                                        Commits
                                        <span className="ml-1.5 font-mono text-sm text-text-muted">{branch}</span>
                                        <span className="ml-2 text-xs text-text-muted font-normal">({commits.length})</span>
                                    </h2>
                                    <div className="border border-border rounded-xl overflow-hidden flex flex-col" style={{ maxHeight: '50vh' }}>
                                        <table className="w-full text-sm table-fixed">
                                            <thead className="sticky top-0 z-10">
                                                <tr className="border-b border-border bg-surface-1">
                                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted w-20">SHA</th>
                                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted">Message</th>
                                                    <th className="text-left px-4 py-2.5 text-xs font-medium text-text-muted hidden md:table-cell w-32">Author</th>
                                                    <th className="text-right px-4 py-2.5 text-xs font-medium text-text-muted hidden sm:table-cell w-28">Date</th>
                                                    <th className="px-4 py-2.5 w-8" />
                                                </tr>
                                            </thead>
                                        </table>
                                        <div className="overflow-y-auto flex-1">
                                            <table className="w-full text-sm table-fixed">
                                                <tbody className="divide-y divide-border">
                                                    {commits.map((commit) => (
                                                        <tr key={commit.sha} className="hover:bg-surface-1 transition-colors">
                                                            <td className="px-4 py-2.5 w-20">
                                                                <span className="font-mono text-xs text-text-muted">{shortenSha(commit.sha)}</span>
                                                            </td>
                                                            <td className="px-4 py-2.5">
                                                                <p className="text-text-secondary truncate">{commit.message}</p>
                                                            </td>
                                                            <td className="px-4 py-2.5 text-text-muted hidden md:table-cell truncate w-32">{commit.author_name}</td>
                                                            <td className="px-4 py-2.5 text-right text-text-muted hidden sm:table-cell w-28">
                                                                {formatRelativeTime(commit.committed_at)}
                                                            </td>
                                                            <td className="px-4 py-2.5 w-8">
                                                                {commit.is_documented && (
                                                                    <span className="w-2 h-2 rounded-full bg-emerald-500 block mx-auto" title="Documented" />
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}
                </main>
            </div>

            {/* Local import modal */}
            <Modal isOpen={importOpen} onClose={closeImport} title="Import files" size="lg">
                <div className="space-y-4">
                    <div className="flex items-start gap-2.5 text-xs text-text-muted bg-surface-1 rounded-lg px-3 py-2.5 border border-border">
                        <Upload size={13} className="flex-shrink-0 mt-0.5" />
                        <span>Drag a folder or files to add them to the project <strong>{project?.name}</strong>. Existing files will be kept.</span>
                    </div>

                    {/* Drag-and-drop zone */}
                    <div
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                        className={cn(
                            'flex flex-col items-center justify-center gap-2 py-8 rounded-xl border-2 border-dashed transition-colors',
                            dragOver ? 'border-primary bg-primary/5 text-primary' : 'border-border text-text-muted'
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

                    <div className="flex">
                        <button
                            onClick={() => filesInputRef.current?.click()}
                            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm text-text-muted hover:border-border-strong hover:text-text-secondary transition-colors"
                        >
                            <FileIcon size={14} /> Select files
                        </button>
                    </div>

                    <input ref={filesInputRef} type="file" className="hidden" multiple onChange={handleFilePick} />

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

                    {uploadProgress !== null && (
                        <div className="space-y-1">
                            <div className="flex justify-between text-xs text-text-muted">
                                <span>Import in progress…</span>
                                <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                                <div className="h-full bg-primary rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
                            </div>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="ghost" onClick={closeImport} disabled={uploading}>Cancel</Button>
                        <Button variant="primary" onClick={handleUpload} isLoading={uploading} disabled={fileEntries.length === 0 || uploading}>
                            <Upload size={13} /> Import
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Branch deleted warning modal */}
            <Modal
                isOpen={!!branchDeletedInfo}
                onClose={() => setBranchDeletedInfo(null)}
                title="Branch not found on the repository"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-3">
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            The branch <strong className="font-mono">{branchDeletedInfo?.branch}</strong> no longer exists on the remote repository.
                            The documentation associated with this branch will be deleted if you continue.
                        </p>
                    </div>
                    {branchDeletedInfo?.available && branchDeletedInfo.available.length > 0 && (
                        <div>
                            <p className="text-sm text-text-secondary mb-2">Available branches:</p>
                            <div className="flex flex-wrap gap-2">
                                {branchDeletedInfo.available.map((b) => (
                                    <button
                                        key={b}
                                        onClick={() => {
                                            setBranchDeletedInfo(null);
                                            setSelectedBranch(b);
                                        }}
                                        className="px-2.5 py-1 text-xs font-mono bg-surface-1 border border-border rounded-md hover:border-border-strong transition-colors"
                                    >
                                        {b}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                        <Button variant="ghost" onClick={() => setBranchDeletedInfo(null)}>Cancel</Button>
                        <Button variant="danger" onClick={handleForceSync} isLoading={sync.isPending}>
                            Continue anyway
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Commits deleted warning modal */}
            <Modal
                isOpen={!!commitsDeletedInfo}
                onClose={() => setCommitsDeletedInfo(null)}
                title="Commits removed from remote"
            >
                <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-3">
                        <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                            The following commit{commitsDeletedInfo && commitsDeletedInfo.deleted_commits.length > 1 ? 's' : ''} exist locally but{' '}
                            {commitsDeletedInfo && commitsDeletedInfo.deleted_commits.length > 1 ? 'were' : 'was'} removed from{' '}
                            <strong className="font-mono">{commitsDeletedInfo?.branch}</strong> on the remote (force push or rebase).
                        </p>
                    </div>
                    {commitsDeletedInfo && commitsDeletedInfo.deleted_commits.length > 0 && (
                        <div className="space-y-1">
                            {commitsDeletedInfo.deleted_commits.map((c) => (
                                <div key={c.sha} className="flex items-center gap-2.5 px-2.5 py-2 bg-surface-1 border border-border rounded-md text-xs font-mono">
                                    <span className="text-text-muted shrink-0">{c.short_sha}</span>
                                    <span className="text-text-secondary flex-1 truncate">{c.message}</span>
                                    <span className="text-text-muted shrink-0">{c.author_name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="space-y-2 pt-1">
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setCommitsDeletedInfo(null)}>Cancel</Button>
                            <Button variant="secondary" onClick={handleForceSyncKeep} isLoading={sync.isPending}>
                                Sync &amp; keep commits
                            </Button>
                            <Button variant="danger" onClick={handleForceSyncDiscard} isLoading={sync.isPending}>
                                Sync &amp; remove commits
                            </Button>
                        </div>
                        <p className="text-xs text-text-muted text-right">
                            <strong>Keep</strong> - retains the commits in history.{' '}
                            <strong>Remove</strong> - makes local history match remote exactly.
                        </p>
                    </div>
                </div>
            </Modal>
        </>
    );
}
