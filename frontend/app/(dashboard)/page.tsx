'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { workspacesApi, authApi } from '@/lib/api';
import { Workspace, User } from '@/types';
import Link from 'next/link';
import { Plus, FolderOpen, ArrowRight, Users, BookOpen } from 'lucide-react';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Topbar from '@/components/layout/Topbar';
import { formatRelativeTime } from '@/lib/utils';

export default function DashboardPage() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showModal, setShowModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    const { data: workspaces, isLoading } = useQuery<Workspace[]>({
        queryKey: ['workspaces'],
        queryFn: async () => { const res = await workspacesApi.list(); return res.data; },
    });

    const { data: user } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => { const res = await authApi.me(); return res.data; },
    });

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await workspacesApi.create({ name: newName.trim() });
            queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            setShowModal(false);
            setNewName('');
            router.push(`/workspace/${res.data.id}`);
        } finally {
            setCreating(false);
        }
    };

    const totalMembers = workspaces?.reduce((acc, ws) => acc + (ws.member_count ?? 1), 0) ?? 0;

    return (
        <>
            <Topbar />
            <div className="max-w-5xl mx-auto px-6 pt-16 pb-10">

                {/* Hero */}
                <div className="mb-8 pt-4">
                    <div className="inline-flex items-center gap-2 text-primary text-sm font-medium mb-3 bg-primary-muted px-3 py-1 rounded-full">
                        <BookOpen size={13} />
                        Documentation as code
                    </div>
                    <h1 className="text-3xl font-semibold text-text-primary leading-tight">
                        Hello{user ? `, ${user.username}` : ''} 👋
                    </h1>
                    <p className="text-base text-text-muted mt-1.5">
                        Manage and document your Git projects from a single place.
                    </p>
                </div>

                {/* Summary stats */}
                {workspaces && workspaces.length > 0 && (
                    <div className="grid grid-cols-2 gap-3 mb-8">
                        {[
                            { label: 'Workspaces', value: workspaces.length, icon: FolderOpen },
                            { label: 'Members (total)', value: totalMembers, icon: Users },
                        ].map(({ label, value, icon: Icon }) => (
                            <div key={label} className="bg-surface border border-border rounded-xl px-4 py-4 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-primary-muted flex items-center justify-center flex-shrink-0">
                                    <Icon size={16} className="text-primary" />
                                </div>
                                <div>
                                    <p className="text-xl font-semibold text-text-primary">{value}</p>
                                    <p className="text-xs text-text-muted">{label}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Workspaces section */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-text-primary">Your workspaces</h2>
                    <Button variant="primary" size="sm" onClick={() => setShowModal(true)}>
                        <Plus size={13} /> New workspace
                    </Button>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-surface-1 border border-border rounded-xl h-36 animate-pulse" />
                        ))}
                    </div>
                ) : workspaces && workspaces.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {workspaces.map((ws) => (
                            <Link
                                key={ws.id}
                                href={`/workspace/${ws.id}`}
                                className="group bg-surface border border-border rounded-xl p-5 hover:border-primary/40 hover:shadow-sm transition-all"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className="w-10 h-10 rounded-lg bg-primary-muted flex items-center justify-center text-base font-bold text-primary">
                                        {ws.name[0].toUpperCase()}
                                    </div>
                                    <ArrowRight size={15} className="text-text-muted opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
                                </div>
                                <h3 className="text-base font-semibold text-text-primary mb-1 truncate">{ws.name}</h3>
                                <div className="flex items-center gap-3 text-xs text-text-muted">
                                    <span className="flex items-center gap-1">
                                        <Users size={11} /> {ws.member_count} member{ws.member_count > 1 ? 's' : ''}
                                    </span>
                                </div>
                                <p className="text-xs text-text-muted mt-2">Created {formatRelativeTime(ws.created_at)}</p>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-border rounded-xl">
                        <div className="w-14 h-14 rounded-2xl bg-primary-muted flex items-center justify-center mb-4">
                            <FolderOpen size={24} className="text-primary" />
                        </div>
                        <h3 className="text-base font-semibold text-text-primary mb-1">No workspace</h3>
                        <p className="text-sm text-text-muted mb-5">Create your first workspace to get started</p>
                        <Button variant="primary" size="md" onClick={() => setShowModal(true)}>
                            <Plus size={15} /> Create a workspace
                        </Button>
                    </div>
                )}
            </div>

            <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create a workspace">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-text-secondary mb-1.5">Workspace name</label>
                        <input
                            type="text"
                            value={newName}
                            onChange={(e) => setNewName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            placeholder="My team"
                            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="ghost" onClick={() => setShowModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreate} isLoading={creating}>Create</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
