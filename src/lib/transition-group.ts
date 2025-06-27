
import { moveEventName, movedEventName } from "../protocol";
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

    // --- Handle Enter and Leave --- 
    // We can simply apply the standard createTransition to all direct children.
    // The framework's events will bubble, so we listen on the container.
    container.addEventListener('civ:attached', (e) => {
        if (e.target instanceof HTMLElement && e.target.parentElement === container) {
            createTransition(e.target, config);
        }
    }, { signal });

    // --- Handle Move (FLIP) --- 
    // 1. FIRST: Listen for the 'move' event to capture starting positions.
    container.addEventListener(moveEventName, (e) => {
        if (e.target instanceof HTMLElement && e.target.parentElement === container) {
            childPositions.set(e.target, e.target.getBoundingClientRect());
        }
    }, { signal });

    // 2. LAST, INVERT, PLAY: Listen for the 'moved' event.
    container.addEventListener(movedEventName, (e) => {
        const child = e.target as HTMLElement;
        if (!childPositions.has(child)) return;

        // LAST: Get the new position.
        const newRect = child.getBoundingClientRect();
        const oldRect = childPositions.get(child)!;
        childPositions.delete(child);

        // INVERT: Calculate the delta and apply the inverted transform.
        const deltaX = oldRect.left - newRect.left;
        const deltaY = oldRect.top - newRect.top;
        const scaleX = oldRect.width / newRect.width;
        const scaleY = oldRect.height / newRect.height;

        if (Math.abs(deltaX) < 1 && Math.abs(deltaY) < 1) return; // Skip if it didn't move
        const backupTransform = child.style.transform;
        const backupTransition = child.style.transition;
        child.style.transform = `translate(${deltaX}px, ${deltaY}px) scale(${scaleX}, ${scaleY})`;

        // PLAY: In the next frame, add the transition and remove the transform.
        requestAnimationFrame(() => {
            const { duration, easing } = config;
            child.style.transition = `transform ${duration}ms${easing ? ` ${easing}` : ''}`;
            child.style.transform = backupTransform;
        });

        // Cleanup the inline transition style after it finishes.
        child.addEventListener('transitionend', () => {
            child.style.transition = backupTransition;
        }, { once: true });

    }, { signal });
}
