import { REACTIVE_KIT, ReactivityHost } from "./reactive";
import { ReactiveKit } from "./reactive-kit";
import { wrapPerNextTick } from "./tick";

export function getReactiveStorage<T extends object = Record<string, any>>(
    storageKey: string,
    defaultValue?: T,
    storage: Storage = localStorage,
    sync = true,
): ReactivityHost & T {
    const data = storage.getItem(storageKey);

    const base = data ? JSON.parse(data) || defaultValue : defaultValue;

    const kit = new ReactiveKit(base);
    Reflect.set(base, REACTIVE_KIT, kit);
    let suspended = false;
    const handler = wrapPerNextTick(
        () => {
            if (suspended) {
                suspended = false;
                return;
            }
            storage.setItem(storageKey, JSON.stringify(kit.target));
        }
    );

    const proxy = kit.proxy;

    if (sync) {
        window.addEventListener('storage', (event) => {
            if (event.storageArea !== storage) return;
            if (event.key === storageKey) {
                const newValue = event.newValue ? JSON.parse(event.newValue) : defaultValue;
                for (const k in kit.target) {
                    if (!(k in newValue)) {
                        delete proxy[k];
                    }
                }
                Object.assign(proxy, newValue);
                if (Array.isArray(proxy)) {
                    proxy.length = newValue.length;
                }
                suspended = true;
            }
        });
    }

    kit.on('change', handler);
    kit.on('array-op', handler);

    return proxy;
}
