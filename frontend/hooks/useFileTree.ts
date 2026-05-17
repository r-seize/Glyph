import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { filesApi } from '@/lib/api';
import { FileNode } from '@/types';

function buildTree(files: Array<{ path: string; type: string; language?: string; is_documented?: boolean }>): FileNode[] {
    const root: FileNode[] = [];
    const map: Record<string, FileNode> = {};

    const sorted = [...files].sort((a, b) => {
        if (a.type === 'directory' && b.type !== 'directory') return -1;
        if (b.type === 'directory' && a.type !== 'directory') return 1;
        return a.path.localeCompare(b.path);
    });

    for (const file of sorted) {
        const parts = file.path.split('/');
        const name = parts[parts.length - 1];

        const node: FileNode = {
            path: file.path,
            name,
            type: file.type as 'file' | 'directory',
            language: file.language,
            is_documented: file.is_documented,
            children: file.type === 'directory' ? [] : undefined,
        };

        map[file.path] = node;

        if (parts.length === 1) {
            root.push(node);
        } else {
            const parentPath = parts.slice(0, -1).join('/');
            if (map[parentPath]) {
                map[parentPath].children = map[parentPath].children || [];
                map[parentPath].children!.push(node);
            } else {
                root.push(node);
            }
        }
    }

    return root;
}

const expandedKey = (projectId: string) => `glyph-expanded-${projectId}`;

export function useFileTree(projectId: string, commitSha?: string) {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    // Restore persisted expanded state when project changes
    useEffect(() => {
        try {
            const stored = localStorage.getItem(expandedKey(projectId));
            setExpandedFolders(stored ? new Set(JSON.parse(stored) as string[]) : new Set());
        } catch {
            setExpandedFolders(new Set());
        }
    }, [projectId]);

    const query = useQuery({
        queryKey: ['fileTree', projectId, commitSha],
        queryFn: async () => {
            const res = await filesApi.tree(projectId, commitSha);
            return buildTree(res.data);
        },
        enabled: !!projectId,
    });

    const toggleFolder = (path: string) => {
        setExpandedFolders((prev) => {
            const next = new Set(prev);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            try { localStorage.setItem(expandedKey(projectId), JSON.stringify([...next])); }
            catch { /* quota exceeded, ignore */ }
            return next;
        });
    };

    return { ...query, expandedFolders, toggleFolder };
}

export function useFileContent(projectId: string, path: string, commitSha?: string) {
    return useQuery<{ content: string; language: string }>({
        queryKey: ['fileContent', projectId, path, commitSha],
        queryFn: async () => {
            const res = await filesApi.content(projectId, path, commitSha);
            return res.data;
        },
        enabled: !!projectId && !!path,
    });
}