import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, filesApi } from '@/lib/api';
import { Project } from '@/types';

export function useProject(projectId: string) {
    return useQuery<Project>({
        queryKey: ['project', projectId],
        queryFn: async () => {
            const res = await projectsApi.get(projectId);
            return res.data;
        },
        enabled: !!projectId,
    });
}

export function useProjects(workspaceId: string) {
    return useQuery<Project[]>({
        queryKey: ['projects', workspaceId],
        queryFn: async () => {
            const res = await projectsApi.list(workspaceId);
            return res.data;
        },
        enabled: !!workspaceId,
    });
}

export function useSyncProject() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: ({ projectId, force, discard_deleted }: { projectId: string; force?: boolean; discard_deleted?: boolean }) =>
            projectsApi.sync(projectId, force, discard_deleted),
        onSuccess: (_, { projectId }) => {
            queryClient.invalidateQueries({ queryKey: ['project', projectId] });
            queryClient.invalidateQueries({ queryKey: ['commits', projectId] });
            queryClient.invalidateQueries({ queryKey: ['fileTree', projectId] });
            queryClient.invalidateQueries({ queryKey: ['contributors', projectId] });
            queryClient.invalidateQueries({ queryKey: ['branches', projectId] });
        },
    });
}

export function useBranches(projectId: string) {
    return useQuery<string[]>({
        queryKey: ['branches', projectId],
        queryFn: async () => (await filesApi.branches(projectId)).data,
        enabled: !!projectId,
        staleTime: 30_000,
    });
}

export function useContributors(projectId: string, branch?: string) {
    return useQuery<{ name: string; email: string; commits: number }[]>({
        queryKey: ['contributors', projectId, branch],
        queryFn: async () => (await projectsApi.contributors(projectId, branch)).data,
        enabled: !!projectId,
        staleTime: 60_000,
    });
}

export function useCreateProject(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (data: { name: string; repo_url: string; description?: string; default_branch?: string }) =>
            projectsApi.create(workspaceId, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
        },
    });
}

export function useDeleteProject(workspaceId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: (projectId: string) => projectsApi.delete(projectId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['projects', workspaceId] });
        },
    });
}