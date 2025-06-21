import { REACTIVE_KIT, ReactivityHost } from "./reactive";
import { ReactiveKit } from "./reactive-kit";
import { wrapPerNextTick } from "./tick";

export function getReactiveStorage<T extends object = Record<string, any>>(
    storageKey: string,
    defaultValue?: T,
    storage: Storage = localStorage
): ReactivityHost & T {
    const data = storage.getItem(storageKey);

    const base = data ? JSON.parse(data) || defaultValue : defaultValue;

    const kit = new ReactiveKit(base);
    Reflect.set(base, REACTIVE_KIT, kit);

    kit.on('assign', wrapPerNextTick(
        () => {
            storage.setItem(storageKey, JSON.stringify(kit.target));
        }
    ));

    return kit.proxy;
}
