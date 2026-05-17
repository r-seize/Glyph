'use client';

import { Project } from '@/types';
import { formatRelativeTime } from '@/lib/utils';
import { GitBranch, RefreshCw, ExternalLink, Trash2, X, Check } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { useSyncProject, useDeleteProject } from '@/hooks/useProject';
import { useState } from 'react';

interface ProjectCardProps {
    project: Project;
    workspaceId: string;
}

export default function ProjectCard({ project, workspaceId }: ProjectCardProps) {
    const sync = useSyncProject();
    const del = useDeleteProject(workspaceId);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const stats = project.stats;
    const coverage = stats && stats.total_files > 0
        ? Math.round((stats.documented_files / stats.total_files) * 100)
        : 0;

    return (
        <div className="bg-surface border border-border rounded-xl p-5 hover:border-border-strong transition-colors group">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                    <Link
                        href={`/workspace/${workspaceId}/project/${project.id}`}
                        className="text-base font-medium text-text-primary hover:text-primary transition-colors block truncate"
                    >
                        {project.name}
                    </Link>
                    {project.description && (
                        <p className="text-sm text-text-muted mt-0.5 truncate">{project.description}</p>
                    )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    {confirmDelete ? (
                        <>
                            <Button
                                variant="danger"
                                size="icon"
                                onClick={() => del.mutate(project.id)}
                                isLoading={del.isPending}
                                title="Confirm deletion"
                            >
                                <Check size={13} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDelete(false)}
                                title="Cancel"
                            >
                                <X size={13} />
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => sync.mutate({ projectId: project.id })}
                                isLoading={sync.isPending}
                                title="Sync"
                            >
                                <RefreshCw size={14} />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmDelete(true)}
                                title="Delete project"
                                className="hover:text-red-500"
                            >
                                <Trash2 size={14} />
                            </Button>
                        </>
                    )}
                </div>
            </div>

            {/* Repo URL */}
            <div className="flex items-center gap-1.5 text-sm text-text-muted mb-4">
                <GitBranch size={12} />
                <span className="truncate font-mono">{project.repo_url}</span>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                    {[
                        { value: stats.documented_files, label: 'docs' },
                        { value: stats.total_commits, label: 'commits' },
                        { value: stats.active_contributors, label: 'authors' },
                    ].map((s) => (
                        <div key={s.label} className="bg-surface-1 rounded-lg px-2 py-2 text-center">
                            <p className="text-base font-semibold text-text-primary">{s.value}</p>
                            <p className="text-2xs text-text-muted">{s.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Coverage bar */}
            {stats && (
                <div className="mb-4">
                    <div className="flex justify-between text-xs text-text-muted mb-1.5">
                        <span>Doc coverage</span>
                        <span>{coverage}%</span>
                    </div>
                    <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{ width: `${coverage}%` }}
                        />
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between">
                {project.last_synced_at && (
                    <span className="text-xs text-text-muted">Sync {formatRelativeTime(project.last_synced_at)}</span>
                )}
                {confirmDelete ? (
                    <span className="text-xs text-red-500 font-medium">Delete permanently?</span>
                ) : (
                    <Link href={`/workspace/${workspaceId}/project/${project.id}`}>
                        <Button variant="ghost" size="sm">
                            Open <ExternalLink size={12} />
                        </Button>
                    </Link>
                )}
            </div>
        </div>
    );
}
