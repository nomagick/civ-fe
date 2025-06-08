import { runOncePerClass } from "./decorators/once";
import { REACTIVE_TEMPLATE_DOM, ReactiveTemplateMixin } from "./decorators/dom-template";
import { activateReactivity, REACTIVE_KIT, ReactivityHost } from "./decorators/reactive";
import { eventArgName, isMagicAttrName, isMagicForAttr, significantFlagClass } from "./protocol";
import { GeneratorFunction } from "./utils/lang";

export interface CivComponent extends ReactivityHost, ReactiveTemplateMixin { }

export class CivComponent extends EventTarget {
    static components: Record<string, typeof CivComponent> = {};
    static expressionMap: Map<string, (this: CivComponent) => unknown> = new Map();
    element!: HTMLElement;

    constructor() {
        super();
        activateReactivity(this);
        this._digestTemplateMagicExpressions();
    }

    @runOncePerClass
    protected _digestTemplateMagicExpressions() {
        const dom = this[REACTIVE_TEMPLATE_DOM];
        if (!dom) {
            return;
        }

        const walker = dom.createTreeWalker(dom.documentElement, NodeFilter.SHOW_ELEMENT, (elem) => {
            if (!(elem instanceof Element)) {
                return NodeFilter.FILTER_SKIP;
            }
            if (!elem.attributes.length) {
                return NodeFilter.FILTER_SKIP;
            }

            return NodeFilter.FILTER_ACCEPT;
        });

        const expressionMap = new Map<string, (this: CivComponent) => unknown>();

        let elem: Element = walker.currentNode as Element;
        do {
            let curElemIsCivSignificant = false;
            for (let i = 0; i < elem.attributes.length; i++) {
                const attr = elem.attributes[i];
                if (!attr.value) {
                    continue;
                };
                const name = attr.localName;
                const expr = attr.value.trim();
                const thisAttrIsCivSignificant = isMagicAttrName(name);
                if (thisAttrIsCivSignificant) {
                    curElemIsCivSignificant = true;
                }
                if (this.constructor.prototype.hasOwnProperty(expr)) {
                    continue;
                }
                if (expressionMap.has(expr)) {
                    continue;
                }
                if (thisAttrIsCivSignificant) {
                    if (isMagicForAttr(name)) {
                        const matched = expr.match(/^(?<exp1>.+?)\s+(in|of)\s+(?<exp2>.+)$/);
                        if (!matched) {
                            throw new Error(`Invalid expression for *for: ${expr}`);
                        }
                        const exp1 = matched.groups!.exp1.trim();
                        expressionMap.set(exp1, new GeneratorFunction(eventArgName, `with(this) { for (${expr}) { yield ${exp1}; } }`) as any);
                    } else {
                        expressionMap.set(expr, new Function(eventArgName, `with(this) { return ${expr}; }`) as any);
                    }
                }
            }
            if (curElemIsCivSignificant) {
                elem.classList.add(significantFlagClass);
            }
        } while (elem = walker.nextNode() as Element);

        (this.constructor as typeof CivComponent).expressionMap = expressionMap;
    }

    protected _activateTemplate() {
        const tplDom = this[REACTIVE_TEMPLATE_DOM];
        if (!tplDom) {
            return;
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
