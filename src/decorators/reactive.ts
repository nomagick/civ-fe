import { ReactiveKit } from "../lib/reactive-kit";

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
        thisConfig.initializers.unshift(
            function () {
                this[REACTIVE_KIT] ??= new ReactiveKit(this);
                if (this.hasOwnProperty(key)) {
                    Reflect.set(this[REACTIVE_KIT], key, Reflect.get(this, key));
                }
            }
        );

        Reflect.set(target[REACTIVE_CFG], key, thisConfig);

        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            get() {
                return Reflect.get(this[REACTIVE_KIT], key);
            },
            set(value) {
                return Reflect.set(this[REACTIVE_KIT], key, value);
            }
        });
    };
}

export function activateReactivity<T extends ReactivityHost>(target: T) {
    if (!target.hasOwnProperty(REACTIVE_KIT)) {
        target[REACTIVE_KIT] = new ReactiveKit(target);
    }

    if (!target.hasOwnProperty(REACTIVE_CFG)) {
        target[REACTIVE_CFG] = Object.create(target[REACTIVE_CFG] || null);
    }

    for (const key of Object.keys(target[REACTIVE_CFG])) {
        const config = target[REACTIVE_CFG][key];
        if (config.initializers) {
            for (const initializer of config.initializers) {
                initializer.call(target);
            }
        }
    }
}
