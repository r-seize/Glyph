'use client';

import { useFileTree } from '@/hooks/useFileTree';
import FileTreeNode from './FileTreeNode';
import { Loader2 } from 'lucide-react';

interface FileTreeProps {
    projectId: string;
    commitSha?: string;
    activePath?: string;
    onSelect: (path: string) => void;
}

function renderNodes(
    nodes: ReturnType<typeof useFileTree>['data'],
    expandedFolders: Set<string>,
    activePath: string | undefined,
    toggleFolder: (path: string) => void,
    onSelect: (path: string) => void,
    depth = 0
): React.ReactNode {
    if (!nodes) return null;
    return nodes.map((node) => (
        <div key={node.path}>
            <FileTreeNode
                node={node}
                depth={depth}
                isExpanded={expandedFolders.has(node.path)}
                isActive={node.path === activePath}
                onToggle={toggleFolder}
                onSelect={onSelect}
            />
            {node.type === 'directory' && expandedFolders.has(node.path) && node.children && (
                <div>
                    {renderNodes(node.children, expandedFolders, activePath, toggleFolder, onSelect, depth + 1)}
                </div>
            )}
        </div>
    ));
}

export default function FileTree({ projectId, commitSha, activePath, onSelect }: FileTreeProps) {
    const { data, isLoading, expandedFolders, toggleFolder } = useFileTree(projectId, commitSha);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-32 text-text-muted">
                <Loader2 size={16} className="animate-spin" />
            </div>
        );
    }

    if (!data?.length) {
        return <div className="px-3 py-4 text-xs text-text-muted">No file</div>;
    }

    return (
        <div className="px-1 py-2 overflow-y-auto h-full">
            {renderNodes(data, expandedFolders, activePath, toggleFolder, onSelect)}
        </div>
    );
}