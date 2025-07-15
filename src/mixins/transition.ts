
import { setImmediate } from "../lib/lang";
import { attachedEventName, detachEventName } from "../protocol";

export interface TransitionConfig {
    transition?: string;
    enterFrom?: string;
    enterTo?: string;
    leaveFrom?: string;
    leaveTo?: string;
    signal?: AbortSignal;
}

export function createTransition(element: HTMLElement, config: TransitionConfig = {}) {
    const {
        transition = 'in-transition',
        enterFrom = 'enter-from',
        enterTo,
        leaveFrom = enterTo,
        leaveTo = enterFrom,
        signal
    } = config;

    // --- Leave Transition ---
    const onDetach = (event: Event) => {
        if (event.target !== element) {
            return;
        }
        event.preventDefault();

        if (leaveFrom) {
            element.classList.add(leaveFrom);
        }
        requestAnimationFrame(() => {
            if (transition) {
                element.classList.add(transition);
            }
            if (leaveFrom) {
                element.classList.remove(leaveFrom);
            }
            element.classList.add(leaveTo);

            const cctrl = new AbortController();
            let timeout: ReturnType<typeof setTimeout> | null = null;
            const hdl = () => {
                element.classList.remove(leaveTo);
                if (transition) {
                    element.classList.remove(transition);
                }
                
                if (element.classList.length === 0) {
                    element.removeAttribute('class');
                }
                element.remove();
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                cctrl.abort();
            };
            timeout = setTimeout(hdl, 80);
            element.addEventListener('transitionend', hdl, { once: true, signal: cctrl.signal });
            element.addEventListener('transitioncancel', hdl, { once: true, signal: cctrl.signal });
            element.addEventListener('transitionstart', () => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
            }, { once: true, signal: cctrl.signal });
        });

    };

    const onAttach = (event: Event) => {
        if (event.target !== element) {
            return;
        }

        element.classList.add(enterFrom);
        requestAnimationFrame(() => {
            if (transition) {
                element.classList.add(transition);
            }
            if (enterTo) {
                element.classList.add(enterTo);
            }
            element.classList.remove(enterFrom);

            const cctrl = new AbortController();
            let timeout: ReturnType<typeof setTimeout> | null = null;
            const hdl = () => {
                if (transition) {
                    element.classList.remove(transition);
                }
                if (enterTo) {
                    element.classList.remove(enterTo);
                }
                if (element.classList.length === 0) {
                    element.removeAttribute('class');
                }
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                cctrl.abort();
            };
            timeout = setTimeout(hdl, 80);
            element.addEventListener('transitionend', hdl, { once: true, signal: cctrl.signal });
            element.addEventListener('transitioncancel', hdl, { once: true, signal: cctrl.signal });
            element.addEventListener('transitionstart', () => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
            }, { once: true, signal: cctrl.signal });
        });
    };

    element.addEventListener(attachedEventName, onAttach, { signal });
    setImmediate(() => {
        element.addEventListener(detachEventName, onDetach, { signal });
    });
}
