import { ReactiveKit } from "./reactive-kit";

export const REACTIVE_KIT = Symbol('REACTIVE_KIT');
export const REACTIVE_CFG = Symbol('REACTIVE_CFG');

export interface ReactivityHost {
    [REACTIVE_KIT]: ReactiveKit<this>;
    [REACTIVE_CFG]: Record<string, ReactivityOpts<this>>;
}

export interface ReactivityOpts<T extends ReactivityHost> {
    check?: 'once' | 'always';
    initializers?: ((this: T) => void)[];
}

export function Reactive<T extends ReactivityHost>(config?: ReactivityOpts<T>) {
    return function (target: T, key: string, _descriptor?: PropertyDescriptor) {
        if (typeof target === 'function') {
            throw new TypeError("Reactivity decorator is intended for class properties or methods, not for classes themselves.");
        }
        if (!target.hasOwnProperty(REACTIVE_CFG)) {
            target[REACTIVE_CFG] = Object.create(target[REACTIVE_CFG] || null);
        }
        const thisConfig = config || {};

        thisConfig.initializers ??= [];
        // TODO: this is only needed for TC39 decorators + class property
        // thisConfig.initializers.unshift(
        //     function () {
        //         this[REACTIVE_KIT] ??= new ReactiveKit({} as any);
        //         if (this.hasOwnProperty(key)) {
        //             Reflect.set(this[REACTIVE_KIT].proxy, key, Reflect.get(this, key));
        //         }
        //     }
        // );

        Reflect.set(target[REACTIVE_CFG], key, thisConfig);

        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            get() {
                return Reflect.get(this[REACTIVE_KIT].proxy, key);
            },
            set(value) {
                return Reflect.set(this[REACTIVE_KIT].proxy, key, value);
            }
        });
    };
}

export function initReactivity(this: ReactivityHost) {
    if (!this.hasOwnProperty(REACTIVE_KIT)) {
        this[REACTIVE_KIT] = new ReactiveKit({} as any);
    }

    if (!this.hasOwnProperty(REACTIVE_CFG)) {
        this[REACTIVE_CFG] = Object.create(this[REACTIVE_CFG] || null);
    }
}

export function activateReactivity(this: ReactivityHost) {
    for (const key of Object.keys(this[REACTIVE_CFG])) {
        const config = this[REACTIVE_CFG][key];
        if (config.initializers) {
            for (const initializer of config.initializers) {
                initializer.call(this);
            }
        }
    }
}
