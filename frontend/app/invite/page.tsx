'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { invitesApi, authApi } from '@/lib/api';
import { getToken } from '@/lib/auth';
import { User } from '@/types';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Users, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const ROLE_LABELS: Record<string, string> = {
    owner: 'Owner',
    admin: 'Admin',
    developer: 'Developer',
    viewer: 'Viewer',
};

function InviteContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get('token') || '';
    const isLoggedIn = !!getToken();

    const { data: user } = useQuery<User>({
        queryKey: ['me'],
        queryFn: async () => (await authApi.me()).data,
        enabled: isLoggedIn,
    });

    const { data: invite, isLoading, isError } = useQuery({
        queryKey: ['invite', token],
        queryFn: async () => (await invitesApi.getByToken(token)).data,
        enabled: !!token,
        retry: false,
    });

    const accept = useMutation({
        mutationFn: () => invitesApi.accept(token),
        onSuccess: (res) => {
            router.push(`/workspace/${res.data.workspace_id}`);
        },
    });

    const [joined, setJoined] = useState(false);

    useEffect(() => {
        if (accept.isSuccess) setJoined(true);
    }, [accept.isSuccess]);

    if (!token) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={36} className="text-text-muted mb-3" />
                <p className="text-base text-text-secondary">Invalid invitation link.</p>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Loader2 size={24} className="animate-spin text-text-muted" />
            </div>
        );
    }

    if (isError || !invite) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <AlertCircle size={36} className="text-red-500 mb-3" />
                <p className="text-base text-text-secondary mb-1">Invitation not found or expired.</p>
                <p className="text-sm text-text-muted">This link is no longer valid. Request a new link.</p>
            </div>
        );
    }

    return (
        <div className="bg-surface border border-border rounded-xl p-7 shadow-sm text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Users size={24} className="text-primary" />
            </div>
            <h1 className="text-lg font-semibold text-text-primary mb-1">
                Join <span className="text-primary">{invite.workspace_name}</span>
            </h1>
            <p className="text-sm text-text-muted mb-6">
                You have been invited as <strong className="text-text-secondary">{ROLE_LABELS[invite.role] ?? invite.role}</strong>.
            </p>

            {!isLoggedIn ? (
                <div className="space-y-3">
                    <p className="text-sm text-text-secondary mb-4">
                        Sign in or create an account to join this workspace.
                    </p>
                    <Button variant="primary" className="w-full" onClick={() =>
                        router.push(`/login?redirect=${encodeURIComponent(`/invite?token=${token}`)}`)
                    }>
                        Sign in
                    </Button>
                    <Button variant="secondary" className="w-full" onClick={() =>
                        router.push(`/register?redirect=${encodeURIComponent(`/invite?token=${token}`)}`)
                    }>
                        Create account
                    </Button>
                </div>
            ) : joined ? (
                <div className="flex flex-col items-center gap-3">
                    <CheckCircle size={32} className="text-emerald-500" />
                    <p className="text-sm text-text-secondary">You have joined the workspace!</p>
                    <Button variant="primary" onClick={() => router.push(`/workspace/${invite.workspace_id}`)}>
                        Go to workspace
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {user && (
                        <p className="text-xs text-text-muted mb-2">
                            Signed in as <strong className="text-text-secondary">@{user.username}</strong>
                        </p>
                    )}
                    {accept.isError && (
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                            An error occurred. Retry.
                        </p>
                    )}
                    <Button variant="primary" className="w-full" isLoading={accept.isPending} onClick={() => accept.mutate()}>
                        Join workspace
                    </Button>
                </div>
            )}
        </div>
    );
}

export default function InvitePage() {
    return (
        <Suspense>
            <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative">
                <div className="absolute top-4 right-4">
                    <ThemeToggle variant="icon" />
                </div>
                <div className="w-full max-w-sm">
                    <div className="flex items-center justify-center gap-2.5 mb-8">
                        <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                            <span className="text-white font-bold text-base">G</span>
                        </div>
                        <span className="text-xl font-semibold tracking-tight text-text-primary">Glyph</span>
                    </div>
                    <InviteContent />
                </div>
            </div>
        </Suspense>
    );
}
