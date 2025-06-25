import { extractForLoopTokens } from "./utils/lang";


export const primaryNs = 'civ';
export const pseudoNamespacePrefix = `${primaryNs}:`
export function parseMagicAttr(name: string) {
    if ((name.startsWith(':') && name[1] && name[1] !== ':')) {
        return name.slice(1)
    }

    const prefix = `${pseudoNamespacePrefix}bind:`;
    if ((name.startsWith(prefix))) {
        return name.slice(prefix.length)
    }

    const prefix2 = `${pseudoNamespacePrefix}attr:`;
    if ((name.startsWith(prefix2))) {
        return name.slice(prefix2.length)
    }

    if ((name.startsWith('bind:'))) {
        return name.slice('bind:'.length)
    }

    if ((name.startsWith('attr:'))) {
        return name.slice('attr:'.length)
    }

    return undefined;
}

export function parseMagicProp(name: string) {

    if (name.startsWith('::') && name[2] && name[2] !== ':') {
        return name.slice(2);
    }
    if (name.startsWith('.') && name[1] && name[1] !== '.') {
        return name.slice(1);
    }

    const prefix = `${pseudoNamespacePrefix}prop:`;
    if ((name.startsWith(prefix))) {
        return name.slice(prefix.length)
    }

    if ((name.startsWith('prop:'))) {
        return name.slice('prop:'.length)
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

    if ((name.startsWith('document-on:'))) {
        return name.slice('document-on:'.length)
    }

    return undefined;
}

export function parseMagicDocumentEventHandler(name: string) {
    if (name.startsWith('@@') && name[2]) {
        return name.slice(2);
    }

    const prefix = `${pseudoNamespacePrefix}document:on:`;

    if (name.startsWith(prefix)) {
        return name.slice(prefix.length);
    }

    if ((name.startsWith('document:on:'))) {
        return name.slice('document:on:'.length)
    }

    return undefined;
}

export const nsCollection = [
    primaryNs,
    'attr',
    'prop',
    'on',
    'document-on',
    'bind',
    'ref',
    'use',
    'render',
]

export const significantFlagClass = '__civ_significant';
export const subtreeTemplateFlagClass = '__civ_subtree_template';
export const componentFlagClass = '__civ_component';
export function isMagicRefAttr(name: string) {
    if (name.startsWith('$')) {
        return true;
    }
    if (name.startsWith(`${pseudoNamespacePrefix}ref`)) {
        return true;
    }
    if (name.startsWith(`${pseudoNamespacePrefix}use`)) {
        return true;
    }
    if (name.startsWith('ref:')) {
        return true;
    }
    if (name.startsWith('use:')) {
        return true;
    }

    return false;
}
export function isMagicForAttr(name: string) {
    return name === `${pseudoNamespacePrefix}for` || name === `render:for` || name === 'v-for';
}
export function isMagicIfAttr(name: string) {
    return name === `${pseudoNamespacePrefix}if` || name === `render:if` || name === 'v-if';
}
export function isMagicElifAttr(name: string) {
    return name === `${pseudoNamespacePrefix}elif` || name === `render:elif` || name === 'v-else-if';
}
export function isMagicElseAttr(name: string) {
    return name === `${pseudoNamespacePrefix}else` || name === `render:else` || name === 'v-else';
}
export function isMagicHTMLAttr(name: string) {
    return name === `${pseudoNamespacePrefix}html` || name === `render:html` || name === 'v-html';
}
export function isMagicBindAttr(name: string) {
    return name === `${pseudoNamespacePrefix}bind` || name === `render:text` || name === 'v-bind';
}
export function isMagicPlainAttr(name: string) {
    return name === `${pseudoNamespacePrefix}plain` || name === `render:plain` || name === 'v-pre';
}

export const eventArgName = '$event';
export const elementArgName = '$element';
export const namespaceInjectionArgName = '_ns';

export type Trait = 'tpl' | 'component' | 'attr' | 'prop' | 'event' | 'ref' | 'documentEvent' | 'for' | 'if' | 'elif' | 'else' | 'html' | 'bind' | 'plain';
export type Traits = [Trait, ...string[]][];

export function attrToTrait(attrName: string, expr: string): Traits[number] | undefined {
    const parsedAttr = parseMagicAttr(attrName);
    if (parsedAttr) {
        return ['attr', parsedAttr, expr] as const;
    }
    const parsedProp = parseMagicProp(attrName);
    if (parsedProp) {
        return ['prop', parsedProp, expr] as const;
    }
    const documentEvent = parseMagicDocumentEventHandler(attrName);
    if (documentEvent) {
        return ['documentEvent', documentEvent, expr] as const;
    }
    const parsedEvent = parseMagicEventHandler(attrName);
    if (parsedEvent) {
        return ['event', parsedEvent, expr] as const;
    }
    if (isMagicRefAttr(attrName)) {
        return ['ref', expr] as const;
    }
    if (isMagicForAttr(attrName)) {
        return ['for', expr, extractForLoopTokens(expr).join(',')] as const;
    }
    if (isMagicIfAttr(attrName)) {
        return ['if', expr] as const;
    }
    if (isMagicElifAttr(attrName)) {
        return ['elif', expr] as const;
    }
    if (isMagicElseAttr(attrName)) {
        return ['else'] as const;
    }
    if (isMagicHTMLAttr(attrName)) {
        return ['html', expr] as const;
    }
    if (isMagicBindAttr(attrName)) {
        return ['bind', expr] as const;
    }
    if (isMagicPlainAttr(attrName)) {
        return ['plain'] as const;
    }

    return undefined;
}

export function isMagicForTemplateElement(elem: Element) {
    return elem.hasAttribute(`${pseudoNamespacePrefix}for`) || elem.hasAttribute('v-for');
}

export const attachEventName = `${pseudoNamespacePrefix}attach`;
export const detachEventName = `${pseudoNamespacePrefix}detach`;
