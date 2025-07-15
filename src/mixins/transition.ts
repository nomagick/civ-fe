
import { setImmediate } from "lib/lang";
import { attachedEventName, detachEventName } from "../protocol";

export interface TransitionConfig {
    transition?: string | string[]; // Optional CSS transition property, e.g., 'all'
    from: Partial<CSSStyleDeclaration>; // Initial styles
    to: Partial<CSSStyleDeclaration>;   // Final styles for enter transition
    leaveTo?: Partial<CSSStyleDeclaration>;   // Final styles for leave transition
    signal?: AbortSignal; // Optional signal to abort the transition
}
let serial = 1;

const finalizationRegistry = new FinalizationRegistry((styleSheet: CSSStyleSheet) => {
    const index = document.adoptedStyleSheets.indexOf(styleSheet);
    if (index !== -1) {
        document.adoptedStyleSheets.splice(index, 1);
    }
});

export function createTransition(element: HTMLElement, config: TransitionConfig) {
    const { transition = 'all 0.3s', from, to, leaveTo = from, signal } = config;
    const transitionValue = Array.isArray(transition) ? transition.join(', ') : transition;
    const thisSerial = serial++;
    const fromClass = `__transition-from-${thisSerial.toString(16)}`;
    const toClass = `__transition-to-${thisSerial.toString(16)}`;
    const leaveToClass = `__transition-leave-to-${thisSerial.toString(16)}`;
    const inTransitionClass = `__transition-${thisSerial.toString(16)}`;
    const cssSource = `
.${fromClass} {
${Object.entries(from).filter(([, value]) => Boolean(value)).map(([key, value]) => `  ${key}: ${value};`).join('\n')}
}
.${toClass} {
${Object.entries(to).filter(([, value]) => Boolean(value)).map(([key, value]) => `  ${key}: ${value};`).join('\n')}
}
.${leaveToClass} {
${Object.entries(leaveTo).filter(([, value]) => Boolean(value)).map(([key, value]) => `  ${key}: ${value};`).join('\n')}
}
.${inTransitionClass} {
  transition: ${transitionValue};
}
`;
    const styleSheet = new CSSStyleSheet();
    styleSheet.replaceSync(cssSource);
    document.adoptedStyleSheets.push(styleSheet);
    finalizationRegistry.register(element, styleSheet, signal);

    // --- Leave Transition ---
    const onDetach = (event: Event) => {
        if (event.target !== element) {
            return;
        }
        event.preventDefault();

        element.classList.add(toClass);
        element.classList.add(inTransitionClass);
        requestAnimationFrame(() => {
            element.classList.add(leaveToClass);
            element.addEventListener('transitionend', () => {
                element.classList.remove(inTransitionClass, toClass, leaveToClass, fromClass);
                element.remove();
            }, { once: true });
        });

    };

    const onAttach = (event: Event) => {
        if (event.target !== element) {
            return;
        }

        element.classList.add(fromClass);
        element.classList.add(inTransitionClass);
        requestAnimationFrame(() => {
            element.classList.add(toClass);
            element.classList.remove(fromClass);
            element.addEventListener('transitionend', () => {
                element.classList.remove(inTransitionClass);
            }, { once: true });
        });
    };

    element.addEventListener(attachedEventName, onAttach, { signal });
    setImmediate(() => {
        element.addEventListener(detachEventName, onDetach, { signal });
    });
}
