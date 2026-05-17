import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

function toUTCDate(date: string | Date): Date {
    if (date instanceof Date) return date;
    // Treat naive ISO strings (no Z / no offset) as UTC to avoid local-time drift
    if (typeof date === 'string' && !date.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(date)) {
        return new Date(date + 'Z');
    }
    return new Date(date);
}

export function formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(toUTCDate(date));
}

export function formatRelativeTime(date: string | Date): string {
    return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(toUTCDate(date));
}

export function truncate(str: string, length: number): string {
    if (str.length <= length) return str;
    return str.slice(0, length) + '...';
}

export function shortenSha(sha: string): string {
    return sha.slice(0, 7);
}

const LANGUAGE_COLORS: Record<string, string> = {
    TypeScript: '#3178c6',
    JavaScript: '#f7df1e',
    Python: '#3572A5',
    Rust: '#dea584',
    Go: '#00ADD8',
    Java: '#b07219',
    'C++': '#f34b7d',
    C: '#555555',
    Ruby: '#701516',
    PHP: '#4F5D95',
    Swift: '#fa7343',
    Kotlin: '#A97BFF',
    CSS: '#563d7c',
    HTML: '#e34c26',
    Shell: '#89e051',
    Markdown: '#083fa1',
    JSON: '#292929',
    YAML: '#cb171e',
    default: '#8b8b8b',
};

export function getLanguageColor(language: string): string {
    return LANGUAGE_COLORS[language] || LANGUAGE_COLORS.default;
}

export function getInitials(name: string): string {
    return name
        .split(/[\s_-]/)
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
}