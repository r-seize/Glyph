'use client';

import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { User } from '@/types';
import Avatar from '@/components/ui/Avatar';
import GlobalSearch from '@/components/search/GlobalSearch';
import ThemeToggle from '@/components/ui/ThemeToggle';
import Link from 'next/link';
import { useState } from 'react';

interface TopbarProps {
    breadcrumbs?: { label: string; href?: string }[];
}

export default function Topbar({ breadcrumbs }: TopbarProps) {
    const [searchOpen, setSearchOpen] = useState(false);

    const { data: user } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => {
            const res = await authApi.me();
            return res.data;
        },
    });

    return (
        <>
            <header className="h-12 border-b border-border bg-surface flex items-center px-4 gap-4 fixed top-0 left-56 right-0 z-20">
                {/* Breadcrumb */}
                <div className="flex-1 flex items-center gap-1.5 text-sm text-text-muted overflow-hidden">
                    {breadcrumbs?.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1.5 min-w-0">
                            {i > 0 && <span className="text-text-muted">/</span>}
                            {crumb.href ? (
                                <Link href={crumb.href} className="hover:text-text-secondary transition-colors truncate">
                                    {crumb.label}
                                </Link>
                            ) : (
                                <span className="text-text-secondary truncate">{crumb.label}</span>
                            )}
                        </span>
                    ))}
                </div>

                {/* Search trigger */}
                <button
                    onClick={() => setSearchOpen(true)}
                    className="flex items-center gap-2 h-8 px-3 bg-surface-1 border border-border rounded-lg text-sm text-text-muted hover:text-primary hover:border-primary/40 transition-colors"
                >
                    <span>Search...</span>
                    <kbd className="text-2xs bg-surface-2 px-1 rounded border border-border">⌘K</kbd>
                </button>

                {/* Right */}
                <div className="flex items-center gap-1">
                    <ThemeToggle variant="icon" />
                    {user && (
                        <Link href="/settings" className="rounded-full ring-2 ring-transparent hover:ring-border-strong transition-all" title={user.username}>
                            <Avatar src={user.avatar_url} name={user.username} size="xs" />
                        </Link>
                    )}
                </div>
            </header>

            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
        </>
    );
}
