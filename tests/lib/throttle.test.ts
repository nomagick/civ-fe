import { throttle } from '../../src/lib/throttle';

describe('throttle decorator', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should throttle method calls', async () => {
        class TestClass {
            callCount = 0;

            @throttle(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        const result1 = await instance.method();
        expect(result1).toBe(1);
        
        const result2 = await instance.method();
        expect(result2).toBe(1); // Should return cached result
        
        expect(instance.callCount).toBe(1);
    });

    it('should execute function immediately on first call', async () => {
        class TestClass {
            value = 0;

            @throttle(200)
            increment() {
                this.value++;
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const result = await instance.increment();
        
        expect(result).toBe(1);
        expect(instance.value).toBe(1);
    });

    it('should allow execution after wait period', async () => {
        class TestClass {
            callCount = 0;

            @throttle(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        const result1 = await instance.method();
        expect(result1).toBe(1);
        
        jest.advanceTimersByTime(110);
        
        const result2 = await instance.method();
        expect(result2).toBe(2);
        
        expect(instance.callCount).toBe(2);
    });

    it('should return same promise for throttled calls', async () => {
        class TestClass {
            callCount = 0;

            @throttle(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        const promise1 = instance.method();
        const promise2 = instance.method();
        
        expect(promise1).toBe(promise2);
        
        const result = await promise1;
        expect(result).toBe(1);
        expect(instance.callCount).toBe(1);
    });

    it('should handle multiple instances independently', async () => {
        class TestClass {
            callCount = 0;

            @throttle(100)
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        
        await instance1.method();
        await instance2.method();
        
        expect(instance1.callCount).toBe(1);
        expect(instance2.callCount).toBe(1);
    });

    it('should pass arguments correctly', async () => {
        class TestClass {
            @throttle(100)
            sum(a: number, b: number) {
                return a + b;
            }
        }

        const instance = new TestClass();
        
        const result = await instance.sum(5, 3);
        expect(result).toBe(8);
    });

    it('should preserve this context', async () => {
        class TestClass {
            value = 42;

            @throttle(100)
            getValue() {
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const result = await instance.getValue();
        expect(result).toBe(42);
    });

    it('should handle errors and reject promise', async () => {
        class TestClass {
            @throttle(100)
            throwError() {
                throw new Error('test error');
            }
        }

        const instance = new TestClass();
        
        await expect(instance.throwError()).rejects.toThrow('test error');
    });

    // Note: SWC handles decorators differently, this test is not applicable
    // Decorators on properties work differently with legacy decorators

    it('should use default wait time of 1000ms', async () => {
        class TestClass {
            callCount = 0;

            @throttle()
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        await instance.method();
        await instance.method();
        
        expect(instance.callCount).toBe(1);
        
        jest.advanceTimersByTime(1010);
        
        await instance.method();
        expect(instance.callCount).toBe(2);
    });

    it('should update lastRunAt timestamp', async () => {
        class TestClass {
            @throttle(100)
            method() {
                return Date.now();
            }
        }

        const instance = new TestClass();
        
        const time1 = await instance.method();
        
        jest.advanceTimersByTime(150);
        
        const time2 = await instance.method();
        
        expect(time2).toBeGreaterThan(time1);
    });
});

