'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { authApi, workspacesApi } from '@/lib/api';
import { User, WorkspaceMember } from '@/types';
import { cn } from '@/lib/utils';

interface WorkspaceNavProps {
    workspaceId: string;
}

const allTabs = [
    { label: 'Projects', href: '' },
    { label: 'Members', href: '/members' },
    { label: 'Settings', href: '/settings', minRole: 'admin' as const },
];

export default function WorkspaceNav({ workspaceId }: WorkspaceNavProps) {
    const pathname = usePathname();
    const base = `/workspace/${workspaceId}`;

    const { data: me } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => (await authApi.me()).data,
    });

    const { data: members } = useQuery<WorkspaceMember[]>({
        queryKey: ['workspaceMembers', workspaceId],
        queryFn: async () => (await workspacesApi.members(workspaceId)).data,
        enabled: !!me,
    });

    const myRole = members?.find((m) => m.user.id === me?.id)?.role;
    const isRestricted = myRole === 'developer' || myRole === 'viewer';

    const tabs = allTabs.filter((t) => !(t.minRole && isRestricted));

    return (
        <div className="flex items-center gap-0.5 border-b border-border px-4">
            {tabs.map((tab) => {
                const href = `${base}${tab.href}`;
                const active = tab.href === '' ? pathname === base : pathname.startsWith(`${base}${tab.href}`);
                return (
                    <Link
                        key={tab.label}
                        href={href}
                        className={cn(
                            'px-3 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
                            active
                                ? 'border-primary text-primary'
                                : 'border-transparent text-text-muted hover:text-text-secondary'
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </div>
    );
}
