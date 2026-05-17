'use client';

import React, { use, useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workspacesApi, invitesApi, authApi } from '@/lib/api';
import { Workspace, WorkspaceMember, WorkspaceInvite, Role, User } from '@/types';
import WorkspaceNav from '@/components/layout/WorkspaceNav';
import Topbar from '@/components/layout/Topbar';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { useRouter } from 'next/navigation';
import { UserPlus, Shield, Trash2, Link2, Copy, Check, Mail, Clock, LogOut, ChevronDown, Users, Code2, Eye } from 'lucide-react';
import { formatRelativeTime } from '@/lib/utils';
import { cn } from '@/lib/utils';

const ROLE_LABELS: Record<Role, string> = {
    owner: 'Owner',
    admin: 'Admin',
    developer: 'Developer',
    viewer: 'Viewer',
};

const ROLE_ICONS: Record<Exclude<Role, 'owner'>, React.ReactNode> = {
    admin:     <Users size={12} />,
    developer: <Code2 size={12} />,
    viewer:    <Eye size={12} />,
};

function RoleDropdown({ value, onChange, compact = false }: { value: Role; onChange: (r: Role) => void; compact?: boolean }) {
    const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
    const btnRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const roles: Exclude<Role, 'owner'>[] = ['admin', 'developer', 'viewer'];

    const open = pos !== null;

    const handleOpen = () => {
        if (open) { setPos(null); return; }
        const rect = btnRef.current?.getBoundingClientRect();
        if (!rect) return;
        setPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (
                btnRef.current && !btnRef.current.contains(e.target as Node) &&
                menuRef.current && !menuRef.current.contains(e.target as Node)
            ) setPos(null);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <>
            <button
                ref={btnRef}
                onClick={handleOpen}
                className={cn(
                    'flex items-center gap-1.5 border border-border rounded-md transition-colors',
                    'bg-surface-1 hover:bg-surface-2 hover:border-border-strong text-text-secondary',
                    compact ? 'px-2 py-1 text-xs' : 'px-3 py-2 text-sm w-full justify-between',
                )}
            >
                <span className="flex items-center gap-1.5">
                    {ROLE_ICONS[value as Exclude<Role, 'owner'>]}
                    {ROLE_LABELS[value]}
                </span>
                <ChevronDown size={12} className={cn('transition-transform text-text-muted', open && 'rotate-180')} />
            </button>

            {open && pos && (
                <div
                    ref={menuRef}
                    style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: compact ? 140 : pos.width, zIndex: 9999 }}
                    className="bg-surface border border-border rounded-lg shadow-lg py-1 overflow-hidden"
                >
                    {roles.map((r) => (
                        <button
                            key={r}
                            onClick={() => { onChange(r); setPos(null); }}
                            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-1 transition-colors text-left"
                        >
                            <span className={cn('flex-shrink-0', value === r ? 'text-primary' : 'text-text-muted')}>
                                {ROLE_ICONS[r]}
                            </span>
                            <span className={cn('flex-1 text-xs font-medium', value === r ? 'text-primary' : 'text-text-primary')}>
                                {ROLE_LABELS[r]}
                            </span>
                            {value === r && <Check size={11} className="text-primary flex-shrink-0" />}
                        </button>
                    ))}
                </div>
            )}
        </>
    );
}

export default function MembresPage({ params }: { params: Promise<{ workspaceId: string }> }) {
    const { workspaceId } = use(params);
    const queryClient = useQueryClient();
    const router = useRouter();

    const [showInvite, setShowInvite] = useState(false);
    const [inviteTab, setInviteTab] = useState<'link' | 'email'>('link');
    const [inviteRole, setInviteRole] = useState<Role>('developer');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteError, setInviteError] = useState('');
    const [generatedInvite, setGeneratedInvite] = useState<{
        url: string;
        role: string;
        emailSent?: boolean;
        emailConfigured?: boolean;
        emailAttempted?: boolean;
    } | null>(null);
    const [copied, setCopied] = useState(false);

    const { data: me } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => (await authApi.me()).data,
    });

    const { data: workspace } = useQuery<Workspace>({
        queryKey: ['workspace', workspaceId],
        queryFn: async () => (await workspacesApi.get(workspaceId)).data,
    });

    const { data: members, isLoading } = useQuery<WorkspaceMember[]>({
        queryKey: ['workspaceMembers', workspaceId],
        queryFn: async () => (await workspacesApi.members(workspaceId)).data,
    });

    const { data: activeInvites } = useQuery<WorkspaceInvite[]>({
        queryKey: ['workspaceInvites', workspaceId],
        queryFn: async () => (await invitesApi.list(workspaceId)).data,
    });

    const createInvite = useMutation({
        mutationFn: (data: { role: string; email?: string }) => invitesApi.create(workspaceId, data),
        onSuccess: (res) => {
            const d = res.data;
            const emailAttempted = inviteTab === 'email' && !!inviteEmail;
            setGeneratedInvite({
                url: d.url,
                role: d.role,
                emailSent: d.email_sent,
                emailConfigured: d.email_configured,
                emailAttempted,
            });
            queryClient.invalidateQueries({ queryKey: ['workspaceInvites', workspaceId] });
            setInviteError('');
        },
        onError: (err: any) => setInviteError(err.response?.data?.detail || 'Error'),
    });

    const revokeInvite = useMutation({
        mutationFn: (id: string) => invitesApi.revoke(workspaceId, id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaceInvites', workspaceId] }),
    });

    const removeMember = useMutation({
        mutationFn: (userId: string) => workspacesApi.removeMember(workspaceId, userId),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaceMembers', workspaceId] }),
    });

    const leaveWorkspace = useMutation({
        mutationFn: () => workspacesApi.leave(workspaceId),
        onSuccess: () => router.push('/'),
    });

    const updateRole = useMutation({
        mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
            workspacesApi.updateMember(workspaceId, userId, { role }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workspaceMembers', workspaceId] }),
    });

    const copyLink = (url: string) => {
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const closeModal = () => {
        setShowInvite(false);
        setGeneratedInvite(null);
        setInviteEmail('');
        setInviteError('');
        setInviteTab('link');
    };

    const breadcrumbs = [
        { label: workspace?.name || 'Workspace', href: `/workspace/${workspaceId}` },
        { label: 'Members' },
    ];

    return (
        <>
            <Topbar breadcrumbs={breadcrumbs} />
            <div className="pt-12">
                <WorkspaceNav workspaceId={workspaceId} />

                <div className="max-w-3xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h1 className="text-xl font-semibold text-text-primary">Members</h1>
                            <p className="text-sm text-text-muted mt-0.5">{members?.length || 0} member{(members?.length || 0) > 1 ? 's' : ''}</p>
                        </div>
                        <Button variant="primary" size="sm" onClick={() => setShowInvite(true)}>
                            <UserPlus size={14} /> Invite
                        </Button>
                    </div>

                    {/* Members list */}
                    <div className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden mb-6">
                        {isLoading ? (
                            [...Array(3)].map((_, i) => (
                                <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
                                    <div className="w-8 h-8 rounded-full bg-surface-2" />
                                    <div className="flex-1">
                                        <div className="h-3 w-32 bg-surface-2 rounded mb-1" />
                                        <div className="h-3 w-24 bg-surface-2 rounded" />
                                    </div>
                                </div>
                            ))
                        ) : members?.map((member) => (
                            <div key={member.user.id} className="flex items-center gap-3 px-4 py-3">
                                <Avatar src={member.user.avatar_url} name={member.user.username} size="sm" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary">{member.user.username}</p>
                                    <p className="text-xs text-text-muted">{member.user.email} · joined {formatRelativeTime(member.joined_at)}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    {member.role === 'owner' ? (
                                        <span className="flex items-center gap-1 text-xs text-text-muted px-2 py-1 bg-surface-1 border border-border rounded-md">
                                            <Shield size={11} /> {ROLE_LABELS[member.role]}
                                        </span>
                                    ) : member.user.id === me?.id ? (
                                        <button
                                            onClick={() => leaveWorkspace.mutate()}
                                            disabled={leaveWorkspace.isPending}
                                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-text-muted border border-border rounded-md hover:text-red-500 hover:border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-40"
                                            title="Leave workspace"
                                        >
                                            <LogOut size={12} /> Leave
                                        </button>
                                    ) : (
                                        <>
                                            <RoleDropdown
                                                value={member.role}
                                                onChange={(r) => updateRole.mutate({ userId: member.user.id, role: r })}
                                                compact
                                            />
                                            <button
                                                onClick={() => removeMember.mutate(member.user.id)}
                                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface-2 rounded-md transition-colors"
                                                title="Remove from workspace"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Active invites */}
                    {activeInvites && activeInvites.length > 0 && (
                        <div>
                            <h2 className="text-sm font-medium text-text-secondary mb-3 flex items-center gap-1.5">
                                <Clock size={13} /> Pending invitations
                            </h2>
                            <div className="bg-surface border border-border rounded-xl divide-y divide-border overflow-hidden">
                                {activeInvites.map((inv) => (
                                    <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-text-primary font-mono truncate">{inv.url}</p>
                                            <p className="text-xs text-text-muted mt-0.5">
                                                {ROLE_LABELS[inv.role]} · expires {formatRelativeTime(inv.expires_at)}
                                                {inv.email && ` · sent to ${inv.email}`}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-1 flex-shrink-0">
                                            <button
                                                onClick={() => copyLink(inv.url)}
                                                className="p-1.5 text-text-muted hover:text-text-primary hover:bg-surface-2 rounded-md transition-colors"
                                                title="Copy link"
                                            >
                                                <Copy size={13} />
                                            </button>
                                            <button
                                                onClick={() => revokeInvite.mutate(inv.id)}
                                                className="p-1.5 text-text-muted hover:text-red-500 hover:bg-surface-2 rounded-md transition-colors"
                                                title="Revoke"
                                            >
                                                <Trash2 size={13} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Invite Modal */}
            <Modal isOpen={showInvite} onClose={closeModal} title="Invite a member">
                {generatedInvite ? (
                    <div className="space-y-4">
                        {/* Case 1: email sent successfully */}
                        {generatedInvite.emailAttempted && generatedInvite.emailSent && (
                            <div className="flex items-start gap-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 rounded-lg px-3 py-3">
                                <Check size={15} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                                <p className="text-sm text-emerald-700 dark:text-emerald-300">
                                    Invitation sent to <strong>{inviteEmail}</strong> for the role{' '}
                                    <strong>{ROLE_LABELS[generatedInvite.role as Role]}</strong>.
                                </p>
                            </div>
                        )}

                        {/* Case 2: email attempted but no provider configured */}
                        {generatedInvite.emailAttempted && !generatedInvite.emailSent && (
                            <>
                                <div className="flex items-start gap-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-lg px-3 py-3">
                                    <Mail size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                    <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
                                        <p className="font-medium">No email service configured</p>
                                        <p>
                                            {generatedInvite.emailConfigured
                                                ? "Sending failed. Check your email service configuration."
                                                : 'Refer to the documentation to configure an SMTP or API provider.'}
                                        </p>
                                        <p>In the meantime, copy and send the link manually:</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2.5">
                                    <Link2 size={13} className="text-text-muted flex-shrink-0" />
                                    <span className="flex-1 text-xs font-mono text-text-primary truncate">{generatedInvite.url}</span>
                                    <button
                                        onClick={() => copyLink(generatedInvite.url)}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium flex-shrink-0"
                                    >
                                        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                    </button>
                                </div>
                            </>
                        )}

                        {/* Case 3: link mode */}
                        {!generatedInvite.emailAttempted && (
                            <>
                                <p className="text-sm text-text-secondary">
                                    Invitation link generated for the role <strong>{ROLE_LABELS[generatedInvite.role as Role]}</strong>.
                                    Share it with your collaborator.
                                </p>
                                <div className="flex items-center gap-2 bg-surface-1 border border-border rounded-lg px-3 py-2.5">
                                    <Link2 size={13} className="text-text-muted flex-shrink-0" />
                                    <span className="flex-1 text-xs font-mono text-text-primary truncate">{generatedInvite.url}</span>
                                    <button
                                        onClick={() => copyLink(generatedInvite.url)}
                                        className="flex items-center gap-1 text-xs text-primary hover:text-primary-hover font-medium flex-shrink-0"
                                    >
                                        {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                                    </button>
                                </div>
                                <p className="text-xs text-text-muted">This link is valid for 7 days and can be used only once.</p>
                            </>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={() => setGeneratedInvite(null)}>New invitation</Button>
                            <Button variant="primary" onClick={closeModal}>Close</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Tabs */}
                        <div className="flex gap-1 p-1 bg-surface-1 border border-border rounded-lg w-fit">
                            {(['link', 'email'] as const).map((t) => (
                                <button
                                    key={t}
                                    onClick={() => setInviteTab(t)}
                                    className={cn(
                                        'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md transition-colors',
                                        inviteTab === t
                                            ? 'bg-surface text-text-primary border border-border shadow-sm'
                                            : 'text-text-muted hover:text-text-secondary'
                                    )}
                                >
                                    {t === 'link' ? <Link2 size={11} /> : <Mail size={11} />}
                                    {t === 'link' ? 'Link' : 'Email'}
                                </button>
                            ))}
                        </div>

                        {inviteTab === 'email' && (
                            <div>
                                <label className="block text-sm text-text-secondary mb-1.5">Collaborator email</label>
                                <input
                                    type="email"
                                    value={inviteEmail}
                                    onChange={(e) => setInviteEmail(e.target.value)}
                                    placeholder="collaborator@example.com"
                                    className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                                    autoFocus
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Role</label>
                            <RoleDropdown value={inviteRole} onChange={setInviteRole} />
                        </div>

                        {inviteError && (
                            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
                                {inviteError}
                            </p>
                        )}

                        <div className="flex justify-end gap-2 pt-1">
                            <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                            <Button
                                variant="primary"
                                isLoading={createInvite.isPending}
                                onClick={() => createInvite.mutate({
                                    role: inviteRole,
                                    email: inviteTab === 'email' && inviteEmail ? inviteEmail : undefined,
                                })}
                            >
                                {inviteTab === 'link' ? <><Link2 size={13} /> Generate link</> : <><Mail size={13} /> Send</>}
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </>
    );
}
