'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { gitlabApi, accountsApi } from '@/lib/api';
import { ConnectedAccount } from '@/types';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Loader2, Lock, Search, Star, ExternalLink, Settings, Check } from 'lucide-react';

interface GitLabRepo {
    name: string;
    full_name: string;
    description: string | null;
    clone_url: string;
    html_url: string;
    default_branch: string;
    private: boolean;
    language: string | null;
    stars: number;
    updated_at: string | null;
}

interface Props {
    onSelect: (repo: GitLabRepo) => void;
}

function GitLabIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
    );
}

export default function GitLabReposPicker({ onSelect }: Props) {
    const [query, setQuery] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

    const { data: allAccounts, isLoading: loadingAccounts } = useQuery<ConnectedAccount[]>({
        queryKey: ['connectedAccounts'],
        queryFn: async () => (await accountsApi.list()).data,
    });

    const gitlabAccounts = allAccounts?.filter((a) => a.provider === 'gitlab') ?? [];
    const activeAccountId = selectedAccountId ?? gitlabAccounts[0]?.id ?? null;

    const { data: repos, isLoading: loadingRepos, error } = useQuery<GitLabRepo[]>({
        queryKey: ['gitlabRepos', activeAccountId],
        queryFn: async () => (await gitlabApi.repos(activeAccountId!)).data,
        enabled: !!activeAccountId,
    });

    const filtered = useMemo(() => {
        if (!repos) return [];
        const q = query.trim().toLowerCase();
        if (!q) return repos;
        return repos.filter(
            (r) =>
                r.full_name.toLowerCase().includes(q) ||
                (r.description || '').toLowerCase().includes(q)
        );
    }, [repos, query]);

    if (loadingAccounts) {
        return (
            <div className="flex items-center justify-center py-10 text-text-muted">
                <Loader2 className="animate-spin" size={18} />
            </div>
        );
    }

    if (gitlabAccounts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-center">
                <GitLabIcon size={28} />
                <p className="text-sm text-text-secondary mt-3 mb-1">No GitLab account connected</p>
                <p className="text-xs text-text-muted mb-4">
                    Add a GitLab account via a Personal Access Token in settings.
                </p>
                <Link href="/settings">
                    <Button variant="primary" size="sm">
                        <Settings size={13} /> Go to settings
                    </Button>
                </Link>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-3">
            {/* Account selector */}
            <div className="flex flex-wrap gap-2">
                {gitlabAccounts.map((acc) => {
                    const isActive = acc.id === activeAccountId;
                    return (
                        <button
                            key={acc.id}
                            onClick={() => setSelectedAccountId(acc.id)}
                            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-sm transition-colors ${
                                isActive
                                    ? 'bg-primary/10 border-primary/30 text-primary'
                                    : 'bg-surface-1 border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
                            }`}
                        >
                            {acc.avatar_url
                                ? <img src={acc.avatar_url} alt="" className="w-5 h-5 rounded-full flex-shrink-0" />
                                : <GitLabIcon size={14} />
                            }
                            <span className="font-mono text-xs">@{acc.username}</span>
                            {isActive && <Check size={12} className="flex-shrink-0" />}
                        </button>
                    );
                })}
            </div>

            {/* Search */}
            <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search projects…"
                    className="w-full bg-surface-1 border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                />
            </div>

            {loadingRepos ? (
                <div className="flex items-center justify-center py-10 text-text-muted">
                    <Loader2 className="animate-spin" size={18} />
                </div>
            ) : error ? (
                <div className="text-sm text-red-500 py-4 text-center">
                    Unable to load projects. Reconnect your GitLab account.
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-sm text-text-muted py-6 text-center">No project found.</div>
            ) : (
                <ul className="max-h-72 overflow-y-auto -mx-1 px-1 divide-y divide-border">
                    {filtered.map((repo) => (
                        <li key={repo.full_name} className="py-2.5 flex items-start justify-between gap-3 group">
                            <button onClick={() => onSelect(repo)} className="flex-1 text-left min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-text-primary truncate">{repo.full_name}</span>
                                    {repo.private && <Lock size={11} className="text-text-muted flex-shrink-0" />}
                                </div>
                                {repo.description && (
                                    <p className="text-xs text-text-muted line-clamp-1">{repo.description}</p>
                                )}
                                <div className="flex items-center gap-3 mt-1 text-[11px] text-text-muted">
                                    {repo.stars > 0 && (
                                        <span className="flex items-center gap-0.5"><Star size={10} /> {repo.stars}</span>
                                    )}
                                    <span>{repo.default_branch}</span>
                                </div>
                            </button>
                            <div className="flex items-center gap-1 flex-shrink-0">
                                <a
                                    href={repo.html_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-text-muted hover:text-text-primary p-1 rounded-md hover:bg-surface-2 opacity-0 group-hover:opacity-100 transition-opacity"
                                    title="Open on GitLab"
                                >
                                    <ExternalLink size={12} />
                                </a>
                                <Button variant="secondary" size="sm" onClick={() => onSelect(repo)}>Import</Button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
