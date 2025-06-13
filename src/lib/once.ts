let i = 1;

const wm = new WeakMap<any, WeakMap<any, any>>();

export function runOncePerInstance(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {
    const runOnceSymbol = Symbol(`RUN_ONCE:${i++}`);
    const func: Function = propDesc.value;

    if (typeof func !== 'function') {
        throw new Error('Invalid use of runOnce decorator');
    }
    function newFunc(this: any, ...argv: any[]) {
        let wm2 = wm.get(this);
        if (!wm2) {
            wm2 = new WeakMap<any>();
            wm.set(this, wm2);
        }
        const conf = wm2.get(runOnceSymbol);
        if (conf) {
            if (conf.hasOwnProperty('thrown')) {
                throw conf.thrown;
            }

            return conf.result;
        }

        const conf2: any = {};
        wm2.set(runOnceSymbol, conf2);

        try {
            conf2.result = func.apply(this, argv);

            return conf2.result;
        } catch (err) {
            conf2.thrown = err;
            throw err;
        }
    }

    propDesc.value = newFunc;

    Object.defineProperty(newFunc, 'name',
        { value: `runOncePerInstanceDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
    );

    return propDesc;
};


export function runOncePerClass(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {
    const runOnceSymbol = Symbol(`RUN_ONCE:${i++}`);
    const func: Function = propDesc.value;

    if (typeof func !== 'function') {
        throw new Error('Invalid use of runOnce decorator');
    }
    function newFunc(this: any, ...argv: any[]) {
        let wm2 = wm.get(this.constructor);
        if (!wm2) {
            wm2 = new WeakMap<any>();
            wm.set(this.constructor, wm2);
        }
        const conf = wm2.get(runOnceSymbol);
        if (conf) {
            if (conf.hasOwnProperty('thrown')) {
                throw conf.thrown;
            }

            return conf.result;
        }

        const conf2: any = {};
        wm2.set(runOnceSymbol, conf2);

        try {
            conf2.result = func.apply(this, argv);

            return conf2.result;
        } catch (err) {
            conf2.thrown = err;
            throw err;
        }
    }

    propDesc.value = newFunc;

    Object.defineProperty(newFunc, 'name',
        { value: `runOncePerClassDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
    );

    return propDesc;
};

