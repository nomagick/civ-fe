

export const pseudoNamespacePrefix = 'c:'
export function isMagicAttr(name: string) {
    return (
        (name.startsWith(':') && name[1] && name[1] !== ':') ||
        (name.startsWith(`${pseudoNamespacePrefix}bind:`))
    );
}

export function isMagicProp(name: string) {
    return (
        (name.startsWith('::') && name[2] && name[2] !== ':')
    );
}

export function isMagicEventHandler(name: string) {
    return (
        (name.startsWith('@') && name[1]) ||
        (name.startsWith(`${pseudoNamespacePrefix}bind:`))
    );
}

export function isMagicForAttr(name: string) {
    return name === `${pseudoNamespacePrefix}for` || name === 'v-for';
}
export function isMagicIfAttr(name: string) {
    return name === `${pseudoNamespacePrefix}if` || name === 'v-if';
}
export function isMagicElifAttr(name: string) {
    return name === `${pseudoNamespacePrefix}elif` || name === 'v-else-if';
}
export function isMagicElseAttr(name: string) {
    return name === `${pseudoNamespacePrefix}else` || name === 'v-else';
}
export function isMagicHTMLAttr(name: string) {
    return name === `${pseudoNamespacePrefix}html` || name === 'v-html';
}

export function isMagicAttrName(name: string) {
    return (
        isMagicAttr(name) ||
        isMagicProp(name) ||
        isMagicEventHandler(name) ||
        isMagicForAttr(name) ||
        isMagicIfAttr(name) ||
        isMagicElifAttr(name) ||
        isMagicElseAttr(name) ||
        isMagicHTMLAttr(name)
    );
}

export const eventArgName = '$event';

export const significantFlagClass = '__civ_significant';
