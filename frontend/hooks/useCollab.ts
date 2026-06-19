'use client';

import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getToken } from '@/lib/auth';
import { collabBus } from '@/lib/collab-bus';

export interface CollabUser {
    user_id: string;
    username: string;
    avatar_url: string | null;
}

export interface RemoteCursor {
    user: CollabUser;
    from: number;
    to: number;
}

export interface UseCollabOptions {
    onDocUpdate?: (content: string) => void;
}

function getWsBase(): string {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
    return apiBase.replace(/^https/, 'wss').replace(/^http/, 'ws');
}

const RECONNECT_DELAY_MS = 3000;

export function useCollab(
    projectId: string,
    commitSha: string,
    filePath: string,
    options?: UseCollabOptions,
): { users: CollabUser[]; remoteCursors: Map<string, RemoteCursor> } {
    const [users, setUsers] = useState<CollabUser[]>([]);
    const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

    const wsRef = useRef<WebSocket | null>(null);
    const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const destroyedRef = useRef(false);
    const onDocUpdateRef = useRef(options?.onDocUpdate);
    onDocUpdateRef.current = options?.onDocUpdate;
    const qc = useQueryClient();

    useEffect(() => {
        destroyedRef.current = false;

        function connect() {
            if (destroyedRef.current) return;

            const token = getToken();
            if (!token) return;

            const url =
                `${getWsBase()}/ws/doc/${projectId}/${commitSha}/${filePath}` +
                `?token=${encodeURIComponent(token)}`;

            const ws = new WebSocket(url);
            wsRef.current = ws;

            ws.onopen = () => {
                collabBus.register((msg) => ws.send(JSON.stringify(msg)));
            };

            ws.onmessage = (event: MessageEvent) => {
                try {
                    const msg = JSON.parse(event.data as string) as {
                        event: string;
                        users?: CollabUser[];
                        user?: CollabUser;
                        user_id?: string;
                        content?: string;
                        target?: string;
                        from?: number;
                        to?: number;
                    };

                    switch (msg.event) {
                        case 'room-users':
                            setUsers(msg.users ?? []);
                            break;

                        case 'user-joined':
                            if (msg.user) {
                                setUsers((prev) =>
                                    prev.some((u) => u.user_id === msg.user!.user_id)
                                        ? prev
                                        : [...prev, msg.user!],
                                );
                            }
                            break;

                        case 'user-left':
                            if (msg.user_id) {
                                setUsers((prev) => prev.filter((u) => u.user_id !== msg.user_id));
                                setRemoteCursors((prev) => {
                                    const next = new Map(prev);
                                    next.delete(msg.user_id!);
                                    return next;
                                });
                            }
                            break;

                        case 'doc-update':
                            if (typeof msg.content === 'string') {
                                // Cursor positions reference the old document - clear them.
                                // They'll be refreshed within 50 ms when the remote user
                                // next moves their cursor or triggers onSelectionUpdate.
                                setRemoteCursors(new Map());
                                onDocUpdateRef.current?.(msg.content);
                            }
                            break;

                        case 'cursor':
                            if (msg.user && typeof msg.from === 'number') {
                                const cursor: RemoteCursor = {
                                    user: msg.user,
                                    from: msg.from,
                                    to: msg.to ?? msg.from,
                                };
                                setRemoteCursors((prev) =>
                                    new Map(prev).set(msg.user!.user_id, cursor),
                                );
                            }
                            break;

                        case 'invalidate':
                            if (msg.target === 'code-refs') {
                                qc.invalidateQueries({ queryKey: ['codeRefs', projectId, filePath, commitSha] });
                                qc.invalidateQueries({ queryKey: ['codeRefsAll', projectId] });
                            } else if (msg.target === 'comments') {
                                qc.invalidateQueries({ queryKey: ['comments', projectId, filePath, commitSha] });
                            }
                            break;
                    }
                } catch {
                    // ignore malformed frames
                }
            };

            ws.onclose = (event: CloseEvent) => {
                wsRef.current = null;
                collabBus.unregister();
                setUsers([]);
                setRemoteCursors(new Map());
                if (destroyedRef.current || event.code === 4001) return;
                retryRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
            };

            ws.onerror = () => {
                ws.close();
            };
        }

        connect();

        return () => {
            destroyedRef.current = true;
            if (retryRef.current) clearTimeout(retryRef.current);
            wsRef.current?.close();
            collabBus.unregister();
            setUsers([]);
            setRemoteCursors(new Map());
        };
    }, [projectId, commitSha, filePath, qc]);

    return { users, remoteCursors };
}
