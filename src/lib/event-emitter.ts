

export class EventEmitter extends EventTarget {
    private __revokers = new Map<string, Map<Function, Set<AbortController>>>();

    on(event: string, listener: (...args: any[]) => void): this {
        return this.addListener(event, listener);
    }

    addListener(event: string, listener: (...args: any[]) => void): this {
        const controller = new AbortController();
        const expectedTgt = this;
        const wrapper: EventListener = function (this: EventEmitter, e) {
            if (e.target !== expectedTgt) {
                return;
            }
            const customEvent = e as CustomEvent;
            listener.call(this, ...(customEvent.detail || []));
        };

        if (!this.__revokers.has(event)) {
            this.__revokers.set(event, new Map());
        }

        const eventListeners = this.__revokers.get(event)!;
        if (!eventListeners.has(listener)) {
            eventListeners.set(listener, new Set());
        }

        eventListeners.get(listener)!.add(controller);
        this.addEventListener(event, wrapper, { signal: controller.signal });
        return this;
    }

    off(event: string, listener: (...args: any[]) => void): this {
        return this.removeListener(event, listener);
    }

    removeListener(event: string, listener: (...args: any[]) => void): this {
        const eventListeners = this.__revokers.get(event);

        if (eventListeners?.has(listener)) {
            const controllers = eventListeners.get(listener)!;

            // Remove one controller (first one from the set)
            const controller = controllers.values().next().value;
            if (controller) {
                controller.abort();
                controllers.delete(controller);
            }

            if (controllers.size === 0) {
                eventListeners.delete(listener);

                if (eventListeners.size === 0) {
                    this.__revokers.delete(event);
                }
            }
        }
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        if (!this.__revokers.has(event)) {
            return false; // No listeners for this event
        }
        const customEvent = new CustomEvent(event, {
            detail: args,
            cancelable: true,
            bubbles: false
        });
        return this.dispatchEvent(customEvent);
    }

    once(event: string, listener: (...args: any[]) => void): this {
        const wrapped = function (this: EventEmitter, ...args: any[]) {
            listener.apply(this, args);
            this.removeListener(event, wrapped);
        };

        this.on(event, wrapped);

        return this;
    }

    removeAllListeners(event?: string): this {
        if (event !== undefined) {
            const eventListeners = this.__revokers.get(event);
            if (eventListeners) {
                for (const controllers of eventListeners.values()) {
                    for (const controller of controllers) {
                        controller.abort();
                    }
                }
                this.__revokers.delete(event);
            }
            return this;
        }

        for (const eventListeners of this.__revokers.values()) {
            for (const controllers of eventListeners.values()) {
                for (const controller of controllers) {
                    controller.abort();
                }
            }
        }
        this.__revokers.clear();

        return this;
    }

    listenerCount(event: string): number {
        const eventListeners = this.__revokers.get(event);
        if (!eventListeners) return 0;

        let count = 0;
        for (const controllers of eventListeners.values()) {
            count += controllers.size;
        }
        return count;
    }
}

export function mixinEventEmitter<T extends typeof EventTarget>(Base: T): T & { new(...args: ConstructorParameters<T>): EventEmitter } {
    // @ts-ignore
    const cls = class extends Base {
        private __revokers = new Map<string, Map<Function, Set<AbortController>>>();

        on(event: string, listener: (...args: any[]) => void): this {
            return this.addListener(event, listener);
        }

        addListener(event: string, listener: (...args: any[]) => void): this {
            const controller = new AbortController();
            const expectedTgt = this;
            const wrapper: EventListener = function (this: EventEmitter, e) {
                if (e.target !== expectedTgt) {
                    return;
                }
                const customEvent = e as CustomEvent;
                listener.call(this, ...(customEvent.detail || []));
            };

            if (!this.__revokers.has(event)) {
                this.__revokers.set(event, new Map());
            }

            const eventListeners = this.__revokers.get(event)!;
            if (!eventListeners.has(listener)) {
                eventListeners.set(listener, new Set());
            }

            eventListeners.get(listener)!.add(controller);
            this.addEventListener(event, wrapper, { signal: controller.signal });
            return this;
        }

        off(event: string, listener: (...args: any[]) => void): this {
            return this.removeListener(event, listener);
        }

        removeListener(event: string, listener: (...args: any[]) => void): this {
            const eventListeners = this.__revokers.get(event);

            if (eventListeners?.has(listener)) {
                const controllers = eventListeners.get(listener)!;

                // Remove one controller (first one from the set)
                const controller = controllers.values().next().value;
                if (controller) {
                    controller.abort();
                    controllers.delete(controller);
                }

                if (controllers.size === 0) {
                    eventListeners.delete(listener);

                    if (eventListeners.size === 0) {
                        this.__revokers.delete(event);
                    }
                }
            }
            return this;
        }

        emit(event: string, ...args: any[]): boolean {
            if (!this.__revokers.has(event)) {
                return false; // No listeners for this event
            }
            const customEvent = new CustomEvent(event, {
                detail: args,
                cancelable: true,
                bubbles: false
            });
            return this.dispatchEvent(customEvent);
        }

        once(event: string, listener: (...args: any[]) => void): this {
            const wrapped = function (this: EventEmitter, ...args: any[]) {
                listener.apply(this, args);
                this.removeListener(event, wrapped);
            };

            this.on(event, wrapped);

            return this;
        }

        removeAllListeners(event?: string): this {
            if (event !== undefined) {
                const eventListeners = this.__revokers.get(event);
                if (eventListeners) {
                    for (const controllers of eventListeners.values()) {
                        for (const controller of controllers) {
                            controller.abort();
                        }
                    }
                    this.__revokers.delete(event);
                }
                return this;
            }

            for (const eventListeners of this.__revokers.values()) {
                for (const controllers of eventListeners.values()) {
                    for (const controller of controllers) {
                        controller.abort();
                    }
                }
            }
            this.__revokers.clear();

            return this;
        }

        listenerCount(event: string): number {
            const eventListeners = this.__revokers.get(event);
            if (!eventListeners) return 0;

            let count = 0;
            for (const controllers of eventListeners.values()) {
                count += controllers.size;
            }
            return count;
        }
    } as T & { new(...args: any[]): EventEmitter };

    Object.defineProperty(cls, 'name', {
        value: `EventEmitting${Base.name}`,
        enumerable: false,
        configurable: true,
    });

    return cls;
}
