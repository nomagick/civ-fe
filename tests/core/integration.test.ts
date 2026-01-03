/**
 * Basic integration tests for CivComponent
 * These tests verify that the core framework pieces work together
 */

import { CivComponent } from '../../src/civ-component';

describe('CivComponent Integration', () => {
    describe('basic instantiation', () => {
        it('should create component instance', () => {
            class TestComponent extends CivComponent {}
            
            const instance = new TestComponent();
            
            expect(instance).toBeInstanceOf(CivComponent);
            expect(instance).toBeInstanceOf(EventTarget);
        });

        it('should have unique serial numbers', () => {
            class TestComponent extends CivComponent {}
            
            const instance1 = new TestComponent();
            const instance2 = new TestComponent();
            
            expect(instance1.serial).not.toBe(instance2.serial);
            expect(typeof instance1.serial).toBe('number');
        });

        it('should have element property', () => {
            class TestComponent extends CivComponent {}
            
            const instance = new TestComponent();
            
            expect(instance).toHaveProperty('element');
        });
    });

    describe('static properties', () => {
        it('should have default mode', () => {
            expect(CivComponent.mode).toBe('auto');
        });

        it('should have components registry', () => {
            expect(CivComponent.components).toBeDefined();
            expect(typeof CivComponent.components).toBe('object');
        });

        it('should have customElementRegistry', () => {
            expect(CivComponent.customElementRegistry).toBeDefined();
        });

        it('should have expressionMap', () => {
            expect(CivComponent.expressionMap).toBeInstanceOf(Map);
        });

        it('should have elemTraitsLookup', () => {
            expect(CivComponent.elemTraitsLookup).toBeInstanceOf(Map);
        });
    });

    describe('inheritance', () => {
        it('should support class inheritance', () => {
            class BaseComponent extends CivComponent {
                baseMethod() {
                    return 'base';
                }
            }

            class DerivedComponent extends BaseComponent {
                derivedMethod() {
                    return 'derived';
                }
            }

            const instance = new DerivedComponent();
            
            expect(instance).toBeInstanceOf(DerivedComponent);
            expect(instance).toBeInstanceOf(BaseComponent);
            expect(instance).toBeInstanceOf(CivComponent);
            expect(instance.baseMethod()).toBe('base');
            expect(instance.derivedMethod()).toBe('derived');
        });
    });

    describe('EventTarget functionality', () => {
        it('should support event dispatching', () => {
            class TestComponent extends CivComponent {}
            
            const instance = new TestComponent();
            const listener = jest.fn();
            
            instance.addEventListener('test', listener);
            instance.dispatchEvent(new CustomEvent('test', { detail: ['data'] }));
            
            expect(listener).toHaveBeenCalled();
        });
    });
});

