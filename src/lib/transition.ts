
import { attachedEventName, detachEventName } from "../protocol";

export interface TransitionConfig {
    duration: number; // Transition duration in milliseconds
    transition?: string; // Optional CSS transition property, e.g., 'all'
    easing?: string;   // CSS easing function, e.g., 'ease-out'
    from: Partial<CSSStyleDeclaration>; // Initial styles
    to: Partial<CSSStyleDeclaration>;   // Final styles for enter transition
    leaveTo?: Partial<CSSStyleDeclaration>;   // Final styles for leave transition
    signal?: AbortSignal; // Optional signal to abort the transition
}

export function createTransition(element: HTMLElement, config: TransitionConfig) {
    const { transition = 'all', duration, easing, from, to, leaveTo = from, signal } = config;
    const transitionValue = `${transition} ${duration}ms${easing ? ` ${easing}` : ''}`;

    const onAttach = () => {
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
            element.style.transition = backup.transition ? `${backup.transition}, ${transitionValue}` : transitionValue;
            Object.assign(element.style, to);
        });

        element.addEventListener('transitionend', () => {
            Object.assign(element.style, backup);
        }, { once: true });
    };

    // --- Leave Transition ---
    const onDetach = (event: Event) => {
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
            element.style.transition = backup.transition ? `${backup.transition}, ${transitionValue}` : transitionValue;
            Object.assign(element.style, leaveTo);
        });

        element.addEventListener('transitionend', () => {
            Object.assign(element.style, backup);
            element.remove();
        }, { once: true });
    };

    element.addEventListener(attachedEventName, onAttach, { signal });
    element.addEventListener(detachEventName, onDetach, { signal });
}
