import { isPrimitiveLike } from "./lang";
import { EventEmitter } from "./event-emitter";

function isObject(obj: any) {
    if ((typeof obj) === 'object' && obj !== null) {
        return true;
    }
    if ((typeof obj) === 'function') {
        return true;
    }

    return false;
}

const globalProxyRevMap = new WeakMap<any, any>();

export function unwrap<T extends object>(thing: T): T {
    if (globalProxyRevMap.has(thing as any)) {
        return globalProxyRevMap.get(thing as any);
    }

    return thing;
}

export class ReactiveKit<T extends object = any> extends EventEmitter {
    proxy!: T;
    target: T;
    protected handlers: ProxyHandler<any>;

    protected managedProxyMap = new WeakMap<any, any>();

    protected arrayOptimizationKit = this.getArrayOptimizationKit();
    protected foreignRevokers = new WeakMap<ReactiveKit<any>, AbortController>();

    constructor(target: T, handlers: ProxyHandler<T> = {}) {
        super();
        this.target = target;
        this.handlers = {
            ...handlers,
            get: (tgt, p, receiver) => {
                const val: any = Reflect.get(tgt, p, receiver);
                if (typeof p === 'string') {
                    this.emit('access', tgt, p, val);
                } else if (p === Symbol.iterator) {
                    this.emit('access', tgt, p, val);
                }

                const cached = this.managedProxyMap.get(val);
                if (cached) {
                    return cached;
                }

                if (Array.isArray(tgt) && (p in this.arrayOptimizationKit)) {
                    return this.arrayOptimizationKit[p as keyof typeof this.arrayOptimizationKit];
                }

                if (!isObject(val) || isPrimitiveLike(val)) {
                    return val;
                }

                if (typeof p === "symbol") {
                    return val;
                }

                return this.wrap(val);
            },

            set: (tgt, p, inputValue, receiver) => {
                let value = inputValue;
                const oldVal = Reflect.get(tgt, p, receiver);
                if (globalProxyRevMap.has(value)) {
                    value = globalProxyRevMap.get(value);
                }

                const r = Reflect.set(tgt, p, value, receiver);
                if (typeof p === 'string' && r) {
                    this.emit('assign', tgt, p, value, oldVal);
                    if (value !== oldVal) {
                        this.emit('change', tgt, p, value, oldVal);
                    }
                }

                return r;
            },
            deleteProperty: (tgt, p) => {
                const oldVal = Reflect.get(tgt, p);
                const r = Reflect.deleteProperty(tgt, p);
                if (r) {
                    this.emit('delete', tgt, p, oldVal);
                }

                return r;
            },
            defineProperty: (tgt, p, desc) => {
                const oldVal = Reflect.get(tgt, p);
                if (desc.value && globalProxyRevMap.has(desc.value)) {
                    desc.value = globalProxyRevMap.get(desc.value);
                }
                const r = Reflect.defineProperty(tgt, p, desc);
                if (r) {
                    this.emit('define', tgt, p, desc, oldVal);
                }

                return r;
            }
        };

        if (handlers.get) {
            const origHandler = handlers.get;
            this.handlers.get = (tgt, p, receiver) => {
                const val = origHandler.call(handlers, tgt, p, receiver);

                if (typeof p === 'string') {
                    this.emit('access', tgt, p, val);
                } else if (p === Symbol.iterator) {
                    this.emit('access', tgt, p, val);
                }

                const cached = this.managedProxyMap.get(val);
                if (cached) {
                    return cached;
                }

                if (Array.isArray(tgt) && (p in this.arrayOptimizationKit)) {
                    return this.arrayOptimizationKit[p as keyof typeof this.arrayOptimizationKit];
                }

                if (!isObject(val) || isPrimitiveLike(val)) {
                    return val;
                }

                if (typeof p === "symbol") {
                    return val;
                }

                return this.wrap(val);
            };
        }
        if (handlers.set) {
            const origHandler = handlers.set;
            this.handlers.set = (tgt, p, inputValue, receiver) => {
                const oldVal = Reflect.get(tgt, p, receiver);
                let value = inputValue;
                if (globalProxyRevMap.has(value)) {
                    value = globalProxyRevMap.get(value);
                }

                const r = origHandler.call(handlers, tgt, p, value, receiver);
                if (typeof p === 'string' && r) {
                    this.emit('assign', tgt, p, value, oldVal);
                    if (value !== oldVal) {
                        this.emit('change', tgt, p, value, oldVal);
                    }
                }

                return r;
            };
        }
        if (handlers.deleteProperty) {
            const origHandler = handlers.deleteProperty;
            this.handlers.deleteProperty = (tgt, p) => {
                const oldVal = Reflect.get(tgt, p);
                const r = origHandler.call(handlers, tgt, p);
                if (r) {
                    this.emit('delete', tgt, p, oldVal);
                }

                return r;
            };
        }
        if (handlers.defineProperty) {
            const origHandler = handlers.defineProperty;
            this.handlers.defineProperty = (tgt, p, desc) => {
                const oldVal = Reflect.get(tgt, p);
                if (desc.value && globalProxyRevMap.has(desc.value)) {
                    desc.value = globalProxyRevMap.get(desc.value);
                }
                const r = origHandler.call(handlers, tgt, p, desc);
                if (r) {
                    this.emit('define', tgt, p, desc, oldVal);
                }

                return r;
            };
        }

        this.proxy = new Proxy(target, this.handlers);
        globalProxyRevMap.set(this.proxy, target);
        this.managedProxyMap.set(target, this.proxy);
    }

    wrap<W extends object>(tgt: W): W {
        if (!tgt) {
            return tgt;
        }
        if (!isObject(tgt)) {
            throw new TypeError('This target is not wrap-able');
        }

        if (this.managedProxyMap.has(tgt)) {
            const proxy = this.managedProxyMap.get(tgt);
            globalProxyRevMap.set(proxy, tgt);
            return proxy;
        }

        const proxy = new Proxy(tgt, this.handlers);
        globalProxyRevMap.set(proxy, tgt);
        this.managedProxyMap.set(tgt, proxy);

        return proxy;
    }

    getArrayOptimizationKit() {
        const methodsToPatch = ['pop', 'push', 'shift', 'unshift', 'splice', 'reverse', 'sort'] as const;

        const mangle = <T extends typeof methodsToPatch[number]>(method: T) => {
            const original: Function = Array.prototype[method];
            const rk = this;
            const mangled = function (this: Array<any>, ...args: Parameters<unknown[][T]>): ReturnType<unknown[][T]> {
                const origVal = globalProxyRevMap.get(this) || this;
                const length1 = origVal.length;
                const result = original.apply(origVal, args);
                const length2 = origVal.length;
                rk.emit('array-op', origVal, method, ...args);
                if (length1 !== length2) {
                    rk.emit('assign', origVal, 'length', length2, length1);
                    rk.emit('change', origVal, 'length', length2, length1);
                }

                return result;
            }

            Object.defineProperty(mangled, 'name', {
                value: method,
                writable: false,
                enumerable: false,
                configurable: true
            });

            return mangled;
        }

        const arrayOptimizationKit: any = {};
        for (const method of methodsToPatch) {
            arrayOptimizationKit[method] = mangle(method);
        }

        return arrayOptimizationKit as {
            [K in typeof methodsToPatch[number]]: (...args: Parameters<unknown[][K]>) => ReturnType<unknown[][K]>;
        };
    }

    connect<P extends object>(foreign: ReactiveKit<P>) {
        if (!foreign || !(foreign instanceof ReactiveKit)) {
            throw new TypeError('Invalid ReactiveKit instance provided');
        }

        if (this.foreignRevokers.has(foreign)) {
            return this.foreignRevokers.get(foreign)!;
        }
        const abortCtl = new AbortController();
        this.foreignRevokers.set(foreign, abortCtl);
        for (const event of ['access', 'assign', 'change', 'delete', 'define', 'array-op']) {
            foreign.addEventListener(event, (e) => {
                this.emit(event, ...(e as CustomEvent).detail);
            }, { signal: abortCtl.signal });
        }

        return abortCtl;
    }

    disconnect<P extends object>(foreign: ReactiveKit<P>) {
        const abortCtl = this.foreignRevokers.get(foreign);
        if (abortCtl) {
            this.foreignRevokers.delete(foreign);
            abortCtl.abort();
        }
    }
}
