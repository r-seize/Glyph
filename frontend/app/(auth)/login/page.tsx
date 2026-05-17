'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { authApi } from '@/lib/api';
import { setToken } from '@/lib/auth';
import Button from '@/components/ui/Button';
import ThemeToggle from '@/components/ui/ThemeToggle';
import { Eye, EyeOff } from 'lucide-react';
import { FaGithub } from 'react-icons/fa';

function GitLabIcon({ size = 16 }: { size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.65 14.39L12 22.13 1.35 14.39a.84.84 0 0 1-.3-.94l1.22-3.78 2.44-7.51A.42.42 0 0 1 4.82 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.49h8.1l2.44-7.51A.42.42 0 0 1 18.6 2a.43.43 0 0 1 .58 0 .42.42 0 0 1 .11.18l2.44 7.51L23 13.45a.84.84 0 0 1-.35.94z" />
        </svg>
    );
}

function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const redirect = searchParams.get('redirect') || '/';

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPwd, setShowPwd] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const { data: authConfig } = useQuery<{ github_oauth: boolean; gitlab_oauth: boolean }>({
        queryKey: ['authConfig'],
        queryFn: async () => (await authApi.config()).data,
    });

    // Show OAuth buttons optimistically while loading; hide only if both explicitly disabled
    const hasOAuth = authConfig === undefined || authConfig.github_oauth || authConfig.gitlab_oauth;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const res = await authApi.login({ email, password });
            setToken(res.data.access_token);
            router.push(redirect);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Invalid credentials');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-4 relative">
            <div className="absolute top-4 right-4">
                <ThemeToggle variant="icon" />
            </div>
            <div className="w-full max-w-sm">
                {/* Logo  */}
                <div className="flex items-center justify-center gap-2.5 mb-8">
                    <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center shadow-sm">
                        <span className="text-white font-bold text-base">G</span>
                    </div>
                    <span className="text-xl font-semibold tracking-tight text-text-primary">Glyph</span>
                </div>

                <div className="bg-surface border border-border rounded-xl p-6 shadow-sm">
                    <h1 className="text-lg font-semibold text-text-primary mb-1">Sign in</h1>
                    <p className="text-sm text-text-muted mb-6">Access your documentation space</p>

                    {/* OAuth buttons */}
                    {hasOAuth && (
                        <>
                            <div className="space-y-2 mb-4">
                                <a
                                        href={authApi.githubUrl()}
                                        className="flex items-center justify-center gap-2.5 h-10 w-full bg-surface-1 border border-border rounded-lg text-sm text-text-primary hover:bg-surface-2 hover:border-border-strong transition-colors"
                                    >
                                        <FaGithub size={16} />
                                        Continue with GitHub
                                    </a>
                                    <a
                                        href={authApi.gitlabUrl()}
                                        className="flex items-center justify-center gap-2.5 h-10 w-full bg-surface-1 border border-border rounded-lg text-sm text-text-primary hover:bg-surface-2 hover:border-border-strong transition-colors"
                                    >
                                        <GitLabIcon size={16} />
                                        Continue with GitLab
                                    </a>
                            </div>

                            <div className="flex items-center gap-3 mb-4">
                                <div className="h-px flex-1 bg-border" />
                                <span className="text-xs text-text-muted">or</span>
                                <div className="h-px flex-1 bg-border" />
                            </div>
                        </>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="you@example.com"
                                className="w-full bg-surface-1 border border-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Password</label>
                            <div className="relative">
                                <input
                                    type={showPwd ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
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

                        {error && (
                            <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-lg px-3 py-2">
                                {error}
                            </p>
                        )}

                        <Button type="submit" variant="primary" className="w-full" size="lg" isLoading={loading}>
                            Sign in
                        </Button>
                    </form>
                </div>

                <p className="text-center text-sm text-text-muted mt-4">
                    Don&apos;t have an account yet?{' '}
                    <Link href="/register" className="text-primary hover:text-primary-hover transition-colors font-medium">
                        Sign up
                    </Link>
                </p>
            </div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense>
            <LoginForm />
        </Suspense>
    );
}
