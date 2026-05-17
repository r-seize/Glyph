'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '@/lib/api';
import { removeToken } from '@/lib/auth';
import { Workspace } from '@/types';
import { cn } from '@/lib/utils';
import { LogOut, Plus, Settings, ArrowUpDown, Check } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/ui/ThemeToggle';

type SortOrder = 'newest' | 'oldest' | 'alpha';

const SORT_OPTIONS: { value: SortOrder; label: string }[] = [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'alpha', label: 'A–Z' },
];

export default function Sidebar() {
    const pathname = usePathname();
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);
    const [sort, setSort] = useState<SortOrder>('newest');
    const [sortOpen, setSortOpen] = useState(false);
    const sortRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
                setSortOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const { data: workspacesRaw } = useQuery<Workspace[]>({
        queryKey: ['workspaces'],
        queryFn: async () => {
            const res = await workspacesApi.list();
            return res.data;
        },
    });

    const workspaces = useMemo(() => {
        if (!workspacesRaw) return workspacesRaw;
        return [...workspacesRaw].sort((a, b) => {
            if (sort === 'alpha') return a.name.localeCompare(b.name);
            if (sort === 'oldest') return a.created_at.localeCompare(b.created_at);
            return b.created_at.localeCompare(a.created_at);
        });
    }, [workspacesRaw, sort]);

    const handleCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const res = await workspacesApi.create({ name: newName.trim() });
            await queryClient.invalidateQueries({ queryKey: ['workspaces'] });
            router.push(`/workspace/${res.data.id}`);
            setShowCreateModal(false);
            setNewName('');
        } finally {
            setCreating(false);
        }
    };

    const handleLogout = () => {
        removeToken();
        router.push('/login');
    };

    return (
        <>
            <aside className="flex flex-col w-56 h-screen bg-surface-1 border-r border-border fixed left-0 top-0 z-30">
                {/* Logo */}
                <div className="px-4 py-4 border-b border-border">
                    <Link href="/" className="flex items-center gap-2.5">
                        <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-sm font-bold">G</span>
                        </div>
                        <span className="text-base font-semibold tracking-tight text-text-primary">Glyph</span>
                    </Link>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                    <div className="px-2 mb-2 flex items-center justify-between">
                        <span className="text-2xs font-semibold text-text-muted uppercase tracking-wider">Workspaces</span>
                        <div ref={sortRef} className="relative">
                            <button
                                onClick={() => setSortOpen((o) => !o)}
                                className="flex items-center gap-1 p-1 rounded-md text-text-muted hover:text-text-secondary hover:bg-surface-2 transition-colors"
                                title="Sort"
                            >
                                <ArrowUpDown size={11} />
                            </button>
                            {sortOpen && (
                                <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-surface border border-border rounded-lg shadow-lg py-1 overflow-hidden">
                                    {SORT_OPTIONS.map((opt) => (
                                        <button
                                            key={opt.value}
                                            onClick={() => { setSort(opt.value); setSortOpen(false); }}
                                            className="w-full flex items-center justify-between px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-1 transition-colors"
                                        >
                                            {opt.label}
                                            {sort === opt.value && <Check size={11} className="text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {workspaces?.map((ws) => {
                        const active = pathname.includes(`/workspace/${ws.id}`);
                        return (
                            <Link
                                key={ws.id}
                                href={`/workspace/${ws.id}`}
                                className={cn(
                                    'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors',
                                    active
                                        ? 'bg-primary-muted text-primary font-semibold'
                                        : 'text-text-secondary hover:text-text-primary hover:bg-surface-2'
                                )}
                            >
                                <div className="w-6 h-6 rounded flex items-center justify-center bg-surface-3 text-2xs font-bold text-text-secondary flex-shrink-0">
                                    {ws.name[0].toUpperCase()}
                                </div>
                                <span className="truncate">{ws.name}</span>
                            </Link>
                        );
                    })}

                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-surface-2 w-full transition-colors"
                    >
                        <div className="w-6 h-6 rounded border border-dashed border-border-strong flex items-center justify-center flex-shrink-0">
                            <Plus size={11} />
                        </div>
                        <span>New workspace</span>
                    </button>
                </nav>

                {/* Bottom */}
                <div className="px-2 py-3 border-t border-border space-y-0.5">
                    <Link
                        href="/settings"
                        className={cn(
                            'flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm transition-colors w-full',
                            pathname === '/settings'
                                ? 'bg-primary-muted text-primary font-semibold'
                                : 'text-text-muted hover:text-text-secondary hover:bg-surface-2'
                        )}
                    >
                        <Settings size={15} />
                        <span>Settings</span>
                    </Link>
                    <ThemeToggle />
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-muted hover:text-text-secondary hover:bg-surface-2 w-full transition-colors"
                    >
                        <LogOut size={15} />
                        <span>Sign out</span>
                    </button>
                </div>
            </aside>

            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create a workspace">
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
                        <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                        <Button variant="primary" onClick={handleCreate} isLoading={creating}>Create</Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}
