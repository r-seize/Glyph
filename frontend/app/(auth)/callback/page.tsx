'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setToken } from '@/lib/auth';
import { Loader2 } from 'lucide-react';

function CallbackInner() {
    const router = useRouter();
    const params = useSearchParams();

    useEffect(() => {
        const token = params.get('token');
        if (token) {
            setToken(token);
            router.replace('/');
        } else {
            router.replace('/login');
        }
    }, [params, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface">
            <div className="flex items-center gap-2 text-text-muted">
                <Loader2 className="animate-spin" size={18} />
                <span className="text-sm">Signing in…</span>
            </div>
        </div>
    );
}

export default function CallbackPage() {
    return (
        <Suspense fallback={null}>
            <CallbackInner />
        </Suspense>
    );
}
