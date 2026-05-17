'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { workspacesApi } from '@/lib/api';
import { Workspace } from '@/types';
import WorkspaceNav from '@/components/layout/WorkspaceNav';
import Topbar from '@/components/layout/Topbar';
import Button from '@/components/ui/Button';
import { Trash2, AlertTriangle } from 'lucide-react';

export default function WorkspaceSettingsPage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [name, setName] = useState('');
    const [confirmDelete, setConfirmDelete] = useState('');
    const [deleteError, setDeleteError] = useState('');

    const { data: workspace, isLoading } = useQuery<Workspace>({
        queryKey: ['workspace', workspaceId],
        queryFn: async () => {
            const res = await workspacesApi.get(workspaceId);
            setName(res.data.name);
            return res.data;
        },
    });

    const updateName = useMutation({
        mutationFn: () => workspacesApi.update(workspaceId, { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspace', workspaceId] });
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
        },
    });

    const deleteWorkspace = useMutation({
        mutationFn: () => workspacesApi.delete(workspaceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            router.push('/');
        },
        onError: (err: any) => {
            setDeleteError(err.response?.data?.detail || 'Unable to delete this workspace');
        },
    });

    const breadcrumbs = [
        { label: workspace?.name || 'Workspace', href: `/workspace/${workspaceId}` },
        { label: 'Settings' },
    ];

    if (isLoading) return null;

    return (
        <>
            <Topbar breadcrumbs={breadcrumbs} />
            <div className="pt-12">
                <WorkspaceNav workspaceId={workspaceId} />

                <div className="max-w-2xl mx-auto px-6 py-6 space-y-6">
                    <h1 className="text-xl font-semibold text-text-primary">Settings</h1>

                    {/* Name */}
                    <section className="bg-surface border border-border rounded-xl p-5">
                        <h2 className="text-base font-medium text-text-primary mb-4">Workspace name</h2>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-strong"
                            />
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={() => updateName.mutate()}
                                isLoading={updateName.isPending}
                                disabled={!name.trim() || name === workspace?.name}
                            >
                                Save
                            </Button>
                        </div>
                        {updateName.isSuccess && (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">Name updated.</p>
                        )}
                    </section>

                    {/* Danger zone */}
                    <section className="bg-surface border border-red-300 dark:border-red-900/60 rounded-xl p-5">
                        <div className="flex items-center gap-2 mb-4">
                            <AlertTriangle size={15} className="text-red-500" />
                            <h2 className="text-base font-medium text-red-600 dark:text-red-400">Danger zone</h2>
                        </div>
                        <p className="text-sm text-text-muted mb-4">
                            Deleting the workspace is irreversible. All projects, documents and annotations will be permanently deleted.
                        </p>
                        <p className="text-sm text-text-secondary mb-2">
                            Type <strong className="font-mono text-text-primary">{workspace?.name}</strong> to confirm:
                        </p>
                        <input
                            type="text"
                            value={confirmDelete}
                            onChange={(e) => { setConfirmDelete(e.target.value); setDeleteError(''); }}
                            placeholder={workspace?.name}
                            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 mb-3"
                        />
                        {deleteError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteWorkspace.mutate()}
                            isLoading={deleteWorkspace.isPending}
                            disabled={confirmDelete !== workspace?.name}
                            className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-300 dark:border-red-900/60 border"
                        >
                            <Trash2 size={13} /> Delete workspace
                        </Button>
                    </section>
                </div>
            </div>
        </>
    );
}
