import { setImmediate } from "./lang";

let j = 1;

const tickFunction = setImmediate || setTimeout;

const wm = new WeakMap<any, WeakMap<any, boolean>>();

export function perNextTick(_target: any, _propName: string | symbol, propDesc: PropertyDescriptor) {
    const perNextTickSymbol = Symbol(`PER_NEXT_TICK:${j++}`);
    const func: Function = propDesc.value;

    if (typeof func !== 'function') {
        throw new Error('Invalid use of perNextTick decorator');
    }

    function newFunc(this: any, ...argv: any[]) {
        let wm2 = wm.get(this);
        if (!wm2) {
            wm2 = new WeakMap<any, any>();
            wm.set(this, wm2);
        }
        const v = wm2.get(perNextTickSymbol);
        if (v) {
            return;
        }
        wm2.set(perNextTickSymbol, true);

        tickFunction(() => {
            wm2.set(perNextTickSymbol, false);
            func.apply(this, argv);
        });
    }

    propDesc.value = newFunc;

    Object.defineProperty(newFunc, 'name',
        { value: `perNextTickDecorated${(func.name[0] || '').toUpperCase()}${func.name.slice(1)}`, writable: false, enumerable: false, configurable: true }
    );

    return propDesc;
}

