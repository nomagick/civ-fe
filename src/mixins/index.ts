import { createTransitionGroup } from './transition-group';
import { createTransition } from './transition';
import { teleport } from './teleport';
import { getEventTarget } from './misc';

export const mixins = {
    createTransition,
    createTransitionGroup,
    teleport,
    getEventTarget,
} as const;

