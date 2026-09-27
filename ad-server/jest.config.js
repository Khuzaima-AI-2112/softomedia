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
    coverageThreshold: {
        global: {
            branches: 62,
            functions: 81,
            lines: 71,
            statements: 69
        }
    },
    testMatch: ['**/tests/**/*.test.js'],
    testPathIgnorePatterns: ['/node_modules/', '/node_modules_old/'],
    // Emulator-backed suites mutate one shared project and must not overlap.
    maxWorkers: 1,
    verbose: true,
    forceExit: true
};
