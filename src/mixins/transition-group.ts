
import { attachedEventName, detachEventName, moveEventName, movedEventName } from "../protocol";
import { TransitionConfig, createTransition } from "./transition";

/**
 * Attaches enter, leave, and move (FLIP) transitions to the children of a container element.
 * This utility listens for the framework's lifecycle events (`move`, `moved`) and orchestrates
 * the animations in a high-performance way.
 * 
 * @param container The container element whose children will be animated.
 * @param config The transition configuration to apply to each child.
 * @returns An AbortController to disconnect the listeners and clean up.
 */
export function createTransitionGroup(container: HTMLElement, config: TransitionConfig) {
    const { signal } = config;
    const childPositions = new WeakMap<HTMLElement, DOMRect>();

    container.addEventListener(attachedEventName, (e) => {
        if (e.target instanceof HTMLElement && e.target.parentElement === container) {
            createTransition(e.target, config);
        }
    }, { signal, capture: true });

    // --- Handle Move (FLIP) --- 
    // 1. FIRST: Listen for the 'move' event to capture starting positions.
    container.addEventListener(moveEventName, (e) => {
        const { target } = e;
        if (target instanceof HTMLElement && target.parentElement === container) {
            childPositions.set(target, target.getBoundingClientRect());
        }
    }, { signal });

    // 2. LAST, INVERT, PLAY: Listen for the 'moved' event.
    container.addEventListener(movedEventName, (e) => {
        const elem = e.target as HTMLElement;
        if (!childPositions.has(elem)) return;

        // LAST: Get the new position.
        const newRect = elem.getBoundingClientRect();
        const oldRect = childPositions.get(elem)!;
        childPositions.delete(elem);

        // INVERT: Calculate the delta and apply the inverted transform.
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        const scaleX = oldRect.width / newRect.width;
        const scaleY = oldRect.height / newRect.height;

        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return; // Skip if it didn't move
        const backupTransform = elem.style.transform;
        elem.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;
        const { transition = 'in-transition' } = config;

        // PLAY: In the next frame, add the transition and remove the transform.
        requestAnimationFrame(() => {
            elem.style.transform = backupTransform;
            if (transition) {
                elem.classList.add(transition);
            }

            const cctrl = new AbortController();
            let timeout: ReturnType<typeof setTimeout> | null = null;
            const hdl = () => {
                if (transition) {
                    elem.classList.remove(transition);
                }
                if (elem.classList.length === 0) {
                    elem.removeAttribute('class');
                }

                if (!elem.style.cssText) {
                    elem.removeAttribute('style');
                }
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
                cctrl.abort();
            }
            timeout = setTimeout(hdl, 80);
            elem.addEventListener('transitionend', hdl, { once: true, signal: cctrl.signal });
            elem.addEventListener('transitioncancel', hdl, { once: true, signal: cctrl.signal });
            elem.addEventListener('transitionstart', () => {
                if (timeout) {
                    clearTimeout(timeout);
                    timeout = null;
                }
            }, { once: true, signal: cctrl.signal });
        });

    }, { signal });
}
