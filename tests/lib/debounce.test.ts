import { debounce } from '../../src/lib/debounce';

describe('debounce decorator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should debounce method calls', async () => {
        class TestClass {
            callCount = 0;

            @debounce(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        const promise1 = instance.method();
        const promise2 = instance.method();
        const promise3 = instance.method();

        jest.advanceTimersByTime(100);

        const results = await Promise.all([promise1, promise2, promise3]);
        
        expect(instance.callCount).toBe(1);
        expect(results).toEqual([1, 1, 1]);
    });

    it('should execute function after wait period', async () => {
        class TestClass {
            value = 0;

            @debounce(200)
            increment() {
                this.value++;
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const promise = instance.increment();
        
        expect(instance.value).toBe(0);
        
        jest.advanceTimersByTime(200);
        
        const result = await promise;
        expect(result).toBe(1);
        expect(instance.value).toBe(1);
    });

    it('should reset timer on subsequent calls', async () => {
        class TestClass {
            callCount = 0;

            @debounce(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        instance.method();
        jest.advanceTimersByTime(50);
        
        instance.method();
        jest.advanceTimersByTime(50);
        
        const promise = instance.method();
        jest.advanceTimersByTime(100);
        
        await promise;
        
        expect(instance.callCount).toBe(1);
    });

    it('should respect maxWait parameter', async () => {
        class TestClass {
            callCount = 0;

            @debounce(100, 250)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        instance.method();
        jest.advanceTimersByTime(80);
        
        instance.method();
        jest.advanceTimersByTime(80);
        
        instance.method();
        jest.advanceTimersByTime(80);
        
        // Total time: 240ms, still within maxWait
        instance.method();
        jest.advanceTimersByTime(120);
        
        // Total time: 260ms, exceeds maxWait of 250ms
        await Promise.resolve();
        
        expect(instance.callCount).toBe(1);
    });

    it('should handle multiple instances independently', async () => {
        class TestClass {
            callCount = 0;

            @debounce(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        
        const promise1 = instance1.method();
        const promise2 = instance2.method();
        
        jest.advanceTimersByTime(100);
        
        await Promise.all([promise1, promise2]);
        
        expect(instance1.callCount).toBe(1);
        expect(instance2.callCount).toBe(1);
    });

    it('should pass arguments correctly', async () => {
        class TestClass {
            @debounce(100)
            sum(a: number, b: number) {
                return a + b;
            }
        }

        const instance = new TestClass();
        
        const promise = instance.sum(5, 3);
        
        jest.advanceTimersByTime(100);
        
        const result = await promise;
        expect(result).toBe(8);
    });

    it('should preserve this context', async () => {
        class TestClass {
            value = 42;

            @debounce(100)
            getValue() {
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const promise = instance.getValue();
        
        jest.advanceTimersByTime(100);
        
        const result = await promise;
        expect(result).toBe(42);
    });

    it('should handle errors and reject promise', async () => {
        class TestClass {
            @debounce(100)
            throwError() {
                throw new Error('test error');
            }
        }

        const instance = new TestClass();
        
        const promise = instance.throwError();
        
        jest.advanceTimersByTime(100);
        
        await expect(promise).rejects.toThrow('test error');
    });

    // Note: SWC handles decorators differently, this test is not applicable
    // Decorators on properties work differently with legacy decorators

    it('should use default wait time of 1000ms', async () => {
        class TestClass {
            called = false;

            @debounce()
            method() {
                this.called = true;
            }
        }

        const instance = new TestClass();
        
        instance.method();
        
        jest.advanceTimersByTime(999);
        expect(instance.called).toBe(false);
        
        jest.advanceTimersByTime(1);
        await Promise.resolve();
        expect(instance.called).toBe(true);
    });
});

