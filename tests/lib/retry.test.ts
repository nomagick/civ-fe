import { patchRetry } from '../../src/lib/retry';

describe('patchRetry', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('should succeed on first try if function succeeds', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const wrappedFn = patchRetry(fn, 3, 100);
        
        const promise = wrappedFn();
        jest.runAllTimers();
        const result = await promise;
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('fail 1'))
            .mockRejectedValueOnce(new Error('fail 2'))
            .mockResolvedValue('success');
        const wrappedFn = patchRetry(fn, 3, 100);
        
        const promise = wrappedFn();
        await jest.runAllTimersAsync();
        const result = await promise;
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should reject after max attempts', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('persistent failure'));
        const wrappedFn = patchRetry(fn, 3, 100);
        
        const promise = wrappedFn();
        jest.runAllTimersAsync();
        
        await expect(promise).rejects.toThrow('persistent failure');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should respect delay between retries', async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValue('success');
        const wrappedFn = patchRetry(fn, 3, 500);
        
        const promise = wrappedFn();
        await Promise.resolve();
        
        expect(fn).toHaveBeenCalledTimes(1);
        
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        
        expect(fn).toHaveBeenCalledTimes(2);
        
        const result = await promise;
        expect(result).toBe('success');
    });

    // Note: patchRetry doesn't support exponential backoff, removing this test
    // or test the decorator version instead

    it('should pass arguments to function', async () => {
        const fn = jest.fn().mockResolvedValue('success');
        const wrappedFn = patchRetry(fn, 3, 0);
        
        const promise = wrappedFn('arg1', 42, { key: 'value' });
        jest.runAllTimers();
        await promise;
        
        expect(fn).toHaveBeenCalledWith('arg1', 42, { key: 'value' });
    });

    it('should use specified maxAttempts', async () => {
        const fn = jest.fn().mockRejectedValue(new Error('fail'));
        const wrappedFn = patchRetry(fn, 3, 100);
        
        const promise = wrappedFn();
        
        jest.runAllTimersAsync();
        
        await expect(promise).rejects.toThrow('fail');
        expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should use specified delay', async () => {
        const fn = jest.fn()
            .mockRejectedValueOnce(new Error('fail'))
            .mockResolvedValue('success');
        const wrappedFn = patchRetry(fn, 2, 1000);
        
        const promise = wrappedFn();
        await Promise.resolve();
        
        expect(fn).toHaveBeenCalledTimes(1);
        
        jest.advanceTimersByTime(999);
        await Promise.resolve();
        expect(fn).toHaveBeenCalledTimes(1);
        
        jest.advanceTimersByTime(1);
        await Promise.resolve();
        expect(fn).toHaveBeenCalledTimes(2);
        
        await promise;
    });

    it('should handle synchronous functions', async () => {
        const fn = jest.fn()
            .mockImplementationOnce(() => { throw new Error('fail'); })
            .mockReturnValue('success');
        const wrappedFn = patchRetry(fn, 3, 100);
        
        const promise = wrappedFn();
        jest.runAllTimers();
        const result = await promise;
        
        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(2);
    });
});

