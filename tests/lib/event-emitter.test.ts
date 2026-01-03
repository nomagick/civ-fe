import { EventEmitter, mixinEventEmitter } from '../../src/lib/event-emitter';

describe('EventEmitter', () => {
    let emitter: EventEmitter;

    beforeEach(() => {
        emitter = new EventEmitter();
    });

    describe('on/addListener', () => {
        it('should add event listener', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.emit('test', 'arg1', 'arg2');
            
            expect(listener).toHaveBeenCalledTimes(1);
            expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should support addListener alias', () => {
            const listener = jest.fn();
            
            emitter.addListener('test', listener);
            emitter.emit('test', 'data');
            
            expect(listener).toHaveBeenCalledWith('data');
        });

        it('should add multiple listeners for same event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            emitter.on('test', listener1);
            emitter.on('test', listener2);
            emitter.emit('test', 'value');
            
            expect(listener1).toHaveBeenCalledWith('value');
            expect(listener2).toHaveBeenCalledWith('value');
        });

        it('should allow same listener to be added multiple times', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.on('test', listener);
            emitter.emit('test');
            
            expect(listener).toHaveBeenCalledTimes(2);
        });

        it('should return this for chaining', () => {
            const listener = jest.fn();
            
            const result = emitter.on('test', listener);
            
            expect(result).toBe(emitter);
        });

        it('should only trigger on correct target', () => {
            const emitter2 = new EventEmitter();
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter2.emit('test', 'data');
            
            expect(listener).not.toHaveBeenCalled();
            
            emitter.emit('test', 'data');
            expect(listener).toHaveBeenCalledTimes(1);
        });
    });

    describe('off/removeListener', () => {
        it('should remove event listener', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.off('test', listener);
            emitter.emit('test');
            
            expect(listener).not.toHaveBeenCalled();
        });

        it('should support removeListener alias', () => {
            const listener = jest.fn();
            
            emitter.addListener('test', listener);
            emitter.removeListener('test', listener);
            emitter.emit('test');
            
            expect(listener).not.toHaveBeenCalled();
        });

        it('should remove only one listener when added multiple times', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.on('test', listener);
            emitter.off('test', listener);
            emitter.emit('test');
            
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should not affect other listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            emitter.on('test', listener1);
            emitter.on('test', listener2);
            emitter.off('test', listener1);
            emitter.emit('test');
            
            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalledTimes(1);
        });

        it('should handle removing non-existent listener gracefully', () => {
            const listener = jest.fn();
            
            expect(() => {
                emitter.off('test', listener);
            }).not.toThrow();
        });

        it('should return this for chaining', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            const result = emitter.off('test', listener);
            
            expect(result).toBe(emitter);
        });
    });

    describe('emit', () => {
        it('should emit event with no arguments', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            const result = emitter.emit('test');
            
            expect(listener).toHaveBeenCalledWith();
            expect(result).toBe(true);
        });

        it('should emit event with single argument', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.emit('test', 'arg');
            
            expect(listener).toHaveBeenCalledWith('arg');
        });

        it('should emit event with multiple arguments', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.emit('test', 1, 'two', { three: 3 });
            
            expect(listener).toHaveBeenCalledWith(1, 'two', { three: 3 });
        });

        it('should emit to all registered listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            const listener3 = jest.fn();
            
            emitter.on('test', listener1);
            emitter.on('test', listener2);
            emitter.on('test', listener3);
            emitter.emit('test', 'data');
            
            expect(listener1).toHaveBeenCalledWith('data');
            expect(listener2).toHaveBeenCalledWith('data');
            expect(listener3).toHaveBeenCalledWith('data');
        });
    });

    describe('once', () => {
        it('should execute listener only once', () => {
            const listener = jest.fn();
            
            emitter.once('test', listener);
            emitter.emit('test');
            emitter.emit('test');
            emitter.emit('test');
            
            expect(listener).toHaveBeenCalledTimes(1);
        });

        it('should pass arguments to listener', () => {
            const listener = jest.fn();
            
            emitter.once('test', listener);
            emitter.emit('test', 'arg1', 'arg2');
            
            expect(listener).toHaveBeenCalledWith('arg1', 'arg2');
        });

        it('should preserve this context', () => {
            const listener = jest.fn(function(this: EventEmitter) {
                expect(this).toBe(emitter);
            });
            
            emitter.once('test', listener);
            emitter.emit('test');
        });

        it('should return this for chaining', () => {
            const listener = jest.fn();
            
            const result = emitter.once('test', listener);
            
            expect(result).toBe(emitter);
        });

        it('should automatically remove itself after execution', () => {
            const listener = jest.fn();
            
            emitter.once('test', listener);
            expect(emitter.listenerCount('test')).toBe(1);
            
            emitter.emit('test');
            expect(emitter.listenerCount('test')).toBe(0);
        });
    });

    describe('removeAllListeners', () => {
        it('should remove all listeners for specific event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            emitter.on('test', listener1);
            emitter.on('test', listener2);
            emitter.removeAllListeners('test');
            emitter.emit('test');
            
            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
        });

        it('should remove all listeners for all events when no event specified', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            emitter.on('event1', listener1);
            emitter.on('event2', listener2);
            emitter.removeAllListeners();
            
            emitter.emit('event1');
            emitter.emit('event2');
            
            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).not.toHaveBeenCalled();
        });

        it('should not affect other events when removing specific event', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            
            emitter.on('event1', listener1);
            emitter.on('event2', listener2);
            emitter.removeAllListeners('event1');
            
            emitter.emit('event1');
            emitter.emit('event2');
            
            expect(listener1).not.toHaveBeenCalled();
            expect(listener2).toHaveBeenCalled();
        });

        it('should handle removing non-existent event gracefully', () => {
            expect(() => {
                emitter.removeAllListeners('nonexistent');
            }).not.toThrow();
        });

        it('should return this for chaining', () => {
            const result = emitter.removeAllListeners();
            
            expect(result).toBe(emitter);
        });
    });

    describe('listenerCount', () => {
        it('should return 0 for event with no listeners', () => {
            expect(emitter.listenerCount('test')).toBe(0);
        });

        it('should return correct count for single listener', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            
            expect(emitter.listenerCount('test')).toBe(1);
        });

        it('should return correct count for multiple listeners', () => {
            const listener1 = jest.fn();
            const listener2 = jest.fn();
            const listener3 = jest.fn();
            
            emitter.on('test', listener1);
            emitter.on('test', listener2);
            emitter.on('test', listener3);
            
            expect(emitter.listenerCount('test')).toBe(3);
        });

        it('should count same listener added multiple times', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.on('test', listener);
            
            expect(emitter.listenerCount('test')).toBe(2);
        });

        it('should update count after removing listener', () => {
            const listener = jest.fn();
            
            emitter.on('test', listener);
            emitter.on('test', listener);
            expect(emitter.listenerCount('test')).toBe(2);
            
            emitter.off('test', listener);
            expect(emitter.listenerCount('test')).toBe(1);
        });
    });
});

describe('mixinEventEmitter', () => {
    it('should mixin EventEmitter functionality into base class', () => {
        class Base extends EventTarget {
            value = 42;
        }

        const Mixed = mixinEventEmitter(Base);
        const instance = new Mixed();
        
        expect(instance).toHaveProperty('on');
        expect(instance).toHaveProperty('off');
        expect(instance).toHaveProperty('emit');
        expect(instance).toHaveProperty('once');
        expect(instance).toHaveProperty('value', 42);
    });

    it('should work with custom base class', () => {
        class CustomTarget extends EventTarget {
            customMethod() {
                return 'custom';
            }
        }

        const Mixed = mixinEventEmitter(CustomTarget);
        const instance = new Mixed();
        
        const listener = jest.fn();
        instance.on('test', listener);
        instance.emit('test', 'data');
        
        expect(listener).toHaveBeenCalledWith('data');
        expect(instance.customMethod()).toBe('custom');
    });

    it('should set descriptive class name', () => {
        class MyTarget extends EventTarget {}

        const Mixed = mixinEventEmitter(MyTarget);
        
        expect(Mixed.name).toBe('EventEmittingMyTarget');
    });
});

