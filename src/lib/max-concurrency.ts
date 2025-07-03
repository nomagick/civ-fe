let i = 1;

const wm = new WeakMap<any, WeakMap<any, { s: number, lastPromise?: Promise<any> }>>();

export function maxConcurrency(cap: number = 1) {
    return function maxConcurrencyDecorator(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {
        const maxConcurrencySymbol = Symbol(`MAXCONCURRENCY:${i++}`);

        const func: Function = propDesc.value;

        if (typeof func !== 'function') {
            throw new Error('Invalid use of maxConcurrency decorator');
        }

        function newFunc(this: unknown, ...argv: unknown[]) {
            let wm2 = wm.get(this);
            if (!wm2) {
                wm2 = new WeakMap<any, any>();
                wm.set(this, wm2);
            }
            let conf = wm2.get(maxConcurrencySymbol);
            if (!conf) {
                conf = {
                    s: 0,
                    lastPromise: undefined,
                };
                wm2.set(maxConcurrencySymbol, conf);
            }
            if (conf.s >= cap) {
                return conf.lastPromise;
            }
            conf.s += 1;

            try {
                const r = func.apply(this, argv);
                if (r.then && typeof r.then === 'function') {
                    r.then(
                        () => (conf.s -= 1),
                        () => (conf.s -= 1)
                    );
                    conf.lastPromise = r;
                } else {
                    conf.s -= 1;
                }

                return r;
            } catch (err) {
                conf.s -= 1;
                throw err;
            }
        }

        Object.defineProperty(newFunc, 'name',
            { value: `maxConcurrencyDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
        );

        propDesc.value = newFunc;

        return propDesc;
    };
}
