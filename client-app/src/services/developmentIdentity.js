export function getDevelopmentIdentity() {
    if (!import.meta.env.DEV) return null;
    try {
        return JSON.parse(localStorage.getItem('auth_user'));
    } catch {
        return null;
    }
}
