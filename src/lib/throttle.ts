let i = 1;

const wm = new WeakMap<any, WeakMap<any, {
    lastRunAt: number;
    resultPromise?: Promise<any>;
}>>();

export function throttle(waitMs: number = 1000) {
    return function throttleDecorator(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {
        const throttleSymbol = Symbol(`THROTTLE:${i++}`);
        const func: Function = propDesc.value;

        if (typeof func !== 'function') {
            throw new Error('Invalid use of throttle decorator');
        }

        function newFunc(this: any, ...argv: any[]) {
            let wm2 = wm.get(this);
            if (!wm2) {
                wm2 = new WeakMap<any, any>();
                wm.set(this, wm2);
            }
            let conf = wm2.get(throttleSymbol);
            if (!conf) {
                conf = {
                    lastRunAt: 0,
                    resultPromise: undefined,
                };
                wm2.set(throttleSymbol, conf);
            }

            if ((conf.lastRunAt + waitMs) >= Date.now()) {
                return conf.resultPromise;
            }
            conf.lastRunAt = Date.now();
            conf.resultPromise = new Promise((resolve, reject) => {
                try {
                    const r = func.apply(this, argv);
                    resolve(r);

                    return r;
                } catch (err) {
                    reject(err);
                }
            });

            return conf.resultPromise;
        }

        Object.defineProperty(newFunc, 'name',
            { value: `throttleDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
        );

        propDesc.value = newFunc;

        return propDesc;
    };
}
