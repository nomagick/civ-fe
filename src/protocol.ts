

export const pseudoNamespacePrefix = 'c:'
export function parseMagicAttr(name: string) {
    if ((name.startsWith(':') && name[1] && name[1] !== ':')) {
        return name.slice(1)
    }

    const prefix = `${pseudoNamespacePrefix}bind:`;
    if ((name.startsWith(prefix))) {
        return name.slice(prefix.length)
    }

    return undefined;
}

export function parseMagicProp(name: string) {

    if (name.startsWith('::') && name[2] && name[2] !== ':') {
        return name.slice(2);
    }

    return undefined;
}

export function parseMagicEventHandler(name: string) {
    if (name.startsWith('@') && name[1]) {
        return name.slice(1);
    }

    const prefix = `${pseudoNamespacePrefix}on:`;

    if (name.startsWith(prefix)) {
        return name.slice(prefix.length);
    }

    return undefined;
}

export const significantFlagClass = '__civ_significant';
export function isMagicForAttr(name: string) {
    return name === `${pseudoNamespacePrefix}for` || name === 'v-for';
}
export function isMagicForTemplateElement(elem: Element) {
    return elem.hasAttribute(`${pseudoNamespacePrefix}for`) || elem.hasAttribute('v-for');
}
export const magicForSelector = `.${significantFlagClass}[${pseudoNamespacePrefix}for], .${significantFlagClass}[v-for]`;
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
export function isMagicBindAttr(name: string) {
    return name === `${pseudoNamespacePrefix}bind` || name === 'v-bind';
}
export function isMagicPlainAttr(name: string) {
    return name === `${pseudoNamespacePrefix}plain` || name === 'v-pre';
}

export const eventArgName = '$event';
export const namespaceInjectionArgName = '_ns';

