import { isPrimitiveLike } from "../lib/lang";
import { EventEmitter } from "./event-emitter";

function isObject(obj: any) {
    if ((typeof obj) === 'object' && obj !== null) {
        return true;
    }
    // if ((typeof obj) === 'function') {
    //     return true;
    // }

    return false;
}

export class ReactiveHost<T extends object> extends EventEmitter {
    proxy!: T;
    target: T;
    handlers: ProxyHandler<any>;

    managedProxyMap = new WeakMap<any, any>();
    managedProxyRevMap = new WeakMap<any, any>();

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

        const proxy = new Proxy(tgt, this.handlers);
        this.managedProxyMap.set(tgt, proxy);
        this.managedProxyRevMap.set(proxy, tgt);

        return proxy;
    }


}

export function nestedProxy<T extends object>(
    target: T = {} as any, handlers: ProxyHandler<T> = {}
) {
    const proxyMap = new WeakMap<object, any>();
    const modifiedHandlers: ProxyHandler<T> = {};

    function deproxy(obj: any): any {
        if (!isObject(obj)) {
            return obj;
        }
        const x = obj[deproxySymbol];
        if (x) {
            return deproxy(x);
        }

        return obj;
    }

    modifiedHandlers.get = (tgt: any, key, _receiver) => {
        const bareTgt = deproxy(tgt);
        if (handlers.get) {
            const result = handlers.get(bareTgt, key, _receiver);
            if (result !== undefined && result !== null) {
                return result;
            }
        }
        // if (key === 'WHOIAM') {
        //     return deproxySymbol.toString();
        // }
        if (key === deproxySymbol) {
            return bareTgt;
        }
        const orig = bareTgt[key];
        if (typeof key === 'symbol') {
            return orig;
        }
        if (isPrimitiveLike(orig)) {
            return orig;
        }

        const bareObj = deproxy(orig);
        const refProxy = proxyMap.get(bareObj);
        if (refProxy) {
            return refProxy;
        }

        if (isObject(bareObj) && (typeof key === 'string')) {
            const proxy = wrap(bareObj);

            return proxy;
        }

        return orig;
    };

    modifiedHandlers.set = (tgt: any, key, val, _receiver) => {
        const bareTgt = deproxy(tgt);
        const bareVal = deproxy(val);
        // console.log(tgt, key, val, route);
        if (handlers.set) {
            const result = handlers.set(bareTgt, key, bareVal, _receiver);
            if (result === false) {
                return result;
            }
            if (result === undefined) {
                if (typeof key === 'symbol') {
                    bareTgt[key] = val;

                    return true;
                }

                bareTgt[key] = val;
            }
        } else {
            bareTgt[key] = val;
        }


        // const orig = bareTgt[key];
        // if (isObject(bareVal) && (typeof key === 'string')) {
        //     if (orig === val) {
        //         return true;
        //     }

        //     if (orig === bareVal) {
        //         return true;
        //     }

        //     wrap(bareVal);

        //     return true;
        // }

        return true;
    };

    for (const x in handlers) {
        if (x !== 'get' && x !== 'set') {
            (modifiedHandlers as any)[x] = (handlers as any)[x];
        }
    }
    // let serial = 0;
    // const dedup = new Set();
    function wrap(obj: object) {
        const bareObj = deproxy(obj);
        // if (dedup.has(wrap)) {

        // }
        if (proxyMap.has(bareObj)) {
            return proxyMap.get(bareObj);
        }
        // const i = serial++;
        const x = { ...modifiedHandlers };
        // const origGet = x.get!;
        // x.get = (tgt: any, key, _receiver) => {
        //     if (key === 'WHOIAM') {
        //         return i;
        //     }

        //     return origGet(tgt, key, _receiver);
        // };
        const { proxy, revoke } = Proxy.revocable(bareObj, x);

        proxyMap.set(bareObj, proxy);
        revocations.add(revoke);

        // for (const key of Object.getOwnPropertyNames(bareObj)) {
        //     const val = (bareObj as any)[key];
        //     const bareVal = deproxy(val);
        //     if (isObject(bareVal)) {
        //         wrap(val);
        //     }
        // }

        return proxy;
    }


    const rootProxy = wrap(target);



    const revokeFunc = () => {
        for (const x of revocations) {
            x();
        }
    };

    return { proxy: rootProxy, revoke: revokeFunc, proxyMap };
}

export default nestedProxy;
