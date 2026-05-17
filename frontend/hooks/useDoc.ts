import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { docsApi } from '@/lib/api';
import { Document, Comment } from '@/types';

export function useDoc(projectId: string, filePath: string, commitSha: string) {
    return useQuery<Document | null>({
        queryKey: ['doc', projectId, filePath, commitSha],
        queryFn: async () => {
            try {
                const res = await docsApi.get(projectId, filePath, commitSha);
                return res.data;
            } catch (e: any) {
                if (e.response?.status === 404) return null;
                throw e;
            }
        },
        enabled: !!projectId && !!filePath && !!commitSha,
    });
}

export function useSaveDoc() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { projectId: string; file_path: string; commit_sha: string; content: string }) => {
            const { projectId, ...rest } = data;
            return docsApi.save(projectId, rest);
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['doc', variables.projectId, variables.file_path, variables.commit_sha],
            });
        },
    });
}

export function useDocHistory(projectId: string, filePath: string) {
    return useQuery<Document[]>({
        queryKey: ['docHistory', projectId, filePath],
        queryFn: async () => {
            const res = await docsApi.history(projectId, filePath);
            return res.data;
        },
        enabled: !!projectId && !!filePath,
    });
}

export function useComments(projectId: string, filePath: string, commitSha: string) {
    return useQuery<Comment[]>({
        queryKey: ['comments', projectId, filePath, commitSha],
        queryFn: async () => {
            const res = await docsApi.comments(projectId, filePath, commitSha);
            const data: Comment[] = res.data;
            return data.slice().sort((a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            );
        },
        enabled: !!projectId && !!filePath && !!commitSha,
        refetchInterval: 10_000,
    });
}

export function useAddComment(projectId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { content: string; line_number?: number; file_path: string; commit_sha: string }) =>
            docsApi.addComment(projectId, data),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({
                queryKey: ['comments', projectId, variables.file_path, variables.commit_sha],
            });
        },
    });
}