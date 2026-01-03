import { Defer, TimedDefer, TimeoutError } from '../../src/lib/defer';

describe('Defer', () => {
    it('should create a deferred promise', () => {
        const deferred = Defer<string>();
        
        expect(deferred).toHaveProperty('promise');
        expect(deferred).toHaveProperty('resolve');
        expect(deferred).toHaveProperty('reject');
        expect(deferred.promise).toBeInstanceOf(Promise);
    });

    it('should resolve with provided value', async () => {
        const deferred = Defer<string>();
        const testValue = 'test value';
        
        deferred.resolve(testValue);
        
        const result = await deferred.promise;
        expect(result).toBe(testValue);
    });

    it('should resolve with promise', async () => {
        const deferred = Defer<number>();
        const innerPromise = Promise.resolve(42);
        
        deferred.resolve(innerPromise);
        
        const result = await deferred.promise;
        expect(result).toBe(42);
    });

    it('should reject with error', async () => {
        const deferred = Defer<string>();
        const testError = new Error('test error');
        
        deferred.reject(testError);
        
        await expect(deferred.promise).rejects.toThrow('test error');
    });

    it('should be frozen and immutable', () => {
        const deferred = Defer();
        
        expect(Object.isFrozen(deferred)).toBe(true);
        expect(() => {
            (deferred as any).newProperty = 'value';
        }).toThrow();
    });
});

describe('TimedDefer', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should create a timed deferred promise with default timeout', () => {
        const deferred = TimedDefer<string>();
        
        expect(deferred).toHaveProperty('promise');
        expect(deferred).toHaveProperty('resolve');
        expect(deferred).toHaveProperty('reject');
    });

    it('should resolve before timeout', async () => {
        const deferred = TimedDefer<string>(1000);
        const testValue = 'success';
        
        deferred.resolve(testValue);
        
        const result = await deferred.promise;
        expect(result).toBe(testValue);
    });

    it('should timeout after specified duration', async () => {
        const deferred = TimedDefer<string>(1000);
        
        jest.advanceTimersByTime(1001);
        
        await expect(deferred.promise).rejects.toThrow(TimeoutError);
        await expect(deferred.promise).rejects.toThrow('Timed out after 1000ms.');
    });

    it('should have ETIMEDOUT code on timeout error', async () => {
        const deferred = TimedDefer<string>(500);
        
        jest.advanceTimersByTime(501);
        
        try {
            await deferred.promise;
            fail('Should have thrown TimeoutError');
        } catch (err) {
            expect(err).toBeInstanceOf(TimeoutError);
            expect((err as TimeoutError).code).toBe('ETIMEDOUT');
        }
    });

    it('should clear timeout when resolved', async () => {
        const deferred = TimedDefer<number>(1000);
        
        jest.advanceTimersByTime(500);
        deferred.resolve(42);
        
        const result = await deferred.promise;
        expect(result).toBe(42);
        
        // Advance past original timeout - should not throw
        jest.advanceTimersByTime(600);
    });

    it('should clear timeout when rejected', async () => {
        const deferred = TimedDefer<number>(1000);
        const customError = new Error('custom error');
        
        jest.advanceTimersByTime(500);
        deferred.reject(customError);
        
        await expect(deferred.promise).rejects.toThrow('custom error');
        
        // Advance past original timeout - should not throw TimeoutError
        jest.advanceTimersByTime(600);
    });

    it('should use default timeout of 5000ms', async () => {
        const deferred = TimedDefer<string>();
        
        jest.advanceTimersByTime(4999);
        // Should not timeout yet
        
        jest.advanceTimersByTime(2);
        
        await expect(deferred.promise).rejects.toThrow('Timed out after 5000ms.');
    });

    it('should be frozen and immutable', () => {
        const deferred = TimedDefer();
        
        expect(Object.isFrozen(deferred)).toBe(true);
    });
});

describe('TimeoutError', () => {
    it('should be an instance of Error', () => {
        const error = new TimeoutError('timeout');
        
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(TimeoutError);
    });

    it('should have ETIMEDOUT code', () => {
        const error = new TimeoutError('timeout');
        
        expect(error.code).toBe('ETIMEDOUT');
    });

    it('should have correct message', () => {
        const message = 'Custom timeout message';
        const error = new TimeoutError(message);
        
        expect(error.message).toBe(message);
    });
});

