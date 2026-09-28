export default {
    testEnvironment: 'node',
    transform: {},
    moduleNameMapper: {
        '^(\\.{1,2}/.*)\\.js$': '$1'
    },
    collectCoverage: true,
    // Measure every server source file, loaded by a test or not; test fixtures are not source.
    collectCoverageFrom: ['index.js', 'src/**/*.js'],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'clover'],
    // Lines held at 90% (#47); the rest ratchet just under what #47 measured.
    coverageThreshold: {
        global: {
            branches: 81,
            functions: 94,
            lines: 90,
            statements: 90
        }
    },
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/node_modules_old/'],
    // Emulator-backed suites mutate one shared project and must not overlap.
    maxWorkers: 1,
    verbose: true,
    forceExit: true
};
