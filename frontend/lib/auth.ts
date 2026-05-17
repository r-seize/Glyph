const TOKEN_KEY = 'glyph_token';

export function getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
    localStorage.removeItem(TOKEN_KEY);
}

export function parseJwt(token: string): { user_id?: string; exp?: number } | null {
    try {
        const base64 = token.split('.')[1];
        const decoded = JSON.parse(atob(base64));
        return decoded;
    } catch {
        return null;
    }
}

export function isAuthenticated(): boolean {
    const token = getToken();
    if (!token) return false;
    const payload = parseJwt(token);
    if (!payload?.exp) return false;
    return payload.exp * 1000 > Date.now();
}