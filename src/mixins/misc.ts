export function getEventTarget<T extends Node>(ev: Event): T {
    if (ev.composed) {
        const path = ev.composedPath();
        if (path.length > 0) {
            return path[0] as T;
        }
        return ev.target as T;
    }
    return ev.target as T;
}
