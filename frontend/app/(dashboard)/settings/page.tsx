'use client';

import { Suspense, useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useRouter } from 'next/navigation';
import { authApi, usersApi, accountsApi } from '@/lib/api';
import { User, ConnectedAccount as CA } from '@/types';
import { removeToken } from '@/lib/auth';
import Topbar from '@/components/layout/Topbar';
import Avatar from '@/components/ui/Avatar';
import Button from '@/components/ui/Button';
import GithubIcon from '@/components/ui/icons/GithubIcon';
import { Check, Eye, EyeOff, Trash2, Plus, ExternalLink, TriangleAlert, Key, X } from 'lucide-react';

interface ProviderSectionProps {
    label: string;
    icon: React.ReactNode;
    accounts: CA[];
    onAdd: () => void;
    onDisconnect: (id: string) => void;
    disconnecting: string | null;
    tokenHint: string;
}

function ProviderSection({ label, icon, accounts, onAdd, onDisconnect, disconnecting, tokenHint }: ProviderSectionProps) {
    return (
        <div>
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-secondary">
                    {icon} {label}
                    {accounts.length > 0 && (
                        <span className="text-2xs font-normal text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-900/40">
                            {accounts.length} connected
                        </span>
                    )}
                </div>
                <Button variant="secondary" size="sm" onClick={onAdd}>
                    <Plus size={12} /> Add an account
                </Button>
            </div>

            {accounts.length > 0 ? (
                <div className="space-y-2 mb-3">
                    {accounts.map((account) => (
                        <div
                            key={account.id}
                            className="flex items-center gap-3 px-3 py-2.5 bg-surface-1 border border-border rounded-lg"
                        >
                            <Avatar src={account.avatar_url} name={account.username} size="xs" />
                            <span className="flex-1 text-sm text-text-primary font-mono min-w-0 truncate">@{account.username}</span>
                            <Check size={13} className="text-emerald-500 flex-shrink-0" />
                            <button
                                onClick={() => onDisconnect(account.id)}
                                disabled={disconnecting === account.id}
                                className="text-text-muted hover:text-red-500 disabled:opacity-40 transition-colors p-1 flex-shrink-0"
                                title="Disconnect this account"
                            >
                                <Trash2 size={13} />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-text-muted mb-1">No {label} account connected.</p>
            )}

            <p className="text-xs text-text-muted">
                Generate a token on{' '}
                <a href={tokenHint} target="_blank" rel="noopener noreferrer" className="text-primary underline inline-flex items-center gap-0.5">
                    {label} <ExternalLink size={10} />
                </a>{' '}
                with the scopes <code className="font-mono bg-surface-2 px-1 rounded">{label === 'GitHub' ? 'repo, read:user, user:email' : 'read_user, read_api'}</code>.
            </p>
        </div>
    );
}

function GitLabIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
    );
}

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();
    const router = useRouter();

    const [username, setUsername] = useState('');
    const [currentPwd, setCurrentPwd] = useState('');
    const [newPwd, setNewPwd] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState(false);
    const [nameSuccess, setNameSuccess] = useState(false);
    const [connectedBanner, setConnectedBanner] = useState<string | null>(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState('');
    const [deleteError, setDeleteError] = useState('');
    const [addingProvider, setAddingProvider] = useState<'github' | 'gitlab' | null>(null);
    const [patInput, setPatInput] = useState('');
    const [patError, setPatError] = useState('');

    useEffect(() => {
        const provider = searchParams.get('connected');
        if (provider) {
            setConnectedBanner(provider);
            queryClient.invalidateQueries({ queryKey: ['connectedAccounts'] });
            // Clean the URL so the banner doesn't reappear on refresh
            router.replace('/settings');
            setTimeout(() => setConnectedBanner(null), 4000);
        }
    }, [searchParams, queryClient, router]);

    const { data: user, refetch } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => {
            const res = await authApi.me();
            setUsername(res.data.username);
            return res.data;
        },
    });

    const { data: accounts, isLoading: accountsLoading } = useQuery<CA[]>({
        queryKey: ['connectedAccounts'],
        queryFn: async () => (await accountsApi.list()).data,
    });

    const updateName = useMutation({
        mutationFn: () => usersApi.updateMe({ username }),
        onSuccess: () => {
            setNameSuccess(true);
            refetch();
            setTimeout(() => setNameSuccess(false), 2000);
        },
    });

    const changePwd = useMutation({
        mutationFn: () => usersApi.changePassword({ current_password: currentPwd, new_password: newPwd }),
        onSuccess: () => {
            setPwdSuccess(true);
            setCurrentPwd('');
            setNewPwd('');
            setPwdError('');
            setTimeout(() => setPwdSuccess(false), 2000);
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onError: (err: any) => {
            setPwdError(err.response?.data?.detail || 'Error while changing password');
        },
    });

    const disconnect = useMutation({
        mutationFn: (accountId: string) => accountsApi.disconnect(accountId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['connectedAccounts'] });
            queryClient.invalidateQueries({ queryKey: ['githubStatus'] });
        },
    });

    const deleteAccount = useMutation({
        mutationFn: () => usersApi.deleteMe(),
        onSuccess: () => {
            removeToken();
            router.push('/login');
        },
        onError: () => setDeleteError('An error occurred. Retry.'),
    });

    const handleDeleteAccount = () => {
        if (deleteConfirm !== 'delete') return;
        setDeleteError('');
        deleteAccount.mutate();
    };

    const githubAccounts = accounts?.filter((a) => a.provider === 'github') ?? [];
    const gitlabAccounts = accounts?.filter((a) => a.provider === 'gitlab') ?? [];

    const addToken = useMutation({
        mutationFn: async ({ provider, token }: { provider: 'github' | 'gitlab'; token: string }) => {
            if (provider === 'github') return accountsApi.addGithubToken(token);
            return accountsApi.addGitlabToken(token);
        },
        onSuccess: (_, { provider }) => {
            queryClient.invalidateQueries({ queryKey: ['connectedAccounts'] });
            setConnectedBanner(provider);
            setAddingProvider(null);
            setPatInput('');
            setPatError('');
            setTimeout(() => setConnectedBanner(null), 4000);
        },
        onError: (err: any) => {
            setPatError(err.response?.data?.detail || 'Invalid token');
        },
    });

    const handleOpenModal = (provider: 'github' | 'gitlab') => {
        setAddingProvider(provider);
        setPatInput('');
        setPatError('');
    };

    const handleAddToken = () => {
        if (!patInput.trim() || !addingProvider) return;
        addToken.mutate({ provider: addingProvider, token: patInput.trim() });
    };

    return (
        <>
            <Topbar breadcrumbs={[{ label: 'Settings' }]} />
            <div className="pt-12 max-w-2xl mx-auto px-6 py-6 space-y-5">

                {connectedBanner && (
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 rounded-xl px-4 py-3 text-sm">
                        <Check size={14} />
                        {connectedBanner === 'github' ? 'GitHub' : 'GitLab'} account connected successfully.
                    </div>
                )}

                {/* Profile */}
                <section className="bg-surface border border-border rounded-xl p-5">
                    <div className="flex items-center gap-4 mb-5">
                        {user && <Avatar src={user.avatar_url} name={user.username} size="lg" />}
                        <div>
                            <p className="text-lg font-semibold text-text-primary">{user?.username}</p>
                            <p className="text-sm text-text-muted">{user?.email}</p>
                        </div>
                    </div>
                    <h2 className="text-sm font-medium text-text-secondary mb-3">Username</h2>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:outline-none focus:border-border-strong"
                        />
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => updateName.mutate()}
                            isLoading={updateName.isPending}
                            disabled={!username.trim() || username === user?.username}
                        >
                            {nameSuccess ? <><Check size={13} /> Saved</> : 'Save'}
                        </Button>
                    </div>
                </section>

                {/* Password */}
                <section className="bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-base font-medium text-text-primary mb-4">Password</h2>
                    <div className="space-y-3">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Current password</label>
                            <input
                                type="password"
                                value={currentPwd}
                                onChange={(e) => setCurrentPwd(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">New password</label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={newPwd}
                                    onChange={(e) => setNewPwd(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPwd(!showPwd)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
                                >
                                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                            </div>
                        </div>
                        {pwdError && (
                            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
                                {pwdError}
                            </p>
                        )}
                        {pwdSuccess && (
                            <p className="text-sm text-emerald-600 dark:text-emerald-400">Password updated.</p>
                        )}
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={() => changePwd.mutate()}
                            isLoading={changePwd.isPending}
                            disabled={!currentPwd || !newPwd}
                        >
                            Change password
                        </Button>
                    </div>
                </section>

                {/* Connected accounts */}
                <section className="bg-surface border border-border rounded-xl p-5">
                    <h2 className="text-base font-medium text-text-primary mb-1">Connected accounts</h2>
                    <p className="text-sm text-text-muted mb-4">
                        Connect multiple GitHub or GitLab accounts to import repositories.
                    </p>

                    {accountsLoading ? (
                        <div className="space-y-2">
                            {[...Array(2)].map((_, i) => (
                                <div key={i} className="h-12 bg-surface-1 rounded-lg animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <ProviderSection
                                label="GitHub"
                                icon={<GithubIcon size={15} />}
                                accounts={githubAccounts}
                                onAdd={() => handleOpenModal('github')}
                                onDisconnect={(id) => disconnect.mutate(id)}
                                disconnecting={disconnect.isPending ? disconnect.variables as string : null}
                                tokenHint="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email"
                            />
                            <div className="border-t border-border" />
                            <ProviderSection
                                label="GitLab"
                                icon={<GitLabIcon size={15} />}
                                accounts={gitlabAccounts}
                                onAdd={() => handleOpenModal('gitlab')}
                                onDisconnect={(id) => disconnect.mutate(id)}
                                disconnecting={disconnect.isPending ? disconnect.variables as string : null}
                                tokenHint="https://gitlab.com/-/profile/personal_access_tokens"
                            />
                        </div>
                    )}
                </section>

                {/* Danger zone */}
                <section className="bg-surface border border-red-200 dark:border-red-900/40 rounded-xl p-5">
                    <h2 className="text-base font-medium text-red-600 dark:text-red-400 mb-1 flex items-center gap-2">
                        <TriangleAlert size={16} /> Danger zone
                    </h2>
                    <p className="text-sm text-text-muted mb-4">
                        Deleting your account is irreversible. All your workspaces, projects, and data will be permanently erased.
                    </p>
                    <Button variant="ghost" size="sm" onClick={() => setShowDeleteModal(true)}
                        className="text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-950/30">
                        <Trash2 size={13} /> Delete my account
                    </Button>
                </section>
            </div>

            {/* Delete confirmation modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-50 dark:bg-red-950/40 flex items-center justify-center flex-shrink-0">
                                <TriangleAlert size={18} className="text-red-600 dark:text-red-400" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-text-primary">Delete account</h3>
                                <p className="text-sm text-text-muted">This action is irreversible</p>
                            </div>
                        </div>
                        <p className="text-sm text-text-secondary mb-4">
                            All your <span className="font-medium text-text-primary">workspaces, projects, documentation and comments</span> will be permanently deleted. You will not be able to recover this data.
                        </p>
                        <p className="text-sm text-text-secondary mb-2">
                            Type <span className="font-mono font-semibold text-text-primary">delete</span> to confirm:
                        </p>
                        <input
                            type="text"
                            value={deleteConfirm}
                            onChange={(e) => { setDeleteConfirm(e.target.value); setDeleteError(''); }}
                            placeholder="delete"
                            className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-red-400 mb-3"
                        />
                        {deleteError && (
                            <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => { setShowDeleteModal(false); setDeleteConfirm(''); setDeleteError(''); }}>
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={handleDeleteAccount}
                                isLoading={deleteAccount.isPending}
                                disabled={deleteConfirm !== 'delete'}
                                className="bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                            >
                                Delete permanently
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* PAT modal */}
            {addingProvider && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-surface border border-border rounded-xl shadow-xl w-full max-w-md p-6">
                        <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-surface-1 border border-border flex items-center justify-center flex-shrink-0">
                                    <Key size={16} className="text-text-secondary" />
                                </div>
                                <div>
                                    <h3 className="text-base font-semibold text-text-primary">
                                        Add a {addingProvider === 'github' ? 'GitHub' : 'GitLab'} account
                                    </h3>
                                    <p className="text-xs text-text-muted">Via a Personal Access Token</p>
                                </div>
                            </div>
                            <button onClick={() => setAddingProvider(null)} className="text-text-muted hover:text-text-secondary p-1">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="bg-surface-1 border border-border rounded-lg px-3 py-3 mb-4 text-xs text-text-muted space-y-1">
                            <p className="font-medium text-text-secondary">How to get a token:</p>
                            {addingProvider === 'github' ? (
                                <ol className="list-decimal list-inside space-y-0.5">
                                    <li>Go to <a href="https://github.com/settings/tokens/new?scopes=repo,read:user,user:email" target="_blank" rel="noopener noreferrer" className="text-primary underline">GitHub → Settings → Developer Settings → Personal access tokens → Tokens (classic)</a></li>
                                    <li>Select the scopes: <code className="bg-surface-2 px-1 rounded">repo</code>, <code className="bg-surface-2 px-1 rounded">read:user</code>, <code className="bg-surface-2 px-1 rounded">user:email</code></li>
                                    <li>Generate and copy the token</li>
                                </ol>
                            ) : (
                                <ol className="list-decimal list-inside space-y-0.5">
                                    <li>Go to <a href="https://gitlab.com/-/profile/personal_access_tokens" target="_blank" rel="noopener noreferrer" className="text-primary underline">GitLab → User Settings → Personal access tokens → Generate legacy token</a></li>
                                    <li>Select the scopes: <code className="bg-surface-2 px-1 rounded">read_user</code>, <code className="bg-surface-2 px-1 rounded">read_api</code></li>
                                    <li>Generate and copy the token</li>
                                </ol>
                            )}
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm text-text-secondary mb-1.5">Personal Access Token</label>
                            <input
                                type="password"
                                value={patInput}
                                onChange={(e) => { setPatInput(e.target.value); setPatError(''); }}
                                placeholder={addingProvider === 'github' ? 'ghp_...' : 'glpat-...'}
                                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary font-mono placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddToken()}
                            />
                            {patError && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">{patError}</p>
                            )}
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button variant="ghost" onClick={() => setAddingProvider(null)}>Cancel</Button>
                            <Button
                                variant="primary"
                                onClick={handleAddToken}
                                isLoading={addToken.isPending}
                                disabled={!patInput.trim()}
                            >
                                Connect account
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
