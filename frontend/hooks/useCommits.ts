import { useQuery } from '@tanstack/react-query';
import { commitsApi, filesApi } from '@/lib/api';
import { Commit } from '@/types';

export function useCommits(projectId: string, branch?: string) {
    return useQuery<Commit[]>({
        queryKey: ['commits', projectId, branch],
        queryFn: async () => {
            const res = await commitsApi.list(projectId, { branch });
            return res.data;
        },
        enabled: !!projectId,
    });
}

export function useFileCommits(projectId: string, filePath: string, branch?: string) {
    return useQuery<Commit[]>({
        queryKey: ['fileCommits', projectId, filePath, branch],
        queryFn: async () => {
            const res = await filesApi.history(projectId, filePath, branch);
            return res.data;
        },
        enabled: !!projectId && !!filePath,
    });
}

export function useCommitDiff(projectId: string, sha: string, path?: string) {
    return useQuery({
        queryKey: ['commitDiff', projectId, sha, path],
        queryFn: async () => {
            const res = await commitsApi.diff(projectId, sha, path);
            return res.data;
        },
        enabled: !!projectId && !!sha,
    });
}
