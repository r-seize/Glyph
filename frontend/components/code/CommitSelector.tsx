'use client';

import { Commit } from '@/types';
import { shortenSha, formatRelativeTime } from '@/lib/utils';
import { GitCommit, ChevronDown, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface CommitSelectorProps {
    commits: Commit[];
    selectedSha?: string;
    onSelect: (sha: string) => void;
}

export default function CommitSelector({ commits, selectedSha, onSelect }: CommitSelectorProps) {
    const [open, setOpen] = useState(false);
    const selected = commits.find((c) => c.sha === selectedSha) || commits[0];

    return (
        <div className="relative">
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 h-8 px-2.5 bg-surface-1 border border-border rounded-lg text-sm text-text-secondary hover:text-text-primary hover:border-border-strong transition-colors max-w-xs"
            >
                <GitCommit size={13} className="flex-shrink-0 text-text-muted" />
                {selected ? (
                    <>
                        <span className="font-mono text-text-primary">{shortenSha(selected.sha)}</span>
                        <span className="text-text-muted truncate hidden sm:block">{selected.message}</span>
                    </>
                ) : (
                    <span className="text-text-muted">Select a commit</span>
                )}
                <ChevronDown size={12} className={cn('flex-shrink-0 transition-transform ml-auto', open && 'rotate-180')} />
            </button>

            {open && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                    <div className="absolute top-full left-0 mt-1 w-80 bg-surface border border-border rounded-xl shadow-lg z-20 overflow-hidden">
                        <div className="max-h-64 overflow-y-auto">
                            {commits.map((commit) => (
                                <button
                                    key={commit.sha}
                                    onClick={() => { onSelect(commit.sha); setOpen(false); }}
                                    className={cn(
                                        'w-full flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-1 transition-colors text-left',
                                        commit.sha === selectedSha && 'bg-surface-1'
                                    )}
                                >
                                    <div className="mt-0.5 flex-shrink-0">
                                        {commit.is_documented ? (
                                            <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                                        ) : (
                                            <GitCommit size={13} className="text-text-muted" />
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-text-muted">{shortenSha(commit.sha)}</span>
                                            <span className="text-xs text-text-muted">{formatRelativeTime(commit.committed_at)}</span>
                                        </div>
                                        <p className="text-sm text-text-secondary truncate">{commit.message}</p>
                                        <p className="text-xs text-text-muted">{commit.author_name}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
