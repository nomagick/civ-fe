import { runOncePerClass } from "./decorators/once";
import { REACTIVE_TEMPLATE_DOM, ReactiveTemplateMixin, identify } from "./decorators/dom-template";
import { activateReactivity, initReactivity, ReactivityHost } from "./decorators/reactive";
import { attrToTrait, isMagicBindAttr, isMagicElifAttr, isMagicElseAttr, isMagicForAttr, isMagicForTemplateElement, isMagicHTMLAttr, isMagicIfAttr, isMagicPlainAttr, namespaceInjectionArgName, parseMagicAttr, parseMagicEventHandler, parseMagicProp, significantFlagClass } from "./protocol";
import { GeneratorFunction } from "./utils/lang";
import { parseTemplate } from "utils/template-parser";

export interface CivComponent extends ReactivityHost, ReactiveTemplateMixin { }

const forExpRegex = /^(?<exp1>.+?)\s+(in|of)\s+(?<exp2>.+)$/;
let serial = 1;

export class CivComponent extends EventTarget {
    static components: Record<string, typeof CivComponent> = {};
    static expressionMap: Map<string, (this: CivComponent) => unknown> = new Map();
    static elemTraitsLookup: Map<string, string[][]> = new Map();
    element!: Element;
    serial = serial++;

    constructor() {
        super();
        Reflect.apply(initReactivity, this, []);
        this._digestTemplateMagicExpressions();
        this._activateTemplate();
        Reflect.apply(activateReactivity, this, []);
    }

    @runOncePerClass
    protected _digestTemplateMagicExpressions() {
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

        let elem: Element | Text = walker.currentNode as Element;
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

                continue;
            }
            const elemTraits: string[][] = [];

            let curElemIsCivSignificant = false;
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
            if (curElemIsCivSignificant) {
                elem.classList.add(significantFlagClass);
            }
            if (elemTraits.length) {
                elemTraitsMap.set(elem, elemTraits);
            }
        } while (elem = walker.nextNode() as Element);

        let serial=1;
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


enum DomMaintenanceTaskType {
    ATTR_SYNC = 'attrSync',
    PROP_SYNC = 'propSync',
    EVENT_BRIDGE = 'eventBridge',
    SUBTREE_CLONE = 'subtreeClone',
    ATTACHMENT_TOGGLE = 'attachmentToggle',
    MIGRATE_ELEMENT = 'migrateElement',
}

interface DomMaintenanceTask {
    type: DomMaintenanceTaskType;
    ref: Node;
    prop?: string;

}
