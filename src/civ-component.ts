import { runOncePerClass } from "./decorators/once";
import { REACTIVE_TEMPLATE_DOM, ReactiveTemplateMixin, identify } from "./decorators/dom-template";
import { activateReactivity, initReactivity, ReactivityHost } from "./decorators/reactive";
import { componentFlagClass, isMagicForAttr, isMagicForTemplateElement, namespaceInjectionArgName, significantFlagClass, subtreeTemplateFlagClass } from "./protocol";
import { GeneratorFunction } from "./utils/lang";
import { parseTemplate } from "./utils/template-parser";
import { DomMaintenanceTask, DomMaintenanceTaskType } from "./dom";

export interface CivComponent extends ReactivityHost, ReactiveTemplateMixin { }

const forExpRegex = /^(?<exp1>.+?)\s+(in|of)\s+(?<exp2>.+)$/;
let serial = 1;

export class CivComponent extends EventTarget {
    static components: Record<string, typeof CivComponent> = {};
    static expressionMap: Map<string, (this: CivComponent) => unknown> = new Map();
    static elemTraitsLookup: Map<string, string[][]> = new Map();
    readonly serial = serial++;
    element!: Element;
    protected _pendingTasks: DomMaintenanceTask[] = [];


    constructor() {
        super();
        Reflect.apply(initReactivity, this, []);
        this._digestTemplateMagicExpressions();
        this._activateTemplate();
        Reflect.apply(activateReactivity, this, []);
    }

    @runOncePerClass
    protected _digestTemplateMagicExpressions() {
        if (this.constructor.hasOwnProperty('components')) {
            const components = (this.constructor as typeof CivComponent).components;
            for (const [k, v] of Object.entries(components)) {
                Reflect.deleteProperty(components, k);
                Reflect.set(components, k.toUpperCase(), v);
            }
        }
        const dom = this[REACTIVE_TEMPLATE_DOM];
        if (!dom) {
            return;
        }

        const walker = dom.createTreeWalker(dom.documentElement, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, (elem) => {
            if (elem instanceof Text) {
                if (elem.textContent?.includes('{{') && elem.textContent.includes('}}')) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                return NodeFilter.FILTER_SKIP;
            }

            if (!(elem instanceof Element)) {
                return NodeFilter.FILTER_SKIP;
            }
            if (!elem.attributes.length) {
                return NodeFilter.FILTER_SKIP;
            }

            return NodeFilter.FILTER_ACCEPT;
        });

        const expressionMap = (this.constructor as typeof CivComponent).expressionMap;
        const elemTraitsMap: Map<Element, string[][]> = new Map();
        const components = (this.constructor as typeof CivComponent).components;

        let elem = walker.currentNode as Element | Text;
        do {
            if (elem instanceof Text) {
                const tpl = elem.textContent || '';
                const parsed = parseTemplate(tpl);
                if (!parsed.length || !parsed.some((x) => x.type === 'expression')) {
                    continue;
                }

                const exprFn = new Function(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { return [${parsed.map((x) => x.type === 'expression' ? x.value : JSON.stringify(x.value)).join(', ')}].join(''); } }`) as any;
                expressionMap.set(tpl, exprFn);
                const parentTraits = elemTraitsMap.get(elem.parentElement!) || [];
                parentTraits.push(['tpl']);
                elemTraitsMap.set(elem.parentElement!, parentTraits);
                elem.parentElement!.classList.add(significantFlagClass);

                continue;
            }
            const elemTraits: string[][] = [];
            const magicAttrs: Attr[] = [];
            if (Reflect.get(components, elem.tagName)) {
                elem.classList.add(componentFlagClass);
            }

            for (let i = 0; i < elem.attributes.length; i++) {
                const attr = elem.attributes[i];
                if (!attr.value) {
                    continue;
                };
                const name = attr.localName;
                const expr = attr.value.trim();

                const trait = attrToTrait(name, expr);
                if (!trait) {
                    continue;
                }
                magicAttrs.push(attr);
                if (trait.length === 1 || !trait.includes(expr)) {
                    continue;
                }

                if (this.constructor.prototype.hasOwnProperty(expr)) {
                    continue;
                }
                if (expressionMap.has(expr) || !expr) {
                    continue;
                }
                if (isMagicForAttr(name)) {
                    const matched = expr.match(forExpRegex);
                    if (!matched) {
                        throw new Error(`Invalid expression for *for: ${expr}`);
                    }
                    const exp1 = matched.groups!.exp1.trim();
                    elem.classList.add(subtreeTemplateFlagClass);
                    const genFn = new GeneratorFunction(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { for (${expr}) { yield ${exp1}; } } }`) as any;
                    Object.defineProperty(genFn, name, {
                        value: `*${genFn.name}`,
                        configurable: true
                    });
                    expressionMap.set(exp1, genFn);
                } else {
                    expressionMap.set(expr, new Function(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { return ${expr}; } }`) as any);
                }
            }
            for (const attr of magicAttrs) {
                elem.removeAttributeNode(attr);
            }
            if (elemTraits.length) {
                elem.classList.add(significantFlagClass);
                elemTraitsMap.set(elem, elemTraits);
            }
        } while (elem = walker.nextNode() as Element);

        let serial = 1;
        const elemTraitsLookup = (this.constructor as typeof CivComponent).elemTraitsLookup;
        for (const [k, v] of elemTraitsMap) {
            const sn = `${serial++}`;
            k.setAttribute(significantFlagClass, sn);
            elemTraitsLookup.set(sn, v);
        }
    }

    protected _activateTemplate() {
        const tplDom = this[REACTIVE_TEMPLATE_DOM];
        if (!tplDom) {
            this.element = document.createElement(`div`);
            this.element.classList.add(identify(this.constructor as typeof CivComponent));

            return this.element;
        }

        const rootElement = document.importNode(tplDom.documentElement, true);
        rootElement.classList.add(identify(this.constructor as typeof CivComponent));

        if (isMagicForTemplateElement(rootElement)) {
            throw new Error(`Template for component ${identify(this.constructor as typeof CivComponent)} cannot be a *for template.`);
        }

        this.element = rootElement;

        return this.element;
    }

    protected _installMagic(elem: Element = this.element) {

        let el;
        while (el = elem.querySelector(`.${subtreeTemplateFlagClass}`)) {
            const start = document.createComment(`=== Start ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            const end = document.createComment(`=== End ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            el.before(start);
            el.after(end);
            el.remove();
            el.classList.remove(subtreeTemplateFlagClass);

            const elSerial = el.getAttribute(significantFlagClass) || '';
            const expr = (this.constructor as typeof CivComponent).elemTraitsLookup.get(elSerial)?.find(([t]) => t === 'for')?.[1];
            if (!expr) {
                throw new Error(`Cannot find *for expression for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            this._pendingTasks.push({
                type: DomMaintenanceTaskType.SUBTREE_RENDER,
                tpl: el,
                anchor: [start, end],
                expr
            });
        }
        const componentPlaceHolderElements = new Set<Element>();

        elem.querySelectorAll(`.${componentFlagClass}`).forEach((el)=> {
            componentPlaceHolderElements.add(el);
            el.classList.remove(componentFlagClass);
            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                throw new Error(`Element with component flag does not have a significant flag class in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const traits = (this.constructor as typeof CivComponent).elemTraitsLookup.get(elSerial);
            this._pendingTasks.push({
                type: DomMaintenanceTaskType.COMPONENT_RENDER,
                sub: el,
                comp: el.tagName,
                traits: traits || []
            });
        });

        elem.querySelectorAll(`.${significantFlagClass}`).forEach((el)=> {
            const elSerial = el.getAttribute(significantFlagClass) || '';
            const traits = (this.constructor as typeof CivComponent).elemTraitsLookup.get(elSerial);
            if (!traits) {
                throw new Error(`Cannot find traits for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            for (const [trait, ...args] of traits) {
                switch (trait) {
                    case 'attr': {
                        const [attrName, expr] = args;
                        let attrNode: Attr | null = el.getAttributeNode(attrName);
                        if (!attrNode) {
                            attrNode = document.createAttribute(attrName);
                            el.setAttributeNode(attrNode);
                        }
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.ATTR_SYNC,
                            attr: attrNode,
                            expr,
                        });
                        break;
                    }
                    case 'prop': {
                        const [propName, expr] = args;
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: propName,
                            expr,
                        });
                        break;
                    }
                    case 'tpl': {
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.SUBTREE_RENDER,
                            tpl: el,
                            anchor: [el.previousSibling!, el.nextSibling!],
                            expr
                        });
                        break;
                    }
                    default: {
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.ATTR_SYNC,
                            attr: el.attributes.getNamedItem(trait)!,
                            expr
                        });
                    }
                }
            }
        });

        for (const [k, v] of Object.entries((this.constructor as typeof CivComponent).components)) {
            elem.querySelectorAll<HTMLElement>(k).forEach((el) => {
                const namedTemplates = el.querySelectorAll(`:scope > template[for]`);
                if (namedTemplates.length) {
                    namedTemplates.forEach((el) => el.remove());
                }
                const instance = new v();
                const targetElement = instance.element;

                const attributes = el.attributes;
                for (let i = attributes.length - 1; i >= 0; i--) {
                    const attr = attributes[i];
                    targetElement.setAttributeNode(attr);
                }

                const defaultSlot = targetElement.querySelector<HTMLElement>('slot:not([name])');
                if (defaultSlot) {
                    defaultSlot.classList.add(`${identify(v)}__slotted`);
                    el.childNodes.forEach((node) => {
                        defaultSlot.appendChild(node);
                    });
                }
                namedTemplates.forEach((template) => {
                    const forAttr = template.getAttribute('for');
                    if (!forAttr) {
                        return;
                    }
                    const targetSlot = targetElement.querySelector<HTMLElement>(`slot[name="${forAttr}"]`);
                    if (!targetSlot) {
                        return;
                    }
                    template.childNodes.forEach((node) => {
                        targetSlot.appendChild(node);
                    });
                });
            });
        }


    }
}
