
import { setImmediate } from "lib/lang";
import { attachedEventName, detachEventName } from "../protocol";

export interface TransitionConfig {
    transition?: string | string[]; // Optional CSS transition property, e.g., 'all'
    from: Partial<CSSStyleDeclaration>; // Initial styles
    to: Partial<CSSStyleDeclaration>;   // Final styles for enter transition
    leaveTo?: Partial<CSSStyleDeclaration>;   // Final styles for leave transition
    signal?: AbortSignal; // Optional signal to abort the transition
}

export function createTransition(element: HTMLElement, config: TransitionConfig) {
    const { transition = 'all 0.3s', from, to, leaveTo = from, signal } = config;
    const transitionValue = Array.isArray(transition) ? transition.join(', ') : transition;

    // --- Leave Transition ---
    const onDetach = (event: Event) => {
        if (event.target !== element) {
            return;
        }
        event.preventDefault();
        const backup: Partial<CSSStyleDeclaration> = {
            transition: element.style.transition,
        };
        for (const key in to) {
            backup[key] = element.style[key];
        }
        for (const key in leaveTo) {
            backup[key] = element.style[key];
        }

        Object.assign(element.style, to);
        requestAnimationFrame(() => {
            Object.assign(element.style, leaveTo);
            element.style.transition = backup.transition ? `${backup.transition}, ${transitionValue}` : transitionValue;
        });

        element.addEventListener('transitionend', () => {
            Object.assign(element.style, backup);
            element.remove();
        }, { once: true });
    };

    const onAttach = (event: Event) => {
        if (event.target !== element) {
            return;
        }
        const backup: Partial<CSSStyleDeclaration> = {
            transition: element.style.transition,
        };
        for (const key in from) {
            backup[key] = element.style[key];
        }
        for (const key in to) {
            backup[key] = element.style[key];
        }
        Object.assign(element.style, from);

        requestAnimationFrame(() => {
            Object.assign(element.style, to);
            element.style.transition = backup.transition ? `${backup.transition}, ${transitionValue}` : transitionValue;
        });

        element.addEventListener('transitionend', () => {
            Object.assign(element.style, backup);
        }, { once: true });
    };
    element.addEventListener(attachedEventName, onAttach, { signal });
    setImmediate(() => {
        element.addEventListener(detachEventName, onDetach, { signal });
    });
}
