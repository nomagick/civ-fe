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

export class ReactiveKit<T extends object = any> extends EventEmitter {
    proxy!: T;
    target: T;
    protected handlers: ProxyHandler<any>;

    protected managedProxyMap = new WeakMap<any, any>();
    protected managedProxyRevMap = new WeakMap<any, any>();

    constructor(target: T, handlers: ProxyHandler<T> = {}) {
        super();
        this.target = target;
        this.handlers = {
            ...handlers,
            get: (tgt, p, receiver) => {
                const val: any = Reflect.get(tgt, p, receiver);
                this.emit('access', tgt, p, val);

                const cached = this.managedProxyMap.get(val);
                if (cached) {
                    return cached;
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
                if (this.managedProxyRevMap.has(value)) {
                    value = this.managedProxyRevMap.get(value);
                }

                const r = Reflect.set(tgt, p, value, receiver);
                if (typeof p === 'string' && r) {
                    this.emit('assign', tgt, p, value, oldVal);
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
                if (desc.value && this.managedProxyRevMap.has(desc.value)) {
                    desc.value = this.managedProxyRevMap.get(desc.value);
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

                this.emit('access', tgt, p, val);

                const cached = this.managedProxyMap.get(val);
                if (cached) {
                    return cached;
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
                if (this.managedProxyRevMap.has(value)) {
                    value = this.managedProxyRevMap.get(value);
                }

                const r = origHandler.call(handlers, tgt, p, value, receiver);
                if (typeof p === 'string' && r) {
                    this.emit('assign', tgt, p, value, oldVal);
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
                if (desc.value && this.managedProxyRevMap.has(desc.value)) {
                    desc.value = this.managedProxyRevMap.get(desc.value);
                }
                const r = origHandler.call(handlers, tgt, p, desc);
                if (r) {
                    this.emit('define', tgt, p, desc, oldVal);
                }

                return r;
            };
        }

        this.proxy = new Proxy(target, this.handlers);
        this.managedProxyMap.set(target, this.proxy);
        this.managedProxyRevMap.set(this.proxy, target);
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
            this.managedProxyRevMap.set(proxy, tgt);
            return proxy;
        }

        const proxy = new Proxy(tgt, this.handlers);
        this.managedProxyMap.set(tgt, proxy);
        this.managedProxyRevMap.set(proxy, tgt);

        return proxy;
    }


}
