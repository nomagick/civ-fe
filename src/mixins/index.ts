import { createTransitionGroup } from './transition-group';
import { createTransition } from './transition';
import { teleport } from './teleport';

export const mixins = {
    createTransition,
    createTransitionGroup,
    teleport
} as const;

