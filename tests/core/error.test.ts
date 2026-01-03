import { CivFeError } from '../../src/error';
import { DomMaintenanceTaskType, DomConstructionTaskType } from '../../src/dom';

describe('CivFeError', () => {
    describe('constructor', () => {
        it('should create error with message', () => {
            const error = new CivFeError('test error');
            
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(CivFeError);
            expect(error.message).toBe('test error');
        });

        it('should support cause option', () => {
            const cause = new Error('original error');
            const error = new CivFeError('wrapped error', { cause });
            
            expect(error.cause).toBe(cause);
        });
    });

    describe('from', () => {
        it('should return same instance if already CivFeError', () => {
            const original = new CivFeError('original');
            const result = CivFeError.from(original);
            
            expect(result).toBe(original);
        });

        it('should wrap Error instance', () => {
            const original = new Error('original error');
            const result = CivFeError.from(original);
            
            expect(result).toBeInstanceOf(CivFeError);
            expect(result.message).toBe('original error');
            expect(result.cause).toBe(original);
        });

        it('should wrap string error', () => {
            const result = CivFeError.from('string error');
            
            expect(result).toBeInstanceOf(CivFeError);
            expect(result.message).toBe('string error');
        });

        it('should wrap non-Error objects', () => {
            const result = CivFeError.from({ custom: 'error' });
            
            expect(result).toBeInstanceOf(CivFeError);
            expect(result.message).toContain('object');
        });

        it('should include task type in message for maintenance task', () => {
            const task = {
                type: DomMaintenanceTaskType.ATTR_SYNC,
            } as any;
            const original = new Error('task failed');
            
            const result = CivFeError.from(original, task);
            
            expect(result.message).toContain('[DOM Maintenance:');
            expect(result.message).toContain('attrSync');
            expect(result.message).toContain('task failed');
            expect(result.task).toBe(task);
        });

        it('should include task type in message for construction task', () => {
            const task = {
                type: DomConstructionTaskType.SET_ATTR,
            } as any;
            const original = new Error('construction failed');
            
            const result = CivFeError.from(original, task);
            
            expect(result.message).toContain('[DOM Construction:');
            expect(result.message).toContain('setAttr');
            expect(result.message).toContain('construction failed');
            expect(result.task).toBe(task);
        });

        it('should handle string error with task', () => {
            const task = {
                type: DomMaintenanceTaskType.PROP_SYNC,
            } as any;
            
            const result = CivFeError.from('string error', task);
            
            expect(result.message).toContain('[DOM Maintenance:');
            expect(result.message).toContain('string error');
            expect(result.task).toBe(task);
        });

        it('should handle unknown task type', () => {
            const task = {
                type: 'UnknownType',
            } as any;
            const original = new Error('error');
            
            const result = CivFeError.from(original, task);
            
            expect(result.message).toContain('[DOM Unknown:');
        });
    });

    describe('task property', () => {
        it('should store task reference', () => {
            const task = {
                type: DomMaintenanceTaskType.MODEL_SYNC,
                expr: 'test.value',
            } as any;
            
            const error = CivFeError.from(new Error('test'), task);
            
            expect(error.task).toBe(task);
            expect(error.task?.type).toBe(DomMaintenanceTaskType.MODEL_SYNC);
        });

        it('should be undefined when no task provided', () => {
            const error = CivFeError.from(new Error('test'));
            
            expect(error.task).toBeUndefined();
        });
    });

    describe('stack trace', () => {
        it('should have stack trace', () => {
            const error = new CivFeError('test');
            
            expect(error.stack).toBeDefined();
            expect(typeof error.stack).toBe('string');
        });

        it('should capture stack trace when wrapping', () => {
            const original = new Error('original');
            const wrapped = CivFeError.from(original);
            
            expect(wrapped.stack).toBeDefined();
        });
    });
});

