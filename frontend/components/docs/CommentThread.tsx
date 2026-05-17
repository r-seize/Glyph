'use client';

import { useComments, useAddComment } from '@/hooks/useDoc';
import { authApi, docsApi } from '@/lib/api';
import Avatar from '@/components/ui/Avatar';
import { formatRelativeTime } from '@/lib/utils';
import { useState } from 'react';
import { MessageCircle, Send, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User } from '@/types';

interface CommentThreadProps {
    projectId: string;
    filePath: string;
    commitSha: string;
}

export default function CommentThread({ projectId, filePath, commitSha }: CommentThreadProps) {
    const { data: comments, isLoading } = useComments(projectId, filePath, commitSha);
    const addComment = useAddComment(projectId);
    const { data: me } = useQuery<User>({ queryKey: ['me'], queryFn: async () => (await authApi.me()).data });
    const [text, setText] = useState('');
    const [error, setError] = useState('');
    const [deleting, setDeleting] = useState<string | null>(null);
    const queryClient = useQueryClient();

    const handleSubmit = async () => {
        if (!text.trim()) return;
        setError('');
        try {
            await addComment.mutateAsync({ content: text.trim(), file_path: filePath, commit_sha: commitSha });
            setText('');
        } catch {
            setError('Unable to send the comment. Please retry.');
        }
    };

    const handleDelete = async (commentId: string) => {
        setDeleting(commentId);
        try {
            await docsApi.deleteComment(projectId, commentId);
            queryClient.invalidateQueries({ queryKey: ['comments', projectId, filePath, commitSha] });
        } finally {
            setDeleting(null);
        }
    };

    if (isLoading) return null;

    return (
        <div className="border-t border-border">
            <div className="flex items-center gap-2 px-4 py-2.5 text-sm text-text-muted">
                <MessageCircle size={13} />
                <span>{comments?.length || 0} comment{(comments?.length || 0) > 1 ? 's' : ''}</span>
            </div>

            {comments && comments.length > 0 && (
                <div className="px-4 space-y-3 pb-3 max-h-48 overflow-y-auto">
                    {comments.map((comment) => (
                        <div key={comment.id} className="flex gap-2.5 group/comment">
                            <Avatar src={comment.author.avatar_url} name={comment.author.username} size="xs" />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-sm font-medium text-text-primary">{comment.author.username}</span>
                                    <span className="text-xs text-text-muted">{formatRelativeTime(comment.created_at)}</span>
                                    {me?.username === comment.author.username && (
                                        <button
                                            onClick={() => handleDelete(comment.id)}
                                            disabled={deleting === comment.id}
                                            className="ml-auto opacity-0 group-hover/comment:opacity-100 transition-opacity text-text-muted hover:text-red-500 disabled:opacity-30"
                                            title="Delete"
                                        >
                                            <Trash2 size={12} />
                                        </button>
                                    )}
                                </div>
                                <p className="text-sm text-text-secondary">{comment.content}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <p className="px-4 pb-1 text-xs text-red-500">{error}</p>
            )}
            <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border">
                <input
                    type="text"
                    value={text}
                    onChange={(e) => { setText(e.target.value); setError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit()}
                    placeholder="Add a comment..."
                    className="flex-1 bg-surface-1 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-strong"
                />
                <Button variant="primary" size="icon" onClick={handleSubmit} isLoading={addComment.isPending}>
                    <Send size={13} />
                </Button>
            </div>
        </div>
    );
}
