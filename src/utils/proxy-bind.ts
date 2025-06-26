export function proxyBind<T extends object>(target: T, thisArg?: unknown) {

    const handler: ProxyHandler<T> = {
        get: (tgt, prop, recv) => {
            const value = Reflect.get(tgt, prop, recv);
            if (typeof value === 'function') {
                return value.bind(thisArg || tgt);
            }
            return value;
        }
    };

    return new Proxy(target, handler);
}
