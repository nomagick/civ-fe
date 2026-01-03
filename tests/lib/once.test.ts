import { runOncePerInstance, runOncePerClass } from '../../src/lib/once';

describe('runOncePerInstance decorator', () => {
    it('should execute method only once per instance', () => {
        class TestClass {
            callCount = 0;

            @runOncePerInstance
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance = new TestClass();
        
        const result1 = instance.method();
        const result2 = instance.method();
        const result3 = instance.method();
        
        expect(result1).toBe(1);
        expect(result2).toBe(1);
        expect(result3).toBe(1);
        expect(instance.callCount).toBe(1);
    });

    it('should execute independently for different instances', () => {
        class TestClass {
            callCount = 0;

            @runOncePerInstance
            method() {
                this.callCount++;
                return this.callCount;
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        
        const result1 = instance1.method();
        const result2 = instance2.method();
        
        expect(result1).toBe(1);
        expect(result2).toBe(1);
        expect(instance1.callCount).toBe(1);
        expect(instance2.callCount).toBe(1);
    });

    it('should cache and return the same result', () => {
        class TestClass {
            @runOncePerInstance
            getRandomNumber() {
                return Math.random();
            }
        }

        const instance = new TestClass();
        
        const result1 = instance.getRandomNumber();
        const result2 = instance.getRandomNumber();
        const result3 = instance.getRandomNumber();
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
    });

    it('should preserve this context', () => {
        class TestClass {
            value = 42;

            @runOncePerInstance
            getValue() {
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const result = instance.getValue();
        expect(result).toBe(42);
    });

    it('should pass arguments on first call', () => {
        class TestClass {
            @runOncePerInstance
            sum(a: number, b: number) {
                return a + b;
            }
        }

        const instance = new TestClass();
        
        const result1 = instance.sum(5, 3);
        const result2 = instance.sum(10, 20); // Arguments ignored
        
        expect(result1).toBe(8);
        expect(result2).toBe(8);
    });

    it('should cache thrown errors', () => {
        class TestClass {
            callCount = 0;

            @runOncePerInstance
            throwError() {
                this.callCount++;
                throw new Error('test error');
            }
        }

        const instance = new TestClass();
        
        expect(() => instance.throwError()).toThrow('test error');
        expect(() => instance.throwError()).toThrow('test error');
        expect(() => instance.throwError()).toThrow('test error');
        
        expect(instance.callCount).toBe(1);
    });

    // Note: SWC handles decorators differently, this test is not applicable
    // Decorators on properties work differently with legacy decorators
});

describe('runOncePerClass decorator', () => {
    it('should execute method only once per class', () => {
        class TestClass {
            callCount = 0;

            @runOncePerClass
            method() {
                this.callCount++;
                return 'result';
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        
        const result1 = instance1.method();
        const result2 = instance1.method();
        const result3 = instance2.method();
        
        expect(result1).toBe('result');
        expect(result2).toBe('result');
        expect(result3).toBe('result');
        
        // Only the first instance's method actually executes
        expect(instance1.callCount).toBe(1);
        expect(instance2.callCount).toBe(0);
    });

    it('should share result across all instances', () => {
        class TestClass {
            @runOncePerClass
            getRandomNumber() {
                return Math.random();
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        const instance3 = new TestClass();
        
        const result1 = instance1.getRandomNumber();
        const result2 = instance2.getRandomNumber();
        const result3 = instance3.getRandomNumber();
        
        expect(result1).toBe(result2);
        expect(result2).toBe(result3);
    });

    it('should execute independently for different classes', () => {
        class TestClass1 {
            static counter = 0;

            @runOncePerClass
            method() {
                return ++TestClass1.counter;
            }
        }

        class TestClass2 {
            static counter = 0;

            @runOncePerClass
            method() {
                return ++TestClass2.counter;
            }
        }

        const instance1 = new TestClass1();
        const instance2 = new TestClass2();
        
        const result1 = instance1.method();
        const result2 = instance2.method();
        
        expect(result1).toBe(1);
        expect(result2).toBe(1);
        expect(TestClass1.counter).toBe(1);
        expect(TestClass2.counter).toBe(1);
    });

    it('should preserve this context', () => {
        class TestClass {
            value = 42;

            @runOncePerClass
            getValue() {
                return this.value;
            }
        }

        const instance = new TestClass();
        
        const result = instance.getValue();
        expect(result).toBe(42);
    });

    it('should cache thrown errors', () => {
        class TestClass {
            callCount = 0;

            @runOncePerClass
            throwError() {
                this.callCount++;
                throw new Error('test error');
            }
        }

        const instance1 = new TestClass();
        const instance2 = new TestClass();
        
        expect(() => instance1.throwError()).toThrow('test error');
        expect(() => instance1.throwError()).toThrow('test error');
        expect(() => instance2.throwError()).toThrow('test error');
        
        expect(instance1.callCount).toBe(1);
        expect(instance2.callCount).toBe(0);
    });

    // Note: SWC handles decorators differently, this test is not applicable
    // Decorators on properties work differently with legacy decorators
});

