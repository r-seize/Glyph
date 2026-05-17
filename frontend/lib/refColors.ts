// Shared color palettes for code references.
// Used by CodeViewer (line highlight), CodeReferencesPanel (dot indicator),
// and DocEditor (chip rendering) so colors stay consistent across the app.

export const REF_BG_PALETTE = [
    'rgba(250, 204, 21, 0.18)',
    'rgba(96, 165, 250, 0.18)',
    'rgba(74, 222, 128, 0.18)',
    'rgba(244, 114, 182, 0.18)',
    'rgba(167, 139, 250, 0.18)',
    'rgba(251, 146, 60, 0.18)',
];

export const REF_BORDER_PALETTE = [
    'rgb(202, 138, 4)',
    'rgb(37, 99, 235)',
    'rgb(22, 163, 74)',
    'rgb(219, 39, 119)',
    'rgb(124, 58, 237)',
    'rgb(234, 88, 12)',
];

export interface RefColors {
    background: string;
    border: string;
    text: string;
}

/**
 * Compute the visual colors for a reference at a given index in its file.
 * If the reference has a custom `color` set, that color is used as both
 * the border and text colors with a translucent background; otherwise the
 * shared palettes are used keyed by `index`.
 */
export function refColorAt(index: number, customColor?: string | null): RefColors {
    if (customColor) {
        return {
            background: hexToRgba(customColor, 0.18),
            border: customColor,
            text: customColor,
        };
    }
    const i = ((index % REF_BG_PALETTE.length) + REF_BG_PALETTE.length) % REF_BG_PALETTE.length;
    return {
        background: REF_BG_PALETTE[i],
        border: REF_BORDER_PALETTE[i],
        text: REF_BORDER_PALETTE[i],
    };
}

function hexToRgba(color: string, alpha: number): string {
    if (color.startsWith('#') && (color.length === 7 || color.length === 4)) {
        const hex = color.length === 4
            ? color.slice(1).split('').map((c) => c + c).join('')
            : color.slice(1);
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // rgb()/rgba()/named -- return as-is, caller can use it directly
    return color;
}
