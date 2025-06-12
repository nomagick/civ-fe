import { runOncePerClass } from "./decorators/once";
import { REACTIVE_TEMPLATE_DOM, ReactiveTemplateMixin, identify } from "./decorators/dom-template";
import { activateReactivity, initReactivity, REACTIVE_KIT, ReactivityHost } from "./decorators/reactive";
import {
    attrToTrait, componentFlagClass, isMagicForAttr, isMagicForTemplateElement,
    namespaceInjectionArgName, significantFlagClass, subtreeTemplateFlagClass,
    Traits
} from "./protocol";
import { GeneratorFunction } from "./utils/lang";
import { parseTemplate } from "./utils/template-parser";
import { AttrSyncTask, ComponentRenderTask, DomMaintenanceTask, DomMaintenanceTaskType, EventBridgeTask, PropSyncTask, SubtreeRenderTask, SubtreeToggleTask, TplSyncTask } from "./dom";
import { TrieNode } from "./lib/trie";
import { ReactiveAttrMixin, setupAttrObserver } from "./decorators/attr";
import { EventEmitter } from "lib/event-emitter";

export interface CivComponent extends ReactivityHost, ReactiveTemplateMixin, ReactiveAttrMixin { }

const forExpRegex = /^(?<exp1>.+?)\s+(?<typ>in|of)\s+(?<exp2>.+)$/;
let serial = 1;

export class CivComponent extends EventEmitter {
    static components: Record<string, typeof CivComponent> = {};
    static expressionMap: Map<string, (this: CivComponent, _ns: Record<string, unknown>) => unknown> = new Map();
    static elemTraitsLookup: Map<string, Traits> = new Map();
    readonly serial = serial++;
    element!: Element;
    protected _pendingTasks: DomMaintenanceTask[] = [];
    protected _revokers: Set<AbortController> = new Set();
    protected _reactiveTargets: WeakMap<object, EventTarget> = new WeakMap();
    protected _subtreeRenderTaskTrack: WeakMap<SubtreeRenderTask, TrieNode<any, Element>> = new WeakMap();
    protected _elToComponentMap: WeakMap<Element, CivComponent> = new WeakMap();
    protected _taskToNodeMap: WeakMap<DomMaintenanceTask, Node> = new WeakMap();

    constructor() {
        super();
        Reflect.apply(initReactivity, this, []);
        this._digestTemplateMagicExpressions();
        this._activateTemplate();
        if ('observedAttributes' in this.constructor) {
            // @ts-ignore
            setupAttrObserver.call(this);
        }
        Reflect.apply(activateReactivity, this, []);
    }

    foreign(eventTarget: ReactivityHost) {
        const abortCtl = this[REACTIVE_KIT].connect(eventTarget[REACTIVE_KIT]);
        this._revokers.add(abortCtl);

        return abortCtl;
    }

    connectedCallback() {
        this.emit('connected');
    }
    disconnectedCallback() {
        this.emit('disconnected');
    }
    connectedMoveCallback() {
        this.emit('connectedMove');
    }
    adoptedCallback() {
        this.emit('adopted');
    }
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        this.emit('attributeChange', name, oldValue, newValue);
    }

    protected _cleanup() {
        for (const x of this._revokers) {
            x.abort();
        }
    }

    protected get _expressionMap() {
        return (this.constructor as typeof CivComponent).expressionMap;
    }
    protected get _elemTraitsLookup() {
        return (this.constructor as typeof CivComponent).elemTraitsLookup;
    }
    protected get _components() {
        return (this.constructor as typeof CivComponent).components;
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
        const elemTraitsMap: Map<Element, Traits> = new Map();
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
            const elemTraits: Traits = [];
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
                if (expressionMap.has(expr) || !expr) {
                    continue;
                }
                if (isMagicForAttr(name)) {
                    const matched = expr.match(forExpRegex);
                    if (!matched) {
                        throw new Error(`Invalid expression for *for: ${expr}`);
                    }
                    elem.classList.add(subtreeTemplateFlagClass);
                    const expr2 = matched.groups!.expr2;
                    const genFn = new GeneratorFunction(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { yield ${expr2}; for (${expr}) { yield ${namespaceInjectionArgName}; } } }`) as any;
                    Object.defineProperty(genFn, name, {
                        value: `*${genFn.name}`,
                        configurable: true
                    });
                    expressionMap.set(expr, genFn);
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

    protected _renderTemplateElem(elem: Element = this.element, ns?: Record<string, any>) {
        const elemTraitsLookup = this._elemTraitsLookup;
        const expressionMap = this._expressionMap;
        let el;
        while (el = elem.querySelector(`.${subtreeTemplateFlagClass}`)) {
            const start = document.createComment(`=== Start ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            const end = document.createComment(`=== End ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            el.before(start);
            el.after(end);
            const parent = el.parentNode!;
            el.remove();
            el.classList.remove(subtreeTemplateFlagClass);

            const elSerial = el.getAttribute(significantFlagClass) || '';
            const [, expr, nsJoint] = this._elemTraitsLookup.get(elSerial)?.find(([t]) => t === 'for') || [];
            if (!expr) {
                throw new Error(`Cannot find *for expression for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const injectNs = nsJoint?.split(',').filter(Boolean);
            if (!injectNs?.length) {
                throw new Error(`Invalid *for expression: ${expr} for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            if (!el.parentNode) {
                throw new Error()
            }
            this._pendingTasks.push({
                type: DomMaintenanceTaskType.SUBTREE_RENDER,
                tpl: el,
                anchor: [parent, start, end],
                expr,
                injectNs,
                ns
            });
        }
        const componentPlaceHolderElements = new Set<Element>();

        elem.querySelectorAll(`.${componentFlagClass}`).forEach((el) => {
            componentPlaceHolderElements.add(el);
            el.classList.remove(componentFlagClass);
            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                throw new Error(`Element with component flag does not have a significant flag class in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const traits = elemTraitsLookup.get(elSerial) || [];
            this._pendingTasks.push({
                type: DomMaintenanceTaskType.COMPONENT_RENDER,
                sub: el,
                comp: el.tagName,
                traits,
                ns
            });
        });

        elem.querySelectorAll(`.${significantFlagClass}`).forEach((el) => {
            const elSerial = el.getAttribute(significantFlagClass) || '';
            const traits = elemTraitsLookup.get(elSerial);
            if (!traits) {
                throw new Error(`Cannot find traits for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const hasPlainTrait = traits.some(([trait]) => trait === 'plain');
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
                            ns,
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
                            ns,
                        });
                        break;
                    }
                    case 'event': {
                        const [eventName, expr] = args;
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: el,
                            event: eventName,
                            expr,
                            ns,
                        });
                        break;
                    }
                    case 'documentEvent': {
                        const [eventName, expr] = args;
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: document,
                            event: eventName,
                            expr,
                            ns,
                        });
                        break;
                    }
                    case 'if': {
                        const [expr] = args;
                        const exprGroup: [string, Element][] = [
                            [expr, el]
                        ];
                        let nextSibling;
                        while (nextSibling = el.nextSibling) {
                            if (nextSibling instanceof Comment) {
                                continue;
                            } else if (nextSibling instanceof Text) {
                                if (nextSibling.textContent?.trim()) {
                                    break;
                                }
                                continue;
                            }
                            if (nextSibling instanceof Element) {
                                const elSerial = nextSibling.getAttribute(significantFlagClass);
                                if (!elSerial) {
                                    break;
                                }
                                const traits = elemTraitsLookup.get(elSerial);
                                const elifTrait = traits?.find(([t]) => t === 'elif');
                                if (elifTrait) {
                                    const [, expr] = elifTrait;
                                    exprGroup.push([expr, nextSibling]);
                                    continue;
                                }

                                const elseTrait = traits?.find(([t]) => t === 'else');
                                if (elseTrait) {
                                    exprGroup.push(['', nextSibling]);
                                    break;
                                }
                            }
                            break;
                        }
                        const placeHolder = document.createComment(`=== if group ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
                        el.before(placeHolder);
                        for (const [_expr, el] of exprGroup) {
                            el.remove();
                        }
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.SUBTREE_TOGGLE,
                            anchor: placeHolder,
                            exprGroup,
                            ns,
                        });
                        break;
                    }
                    case 'html': {
                        const [expr] = args;
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: 'innerHTML',
                            expr,
                            ns,
                        });
                        break;
                    }
                    case 'bind': {
                        const [expr] = args;
                        this._pendingTasks.push({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: 'textContent',
                            expr,
                            ns,
                        });
                        break;
                    }
                    case 'tpl': {
                        if (hasPlainTrait) {
                            break;
                        }
                        el.childNodes.forEach((node) => {
                            if (!(node instanceof Text)) {
                                return;
                            }
                            if (!node.textContent) {
                                return;
                            }

                            if (expressionMap.has(node.textContent)) {
                                this._pendingTasks.push({
                                    type: DomMaintenanceTaskType.TPL_SYNC,
                                    text: node,
                                    expr: node.textContent,
                                    ns,
                                });
                            }
                        });

                        break;
                    }
                    default: {
                        break;
                    }
                }
            }
        });

    }

    protected _evaluateExpr(expr: string, ns: Record<string, any> = Object.create(null)) {
        const fn = this._expressionMap.get(expr);
        if (!fn) {
            throw new Error(`Cannot find eval function for expression: ${expr}`);
        }

        if (fn.name.startsWith('*')) {
            throw new Error(`Cannot evaluate generator function: ${fn.name}. Use _evaluateForExpr instead.`);
        }

        const vecs: [object, string][] = [];

        const hdl = (tgt: object, prop: string) => {
            vecs.push([tgt, prop]);
        };
        this[REACTIVE_KIT].on('access', hdl);
        const r = fn.call(this, ns);
        this[REACTIVE_KIT].off('access', hdl);

        return { value: r, vecs };
    }

    protected *_evaluateForExpr(expr: string, ns: Record<string, any> = Object.create(null)) {
        const fn = this._expressionMap.get(expr) as any;
        if (!fn) {
            throw new Error(`Cannot find generator function for expression: ${expr}`);
        }

        if (!fn.name.startsWith('*')) {
            throw new Error(`Cannot evaluate non generator function: ${fn.name}. Use _evaluateExpr instead.`);
        }

        const vecs: [object, string][] = [];

        const hdl = (tgt: object, prop: string) => {
            vecs.push([tgt, prop]);
        };
        this[REACTIVE_KIT].on('access', hdl);
        const it = fn.call(this, ns) as Generator;
        it.next();
        this[REACTIVE_KIT].off('access', hdl);

        yield { value: ns, vecs };

        const dVecs: [object, string][] = [];
        const dhdl = (tgt: object, prop: string) => {
            dVecs.push([tgt, prop]);
        };
        this[REACTIVE_KIT].on('access', dhdl);

        for (const x of it) {
            yield { value: x, vecs: Array.from(dVecs) };
            dVecs.length = 0;
        }
    }

    protected _setupTaskRecurrence(task: DomMaintenanceTask, vecs: [object, string][]) {
        const abortCtl = new AbortController();
        const handler = () => {
            abortCtl.abort('recur');
            this._pendingTasks.push(task);
        };

        for (const [tgt, prop] of vecs) {
            let evtgt = this._reactiveTargets.get(tgt);
            if (!evtgt) {
                evtgt = new EventTarget();
                this._reactiveTargets.set(tgt, evtgt);
            }
            evtgt.addEventListener(prop, handler, { signal: abortCtl.signal, once: true });
        }

        return abortCtl;
    }

    protected _handleSubtreeRenderTask(task: SubtreeRenderTask) {
        const nsObj: Record<string, any> = Object.create(task.ns || null);
        for (const identifier of task.injectNs) {
            Reflect.set(nsObj, identifier, undefined);
        }
        const it = this._evaluateForExpr(task.expr, nsObj);

        const initialYield = it.next().value;
        if (!initialYield) {
            throw new Error(`Invalid *for expression: ${task.expr} in component ${identify(this.constructor as typeof CivComponent)}`);
        }

        let isReactive = false;
        if (initialYield.vecs.length) {
            isReactive = true;
            this._setupTaskRecurrence(task, initialYield.vecs);
        }
        const previousTrie = this._subtreeRenderTaskTrack.get(task);
        const nextTrie = new TrieNode<any, Element>(null);

        const [parent, start, end] = task.anchor;

        const newSequence: Node[] = [];

        for (const _x of it) {
            const cloneNs = Object.create(task.ns || null);
            Object.assign(cloneNs, nsObj);
            const series = task.injectNs.map((x) => Reflect.get(cloneNs, x));

            const n = previousTrie?.seek(...series);
            if (n?.found && n.payload) {
                nextTrie.insert(...series).payload = n.payload;
                newSequence.push(n.payload);
                continue;
            }

            const subTreeElem = task.tpl.cloneNode(true) as Element;
            this._renderTemplateElem(subTreeElem, cloneNs);
            parent.insertBefore(subTreeElem, end);
            nextTrie.insert(...series).payload = subTreeElem;
            newSequence.push(subTreeElem);
        }

        let anchorNode: Node | null = start.nextSibling;

        for (const x of newSequence) {
            parent.insertBefore(x, anchorNode);
            anchorNode = x;
        }

        let itNode;
        while (itNode = anchorNode?.nextSibling) {
            if (itNode === end) {
                break;
            }
            itNode.remove();
        }

        if (isReactive) {
            this._subtreeRenderTaskTrack.set(task, nextTrie);
        } else {
            this._subtreeRenderTaskTrack.delete(task);
        }
    }

    protected _handleComponentRenderTask(task: ComponentRenderTask) {
        const compCls = this._components[task.comp];
        if (!compCls) {
            return;
        }
        const el = task.sub;

        const instance = Reflect.construct(compCls, []) as CivComponent;
        const targetElement = instance.element;
        this._elToComponentMap.set(el, instance);

        const attributes = el.attributes;
        for (let i = attributes.length - 1; i >= 0; i--) {
            const attr = attributes[i];
            targetElement.setAttributeNode(attr);
        }

        const defaultSlot = targetElement.querySelector<HTMLElement>('slot:not([name])');
        if (defaultSlot) {
            defaultSlot.classList.add(`${identify(compCls)}__slotted`);
            el.childNodes.forEach((node) => {
                defaultSlot.appendChild(node);
            });
        }
        const namedTemplates = el.querySelectorAll(`:scope > template[for]`);
        if (namedTemplates.length) {
            namedTemplates.forEach((el) => el.remove());
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
            targetSlot.classList.add(`${identify(compCls)}__slotted`);
            template.childNodes.forEach((node) => {
                targetSlot.appendChild(node);
            });
        });
    }

    protected _handleAttrSyncTask(task: AttrSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        task.attr.value = value as any;
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handlePropSyncTask(task: PropSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        if (this._elToComponentMap.has(task.tgt as any)) {
            task.tgt = this._elToComponentMap.get(task.tgt as any) as any;
        }
        Reflect.set(task.tgt, task.prop, value);
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handleTplSyncTask(task: TplSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        this._setupTaskRecurrence(task, vecs);
        task.text.nodeValue = value as string;
    }

    protected _handleSubtreeToggleTask(task: SubtreeToggleTask) {
        const allVecs = [];
        let active = false;
        const currentAnchor = this._taskToNodeMap.get(task) || task.anchor;
        for (const [expr, el] of task.exprGroup) {
            const { vecs: vecs, value } = this._evaluateExpr(expr, task.ns);
            allVecs.push(...vecs);
            if (value) {
                currentAnchor.parentNode?.replaceChild(el, currentAnchor);
                this._taskToNodeMap.set(task, el);
                active = true;
                break;
            }
        }

        if (!active) {
            currentAnchor.parentNode?.replaceChild(task.anchor, currentAnchor);
            this._taskToNodeMap.set(task, task.anchor);
        }
        this._setupTaskRecurrence(task, allVecs);
    }

    protected _handleEventBridgeTask(task: EventBridgeTask) {
        const [eventName, ...traits] = task.event.split('.');
        
    }
}
