// Jest setup file for global test configuration

// Polyfill MessageChannel for jsdom
if (typeof MessageChannel === 'undefined') {
    global.MessageChannel = class MessageChannel {
        constructor() {
            this.port1 = {
                onmessage: null,
                postMessage: (data) => {
                    if (this.port2.onmessage) {
                        setTimeout(() => {
                            this.port2.onmessage({ data });
                        }, 0);
                    }
                }
            };
            this.port2 = {
                onmessage: null,
                postMessage: (data) => {
                    if (this.port1.onmessage) {
                        setTimeout(() => {
                            this.port1.onmessage({ data });
                        }, 0);
                    }
                }
            };
        }
    };
}

// Suppress console errors in tests unless explicitly testing error handling
const originalError = console.error;
const originalWarn = console.warn;

beforeAll(() => {
    console.error = (...args) => {
        if (
            typeof args[0] === 'string' &&
            (args[0].includes('Not implemented: HTMLFormElement.prototype.submit') ||
             args[0].includes('Not implemented: HTMLCanvasElement.prototype.getContext'))
        ) {
            return;
        }
        originalError.call(console, ...args);
    };
    
    console.warn = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('Not implemented')) {
            return;
        }
        originalWarn.call(console, ...args);
    };
});

afterAll(() => {
    console.error = originalError;
    console.warn = originalWarn;
});

// Global test utilities
global.flushPromises = () => new Promise(resolve => setImmediate(resolve));
global.nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

