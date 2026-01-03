export default {
    testEnvironment: 'jsdom',
    rootDir: '.',
    transform: {
        '^.+\\.(t|j)sx?$': ['@swc/jest', {
            jsc: {
                parser: {
                    syntax: 'typescript',
                    decorators: true,
                },
                transform: {
                    decoratorMetadata: true,
                    legacyDecorator: true,
                },
                target: 'es2022',
            },
            module: {
                type: 'commonjs',
            },
        }],
    },
    testMatch: [
        '<rootDir>/tests/**/*.test.ts',
    ],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/**/*.d.ts',
        '!src/skip.d.ts',
    ],
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50,
        },
    },
    setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
    moduleDirectories: ['node_modules', 'src'],
    roots: ['<rootDir>/tests', '<rootDir>/src'],
    testTimeout: 10000,
    modulePaths: ['<rootDir>/src'],
    extensionsToTreatAsEsm: [],
};
