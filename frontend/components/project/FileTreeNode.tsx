'use client';

import { FileNode } from '@/types';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';
import {
    FaFolder, FaFolderOpen,
    FaFile, FaFileCode, FaFileAlt, FaFileImage,
} from 'react-icons/fa';
import {
    SiPython, SiJavascript, SiTypescript, SiRust, SiGo,
    SiRuby, SiPhp, SiKotlin, SiSwift, SiCplusplus,
    SiHtml5, SiCss, SiSass, SiMarkdown,
    SiJson, SiYaml, SiDocker, SiGit,
    SiSqlite,
} from 'react-icons/si';
import { VscFile } from 'react-icons/vsc';

interface FileTreeNodeProps {
    node: FileNode;
    depth?: number;
    isExpanded?: boolean;
    isActive?: boolean;
    onToggle?: (path: string) => void;
    onSelect?: (path: string) => void;
}

interface IconDef {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Icon: React.ComponentType<any>;
    color: string;
}

const EXT_MAP: Record<string, IconDef> = {
    // Python
    py: { Icon: SiPython, color: '#3b82f6' },
    pyi: { Icon: SiPython, color: '#3b82f6' },
    // JavaScript
    js: { Icon: SiJavascript, color: '#eab308' },
    jsx: { Icon: SiJavascript, color: '#eab308' },
    mjs: { Icon: SiJavascript, color: '#eab308' },
    cjs: { Icon: SiJavascript, color: '#eab308' },
    // TypeScript
    ts: { Icon: SiTypescript, color: '#3b82f6' },
    tsx: { Icon: SiTypescript, color: '#3b82f6' },
    // Rust
    rs: { Icon: SiRust, color: '#f97316' },
    // Go
    go: { Icon: SiGo, color: '#06b6d4' },
    // Ruby
    rb: { Icon: SiRuby, color: '#ef4444' },
    // PHP
    php: { Icon: SiPhp, color: '#8b5cf6' },
    // Kotlin
    kt: { Icon: SiKotlin, color: '#a855f7' },
    kts: { Icon: SiKotlin, color: '#a855f7' },
    // Swift
    swift: { Icon: SiSwift, color: '#f97316' },
    // C / C++
    c: { Icon: SiCplusplus, color: '#3b82f6' },
    h: { Icon: SiCplusplus, color: '#6b7280' },
    cpp: { Icon: SiCplusplus, color: '#3b82f6' },
    cc: { Icon: SiCplusplus, color: '#3b82f6' },
    cxx: { Icon: SiCplusplus, color: '#3b82f6' },
    hpp: { Icon: SiCplusplus, color: '#6b7280' },
    // Java
    java: { Icon: FaFileCode, color: '#ef4444' },
    // C#
    cs: { Icon: FaFileCode, color: '#8b5cf6' },
    // HTML / CSS
    html: { Icon: SiHtml5, color: '#f97316' },
    htm: { Icon: SiHtml5, color: '#f97316' },
    css: { Icon: SiCss, color: '#3b82f6' },
    scss: { Icon: SiSass, color: '#ec4899' },
    sass: { Icon: SiSass, color: '#ec4899' },
    less: { Icon: SiCss, color: '#8b5cf6' },
    // Markdown / text
    md: { Icon: SiMarkdown, color: '#60a5fa' },
    mdx: { Icon: SiMarkdown, color: '#60a5fa' },
    txt: { Icon: FaFileAlt, color: '#6b7280' },
    rst: { Icon: FaFileAlt, color: '#6b7280' },
    // Data
    json: { Icon: SiJson, color: '#eab308' },
    jsonc: { Icon: SiJson, color: '#eab308' },
    yaml: { Icon: SiYaml, color: '#10b981' },
    yml: { Icon: SiYaml, color: '#10b981' },
    toml: { Icon: FaFileCode, color: '#f97316' },
    xml: { Icon: FaFileCode, color: '#f59e0b' },
    csv: { Icon: FaFileAlt, color: '#10b981' },
    // SQL
    sql: { Icon: SiSqlite, color: '#3b82f6' },
    db: { Icon: SiSqlite, color: '#6b7280' },
    // Shell
    sh: { Icon: FaFileCode, color: '#10b981' },
    bash: { Icon: FaFileCode, color: '#10b981' },
    zsh: { Icon: FaFileCode, color: '#10b981' },
    fish: { Icon: FaFileCode, color: '#10b981' },
    // Docker / CI
    dockerfile: { Icon: SiDocker, color: '#3b82f6' },
    // Git
    gitignore: { Icon: SiGit, color: '#ef4444' },
    gitattributes: { Icon: SiGit, color: '#ef4444' },
    // Images
    png: { Icon: FaFileImage, color: '#8b5cf6' },
    jpg: { Icon: FaFileImage, color: '#8b5cf6' },
    jpeg: { Icon: FaFileImage, color: '#8b5cf6' },
    gif: { Icon: FaFileImage, color: '#8b5cf6' },
    svg: { Icon: FaFileImage, color: '#f97316' },
    webp: { Icon: FaFileImage, color: '#8b5cf6' },
    ico: { Icon: FaFileImage, color: '#8b5cf6' },
};

const NAME_MAP: Record<string, IconDef> = {
    dockerfile: { Icon: SiDocker, color: '#3b82f6' },
    'docker-compose.yml': { Icon: SiDocker, color: '#3b82f6' },
    'docker-compose.yaml': { Icon: SiDocker, color: '#3b82f6' },
    '.gitignore': { Icon: SiGit, color: '#ef4444' },
    '.gitattributes': { Icon: SiGit, color: '#ef4444' },
    'makefile': { Icon: FaFileCode, color: '#6b7280' },
    'license': { Icon: FaFileAlt, color: '#6b7280' },
    'readme.md': { Icon: SiMarkdown, color: '#60a5fa' },
    'readme': { Icon: FaFileAlt, color: '#60a5fa' },
};

function getFileIconDef(name: string): IconDef {
    const lower = name.toLowerCase();
    if (NAME_MAP[lower]) return NAME_MAP[lower];
    const ext = lower.split('.').pop() || '';
    return EXT_MAP[ext] || { Icon: VscFile, color: '#6b7280' };
}

export default function FileTreeNode({
    node, depth = 0, isExpanded = false, isActive = false, onToggle, onSelect,
}: FileTreeNodeProps) {
    const isDir = node.type === 'directory';

    let Icon: React.ComponentType<{ size?: number; className?: string; style?: React.CSSProperties }>;
    let iconColor: string;

    if (isDir) {
        Icon = isExpanded ? FaFolderOpen : FaFolder;
        iconColor = '#e9a441';
    } else {
        const def = getFileIconDef(node.name);
        Icon = def.Icon;
        iconColor = def.color;
    }

    return (
        <div>
            <button
                className={cn(
                    'flex items-center gap-1.5 w-full text-left px-2 py-1 rounded-md text-sm transition-colors group',
                    'hover:bg-surface-2',
                    isActive ? 'bg-primary-muted text-primary font-semibold' : 'text-text-secondary hover:text-text-primary'
                )}
                style={{ paddingLeft: `${(depth * 14) + 8}px` }}
                onClick={() => {
                    if (isDir) onToggle?.(node.path);
                    else onSelect?.(node.path);
                }}
            >
                {isDir ? (
                    <ChevronRight
                        size={12}
                        className={cn('flex-shrink-0 text-text-muted transition-transform', isExpanded && 'rotate-90')}
                    />
                ) : (
                    <span className="w-3 flex-shrink-0" />
                )}

                <Icon size={14} className="flex-shrink-0" style={{ color: iconColor }} />

                <span className="truncate flex-1 text-[13px]">{node.name}</span>

                {node.is_documented && (
                    <span
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity ml-1"
                        title="Documented"
                    />
                )}
            </button>
        </div>
    );
}
