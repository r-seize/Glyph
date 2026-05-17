'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { searchApi } from '@/lib/api';
import { SearchResults, SearchResult } from '@/types';
import { useRouter } from 'next/navigation';
import { Search, BookOpen, GitCommit, File, X, FolderOpen, Code2 } from 'lucide-react';
import { shortenSha } from '@/lib/utils';

interface GlobalSearchProps {
    open: boolean;
    onClose: () => void;
}

export default function GlobalSearch({ open, onClose }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResults | null>(null);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const router = useRouter();

    useEffect(() => {
        if (open) {
            setTimeout(() => inputRef.current?.focus(), 50);
            setQuery('');
            setResults(null);
        }
    }, [open]);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                open ? onClose() : undefined;
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [open, onClose]);

    const search = useCallback(async (q: string) => {
        if (!q.trim()) { setResults(null); return; }
        setLoading(true);
        try {
            const res = await searchApi.search(q);
            setResults(res.data);
        } catch { /* ignore */ } finally {
            setLoading(false);
        }
    }, []);

    const handleChange = (q: string) => {
        setQuery(q);
        clearTimeout(timer.current ?? undefined);
        timer.current = setTimeout(() => search(q), 200);
    };

    if (!open) return null;

    const buildUrl = (item: SearchResult, sectionKey: string) => {
        const base = item.workspace_id && item.project_id
            ? `/workspace/${item.workspace_id}/project/${item.project_id}`
            : null;
        if (!base) return null;
        if (sectionKey === 'projects') return `/workspace/${item.workspace_id}`;
        if ((sectionKey === 'docs' || sectionKey === 'files' || sectionKey === 'code') && item.path) {
            return `${base}/file/${item.path}`;
        }
        return base;
    };

    const sections = results ? [
        { key: 'projects', label: 'Projects', icon: FolderOpen, items: results.projects ?? [] },
        { key: 'docs', label: 'Docs', icon: BookOpen, items: results.docs ?? [] },
        { key: 'code', label: 'Code', icon: Code2, items: results.code ?? [] },
        { key: 'commits', label: 'Commits', icon: GitCommit, items: results.commits ?? [] },
        { key: 'files', label: 'Files', icon: File, items: results.files ?? [] },
    ].filter((s) => s.items.length > 0) : [];

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
            <div className="absolute inset-0 bg-black/35 dark:bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-xl bg-surface border border-border rounded-xl shadow-xl overflow-hidden">
                {/* Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
                    <Search size={16} className="text-text-muted flex-shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => handleChange(e.target.value)}
                        placeholder="Search projects, files, code, commits..."
                        className="flex-1 bg-transparent text-base text-text-primary placeholder:text-text-muted focus:outline-none"
                    />
                    {query && (
                        <button onClick={() => { setQuery(''); setResults(null); }} className="text-text-muted hover:text-text-secondary">
                            <X size={14} />
                        </button>
                    )}
                </div>

                {/* Results */}
                <div className="max-h-80 overflow-y-auto">
                    {loading && (
                        <div className="flex items-center justify-center py-8 text-sm text-text-muted">Searching...</div>
                    )}
                    {!loading && query && !results && (
                        <div className="flex items-center justify-center py-8 text-sm text-text-muted">No results</div>
                    )}
                    {!loading && sections.length > 0 && sections.map((section) => (
                        <div key={section.key}>
                            <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-1">
                                <section.icon size={13} className="text-text-muted" />
                                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">{section.label}</span>
                            </div>
                            {section.items.map((item, i) => (
                                <button
                                    key={i}
                                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-1 transition-colors text-left"
                                    onClick={() => {
                                        const url = buildUrl(item, section.key);
                                        if (url) router.push(url);
                                        onClose();
                                    }}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-text-primary truncate">{item.title}</p>
                                            {item.language && (
                                                <span className="text-2xs text-text-muted bg-surface-2 px-1.5 py-0.5 rounded flex-shrink-0">{item.language}</span>
                                            )}
                                        </div>
                                        {item.excerpt && section.key === 'code' ? (
                                            <p className="text-xs text-text-muted font-mono truncate mt-0.5 bg-surface-1 px-1.5 py-0.5 rounded">{item.excerpt}</p>
                                        ) : item.excerpt ? (
                                            <p className="text-xs text-text-muted truncate mt-0.5">{item.excerpt}</p>
                                        ) : null}
                                        {item.path && section.key !== 'files' && (
                                            <p className="text-xs text-text-muted font-mono truncate mt-0.5">{item.path}</p>
                                        )}
                                    </div>
                                    {item.sha && (
                                        <span className="text-xs font-mono text-text-muted flex-shrink-0">{shortenSha(item.sha)}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    ))}
                    {!loading && !query && (
                        <div className="px-4 py-8 text-center text-sm text-text-muted">
                            Type to search across your projects
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-surface-1">
                    <span className="text-xs text-text-muted">↑↓ navigate · Enter to open · Esc to close</span>
                </div>
            </div>
        </div>
    );
}
