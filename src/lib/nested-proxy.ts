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
    handlers: ProxyHandler<T>;

    managedProxyMap = new WeakMap<any, any>();

    constructor(target: T, handlers: ProxyHandler<T> = {}) {
        super();
        this.target = target;
        this.handlers = {
            ...handlers,
            get: (tgt, p, receiver) => {
                const val: any = Reflect.get(tgt, p, receiver);

                const cached = this.managedProxyMap.get(val);
                if (cached) {
                    this.emit('access', tgt, p, val);
                    return cached;
                }

                if (!isObject(val) || isPrimitiveLike(val)) {
                    this.emit('access', tgt, p, val);
                    return val;
                }

                if (typeof p === "symbol") {
                    this.emit('access', tgt, p, val);
                    return val;
                }

                const wrapped = this.wrap(val);
                this.emit('access', tgt, p, val);

                return wrapped;
            },

            set: (tgt, p, value, receiver) => {
                const oldVal = Reflect.get(tgt, p, receiver);

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

                return this.wrap(tgt);
            };
        }

        this.proxy = new Proxy(target, this.handlers);
        this.managedProxyMap.set(target, this.proxy);
    }

    wrap<W extends object>(tgt: W): W {
        // TODO: keep track of attachment graph
        return tgt;
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
