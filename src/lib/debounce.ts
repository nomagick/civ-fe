import { Defer, Deferred } from './defer';

let i = 1;

const wm = new WeakMap<any, WeakMap<any, DebounceConf>>();

interface DebounceConf {
    initAt?: number;
    timer?: ReturnType<typeof setTimeout>;
    deferred?: Deferred<any>;
}

function resetTimer(this: unknown, conf: DebounceConf, func: Function, argv: unknown[], waitMs: number) {
    if (conf.timer) {
        clearTimeout(conf.timer);
    }
    conf.timer = setTimeout(() => {
        conf.initAt = undefined;
        conf.timer = undefined;
        if (!conf.deferred) {
            return;
        }
        const deferred = conf.deferred!;
        conf.deferred = undefined;
        try {
            const r = func.apply(this, argv);
            deferred.resolve(r);

            return r;
        } catch (err) {
            deferred.reject(err);
        }
    }, waitMs);
}

export function debounce(waitMs: number = 1000, maxWait: number = Infinity) {
    return function debounceDecorator(_target: unknown, _propName: string | symbol, propDesc: PropertyDescriptor) {
        const debounceSymbol = Symbol(`DEBOUNCE:${i++}`);
        const func: Function = propDesc.value;

        if (typeof func !== 'function') {
            throw new Error('Invalid use of debounce decorator');
        }

        function newFunc(this: unknown, ...argv: unknown[]) {
            let wm2 = wm.get(this);
            if (!wm2) {
                wm2 = new WeakMap<any, any>();
                wm.set(this, wm2);
            }
            let conf = wm2.get(debounceSymbol);
            if (!conf) {
                conf = {
                    initAt: undefined,
                    timer: undefined,
                    deferred: undefined,
                } as DebounceConf;
                wm2.set(debounceSymbol, conf);
            }

            if (conf.timer && conf.deferred && conf.initAt && (Date.now() - conf.initAt <= maxWait)) {
                resetTimer.call(this, conf, func, argv, waitMs);

                return conf.deferred.promise;
            }

            conf.deferred = Defer();
            conf.initAt = Date.now();
            resetTimer.call(this, conf, func, argv, waitMs);

            return conf.deferred.promise;
        }

        Object.defineProperty(newFunc, 'name',
            { value: `debounceDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
        );

        propDesc.value = newFunc;

        return propDesc;
    };
}
