export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover'],
    coverageThreshold: {
        global: {
            branches: 25,
            functions: 30,
            lines: 35,
            statements: 35
        }
    },
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/node_modules_old/'],
    // Emulator-backed suites mutate one shared project and must not overlap.
    maxWorkers: 1,
    verbose: true,
    forceExit: true
};
