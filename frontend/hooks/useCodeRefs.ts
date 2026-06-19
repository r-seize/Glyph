import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { codeRefsApi } from '@/lib/api';
import { CodeReference } from '@/types';
import { collabBus } from '@/lib/collab-bus';

const refsKey = (projectId: string, path: string, commitSha: string) =>
    ['codeRefs', projectId, path, commitSha] as const;

export function useCodeRefs(projectId: string, path: string, commitSha: string) {
    return useQuery<CodeReference[]>({
        queryKey: refsKey(projectId, path, commitSha),
        enabled: !!projectId && !!path && !!commitSha,
        queryFn: async () => {
            const res = await codeRefsApi.list(projectId, path, commitSha);
            return res.data;
        },
    });
}

export function useCreateCodeRef(projectId: string, path: string, commitSha: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (data: {
            lines: number[];
            label?: string | null;
            note?: string | null;
            color?: string | null;
        }) => {
            const res = await codeRefsApi.create(projectId, {
                file_path: path,
                commit_sha: commitSha,
                lines: data.lines,
                line_start: Math.min(...data.lines),
                line_end: Math.max(...data.lines),
                label: data.label,
                note: data.note,
                color: data.color,
            });
            return res.data as CodeReference;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: refsKey(projectId, path, commitSha) });
            qc.invalidateQueries({ queryKey: ['codeRefsAll', projectId] });
            collabBus.send({ event: 'invalidate', target: 'code-refs' });
        },
    });
}

export function useUpdateCodeRef(projectId: string, path: string, commitSha: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ refId, data }: {
            refId: string;
            data: Partial<{ lines: number[]; label: string | null; note: string | null; color: string | null }>;
        }) => {
            const res = await codeRefsApi.update(projectId, refId, data);
            return res.data as CodeReference;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: refsKey(projectId, path, commitSha) });
            qc.invalidateQueries({ queryKey: ['codeRefsAll', projectId] });
            collabBus.send({ event: 'invalidate', target: 'code-refs' });
        },
    });
}

export function useDeleteCodeRef(projectId: string, path: string, commitSha: string) {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (refId: string) => {
            await codeRefsApi.delete(projectId, refId);
            return refId;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: refsKey(projectId, path, commitSha) });
            qc.invalidateQueries({ queryKey: ['codeRefsAll', projectId] });
            collabBus.send({ event: 'invalidate', target: 'code-refs' });
        },
    });
}
