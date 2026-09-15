/**
 * An in-memory user profile store for suites that replace the repositories
 * module with doubles. Sign-in stays real: signInAs saves the profile here and
 * the real authenticate middleware reads it back for a real Firebase ID token.
 */
export function createInMemoryUserRepository() {
    const users = new Map();
    return {
        async findById(id) {
            return users.get(id) || null;
        },
        async findByEmail(email) {
            return [...users.values()].find(user => user.email === email) || null;
        },
        async create(id, data) {
            const record = { id, ...data };
            users.set(id, record);
            return record;
        },
        async update(id, data) {
            const record = { ...(users.get(id) || { id }), ...data };
            users.set(id, record);
            return record;
        },
    };
}
