import { Reactive, REACTIVE_KIT, ReactivityHost, ReactivityOpts } from "./reactive";

const finalizationRegistry = new FinalizationRegistry((mutationObserver: MutationObserver) => {
    mutationObserver.disconnect();
});

export interface AttrMixin {
    element: Element;
}

export function Attr(overrideName?: string) {
    return function (target: AttrMixin, key: string | symbol, _descriptor?: PropertyDescriptor) {
        if (typeof target === 'function') {
            throw new TypeError("Attr decorator is intended for class properties or methods, not for classes themselves.");
        }

        if (!overrideName && typeof key !== 'string') {
            return;
        }

        const attrName = (overrideName || key) as string;

        Object.defineProperty(target, key, {
            configurable: true,
            enumerable: true,
            writable: true,
            get(this: AttrMixin) {
                return this.element.getAttribute(attrName);
            },
            set(this: AttrMixin, value) {
                return this.element.setAttribute(attrName, value);
            }
        });
    };
}

export const REACTIVE_ATTR_OBSERVER = Symbol('REACTIVE_ATTR_OBSERVER');
export const REACTIVE_ATTR_MAPPING = Symbol('REACTIVE_ATTR_MAPPING');
export interface ReactiveAttrMixin extends AttrMixin {
    [REACTIVE_ATTR_OBSERVER]: MutationObserver;
    [REACTIVE_ATTR_MAPPING]: Record<string, Set<string>>;
}

export function ReactiveAttr<T extends ReactivityHost>(overrideName?: string | ReactivityOpts<T>): (target: T, key: string, _descriptor?: PropertyDescriptor) => void;
export function ReactiveAttr<T extends ReactivityHost>(overrideName: string, config?: ReactivityOpts<T>): (target: T, key: string, _descriptor?: PropertyDescriptor) => void;
export function ReactiveAttr<T extends ReactivityHost>() {
    const [arg1, arg2] = arguments;
    let overrideName: string | undefined;
    let config: ReactivityOpts<T> | undefined;
    if (typeof arg1 === 'string') {
        overrideName = arg1;
        config = arg2;
    } else if (typeof arg1 === 'object') {
        config = arg1;
    }
    return function (target: T & ReactiveAttrMixin, key: string, _descriptor?: PropertyDescriptor) {
        const attrName = (overrideName || key) as string;

        if (typeof target === 'function') {
            throw new TypeError("ReactiveAttr decorator is intended for class properties or methods, not for classes themselves.");
        }
        if (!target.hasOwnProperty(REACTIVE_ATTR_MAPPING)) {
            target[REACTIVE_ATTR_MAPPING] = Object.create(target[REACTIVE_ATTR_MAPPING] || null);
        }

        if (!target[REACTIVE_ATTR_MAPPING].hasOwnProperty(attrName)) {
            target[REACTIVE_ATTR_MAPPING][attrName] = new Set<string>(...(target[REACTIVE_ATTR_MAPPING][attrName] || []));
        }
        target[REACTIVE_ATTR_MAPPING][attrName].add(key as string);

        Reactive({
            ...config,
            initializers: [
                ...(config?.initializers || []),
                function (this: T & ReactiveAttrMixin & { [REACTIVE_ATTR_OBSERVER]?: MutationObserver }) {
                    if (!this.hasOwnProperty(REACTIVE_ATTR_OBSERVER)) {
                        this[REACTIVE_ATTR_OBSERVER] = new MutationObserver((mutations) => {
                            for (const x of mutations) {
                                if (x.type === 'attributes') {
                                    const attrName = x.attributeName;
                                    if (attrName && this[REACTIVE_ATTR_MAPPING][attrName]) {
                                        const v = this.element.getAttribute(attrName);
                                        for (const key of this[REACTIVE_ATTR_MAPPING][attrName]) {
                                            if (this.hasOwnProperty(key)) {
                                                Reflect.set(this[REACTIVE_KIT], key, v);
                                            }
                                        }
                                    }
                                }
                            }
                        });
                        this[REACTIVE_ATTR_OBSERVER].observe(this.element, {
                            subtree: false,
                            attributes: true,
                            attributeFilter: Object.keys(this[REACTIVE_ATTR_MAPPING]),
                            attributeOldValue: true
                        });
                        finalizationRegistry.register(this, this[REACTIVE_ATTR_OBSERVER], this);
                    }
                }
            ]
        })(target, key, _descriptor);
        Attr(overrideName)(target, key, _descriptor);
    };
}

