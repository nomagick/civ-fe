import { runOncePerClass } from "./lib/once";
import { REACTIVE_TEMPLATE_DOM, ReactiveTemplateMixin, identify } from "./lib/dom-template";
import { activateReactivity, initReactivity, REACTIVE_KIT, ReactivityHost } from "./lib/reactive";
import {
    attrToTrait, componentFlagClass, isMagicForAttr, isMagicForTemplateElement,
    namespaceInjectionArgName, significantFlagClass, subtreeTemplateFlagClass,
    Traits
} from "./protocol";
import { GeneratorFunction } from "./utils/lang";
import { parseTemplate } from "./utils/template-parser";
import { AttrSyncTask, ComponentRenderTask, DomMaintenanceTask, DomMaintenanceTaskType, EventBridgeTask, PropSyncTask, SubtreeRenderTask, SubtreeToggleTask, TplSyncTask } from "./dom";
import { TrieNode } from "./lib/trie";
import { ReactiveAttrMixin, setupAttrObserver } from "./lib/attr";
import { EventEmitter } from "lib/event-emitter";

export interface CivComponent extends ReactivityHost, ReactiveTemplateMixin, ReactiveAttrMixin { }
export const elementToComponentMap: WeakMap<Element, CivComponent> = new WeakMap();

const forExpRegex = /^(?<exp1>.+?)\s+(?<typ>in|of)\s+(?<exp2>.+)$/;
let serial = 1;

type ExprFn = (this: CivComponent, _ns: Record<string, unknown>) => unknown;
type GenExprFn = (this: CivComponent, _ns: Record<string, unknown>) => Generator;

const ARRAY_OP_TRIGGER = '__civ_array_op_trigger__';

export class CivComponent extends EventEmitter {
    static components: Record<string, typeof CivComponent> = {};
    static expressionMap: Map<string, ExprFn | GenExprFn> = new Map();
    static elemTraitsLookup: Map<string, Traits> = new Map();
    readonly serial = serial++;
    element!: Element;
    protected _pendingTasks: DomMaintenanceTask[] = [];
    protected _revokers: Set<AbortController> = new Set();
    protected _reactiveTargets: WeakMap<object, EventTarget> = new WeakMap();
    protected _subtreeRenderTaskTrack: WeakMap<SubtreeRenderTask, TrieNode<object, Element>> = new WeakMap();
    protected _placeHolderElementToComponentMap: WeakMap<Element, CivComponent> = new WeakMap();
    protected _taskToNodeMap: WeakMap<DomMaintenanceTask, Node> = new WeakMap();
    protected _taskToHostElementMap: WeakMap<DomMaintenanceTask, Element> = new WeakMap();
    protected _taskToRevokerMap: WeakMap<DomMaintenanceTask, AbortController> = new WeakMap();
    protected _subtreeTaskTrack: WeakMap<Element, Set<DomMaintenanceTask>> = new WeakMap();

    constructor() {
        super();
        Reflect.apply(initReactivity, this, []);
        this._digestTemplateMagicExpressions();
        this._activateTemplate();
        elementToComponentMap.set(this.element, this);
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
    // connectedMoveCallback() {
    //     this.emit('connectedMove');
    // }
    // adoptedCallback() {
    //     this.emit('adopted');
    // }
    attributeChangedCallback(name: string, oldValue: string, newValue: string) {
        this.emit('attributeChange', name, oldValue, newValue);
    }

    replaceElement(el: Element) {
        const targetElement = this.element;
        const childComponents: CivComponent[] = [];
        targetElement.querySelectorAll(`.${componentFlagClass}`).forEach((el) => {
            const comp = elementToComponentMap.get(el);
            if (comp) {
                childComponents.push(comp);
            }
        });

        const attributes = el.attributes;
        for (let i = attributes.length - 1; i >= 0; i--) {
            const attr = attributes[i];
            targetElement.setAttributeNode(attr);
        }

        const compCls = this.constructor as typeof CivComponent;
        const clsId = identify(compCls);

        const defaultSlot = targetElement.querySelector<HTMLElement>('slot:not([name])');
        if (defaultSlot) {
            defaultSlot.classList.add(`${clsId}__slotted`);
            el.childNodes.forEach((node) => {
                defaultSlot.appendChild(node);
            });
        }

        const taskSet = this._subtreeTaskTrack.get(el);
        if (taskSet) {
            this._subtreeTaskTrack.set(targetElement, taskSet);
            for (const t of taskSet) {
                this._taskToHostElementMap.set(t, targetElement);
            }
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
            targetSlot.classList.add(`${clsId}__slotted`);
            template.childNodes.forEach((node) => {
                targetSlot.appendChild(node);
            });
        });

        el.replaceWith(targetElement);
        if (targetElement.isConnected) {
            this.connectedCallback();
            childComponents.forEach((x) => x.connectedCallback());
        }

        return targetElement;
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

                const exprFn = new Function(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { return [${parsed.map((x) => x.type === 'expression' ? x.value : JSON.stringify(x.value)).join(', ')}].join(''); } }`) as ExprFn;
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
                    const { expr1, typ, expr2 } = matched.groups!;
                    const genFn = new GeneratorFunction(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { const __iterable_ = ${expr2}; yield __iterable_; for (${expr1} ${typ} __iterable_}) { yield ${namespaceInjectionArgName}; } } }`) as unknown as GenExprFn;
                    Object.defineProperty(genFn, name, {
                        value: `*${genFn.name}`,
                        configurable: true
                    });
                    expressionMap.set(expr, genFn);
                } else {
                    expressionMap.set(expr, new Function(namespaceInjectionArgName, `with(this) { with(${namespaceInjectionArgName}) { return ${expr}; } }`) as ExprFn);
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

    protected _trackTask(task: DomMaintenanceTask, hostElem: Element) {
        this._pendingTasks.push(task);
        this._taskToHostElementMap.set(task, hostElem);

        let taskSet = this._subtreeTaskTrack.get(hostElem);
        if (!taskSet) {
            taskSet = new Set();
            this._subtreeTaskTrack.set(hostElem, taskSet);
        }
        taskSet.add(task);
    }

    protected _untrackTask(task: DomMaintenanceTask) {
        this._taskToRevokerMap.delete(task);
        const hostElem = this._taskToHostElementMap.get(task);
        if (hostElem) {
            this._subtreeTaskTrack.get(hostElem)?.delete(task);
        }
    }

    protected _renderTemplateElem(elem: Element = this.element, ns?: Record<string, unknown>) {
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

            this._trackTask({
                type: DomMaintenanceTaskType.SUBTREE_RENDER,
                tpl: el,
                anchor: [parent, start, end],
                expr,
                injectNs,
                ns
            }, elem);
        }
        const componentPlaceHolderElements = new Set<Element>();

        elem.querySelectorAll(`.${componentFlagClass}`).forEach((el) => {
            componentPlaceHolderElements.add(el);
            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                throw new Error(`Element with component flag does not have a significant flag class in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const traits = elemTraitsLookup.get(elSerial) || [];
            this._trackTask({
                type: DomMaintenanceTaskType.COMPONENT_RENDER,
                sub: el,
                comp: el.tagName,
                traits,
                ns
            }, elem);
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
                        this._trackTask({
                            type: DomMaintenanceTaskType.ATTR_SYNC,
                            attr: attrNode,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'prop': {
                        const [propName, expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: propName,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'event': {
                        const [eventName, expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: el,
                            event: eventName,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'documentEvent': {
                        const [eventName, expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: document,
                            event: eventName,
                            expr,
                            ns,
                        }, elem);
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
                        this._trackTask({
                            type: DomMaintenanceTaskType.SUBTREE_TOGGLE,
                            anchor: placeHolder,
                            exprGroup,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'html': {
                        const [expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: 'innerHTML',
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'bind': {
                        const [expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: 'textContent',
                            expr,
                            ns,
                        }, elem);
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
                                this._trackTask({
                                    type: DomMaintenanceTaskType.TPL_SYNC,
                                    text: node,
                                    expr: node.textContent,
                                    ns,
                                }, elem);
                            }
                        });

                        break;
                    }
                    default: {
                        break;
                    }
                }
            }

            // TODO: check if it makes sense to keep these
            el.classList.remove(significantFlagClass);
            el.removeAttribute(significantFlagClass);
        });

    }

    protected _evaluateExpr(expr: string, ns: Record<string, unknown> = Object.create(null), noListen?: unknown) {
        const fn = this._expressionMap.get(expr);
        if (!fn) {
            throw new Error(`Cannot find eval function for expression: ${expr}`);
        }

        if (fn.name.startsWith('*')) {
            throw new Error(`Cannot evaluate generator function: ${fn.name}. Use _evaluateForExpr instead.`);
        }

        if (noListen) {
            return { value: fn.call(this, ns), vecs: [] };
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

    protected *_evaluateForExpr(expr: string, ns: Record<string, unknown> = Object.create(null)) {
        const fn = this._expressionMap.get(expr);
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
        this._taskToRevokerMap.get(task)?.abort();
        const abortCtl = new AbortController();
        if (!vecs.length) {
            this._untrackTask(task);

            abortCtl.abort();

            return abortCtl;
        }

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
        this._taskToRevokerMap.set(task, abortCtl);

        return abortCtl;
    }

    protected _handleSubtreeRenderTask(task: SubtreeRenderTask) {
        const nsObj: Record<string, unknown> = Object.create(task.ns || null);
        for (const identifier of task.injectNs) {
            Reflect.set(nsObj, identifier, undefined);
        }
        const it = this._evaluateForExpr(task.expr, nsObj);

        const initialYield = it.next().value;
        if (!initialYield) {
            throw new Error(`Invalid *for expression: ${task.expr} in component ${identify(this.constructor as typeof CivComponent)}`);
        }
        let equivalentIterable = initialYield.value;
        let isReactive = false;
        if (initialYield.vecs.length) {
            const vecs = [...initialYield.vecs];
            isReactive = true;
            let arrayVal;
            if (Array.isArray(initialYield.value)) {
                arrayVal = initialYield.value;
            } else if (initialYield.value instanceof Iterator) {
                const lastVec = vecs.pop()!;
                const bv = lastVec[0];
                if (Array.isArray(bv)) {
                    arrayVal = bv;
                } else {
                    vecs.push(lastVec);
                }
            }
            if (arrayVal) {
                vecs.push([arrayVal, ARRAY_OP_TRIGGER]);
                equivalentIterable = arrayVal;
            }

            this._setupTaskRecurrence(task, vecs);
        }

        const previousTrie = this._subtreeRenderTaskTrack.get(task);
        const nextTrie = new TrieNode<object, Element>(equivalentIterable as Iterable<unknown>);

        const [parent, start, end] = task.anchor;

        const newSequence: Node[] = [];
        const newElements: Element[] = [];

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
            newElements.push(subTreeElem);
            parent.insertBefore(subTreeElem, end);
            nextTrie.insert(...series).payload = subTreeElem;
            newSequence.push(subTreeElem);
        }

        let anchorNode: Node | null = start.nextSibling;

        for (const x of newSequence) {
            if (x.parentElement !== parent) {
                // Element exists but moved to another place
                continue;
            }
            parent.insertBefore(x, anchorNode);
            anchorNode = x;
        }

        let itNode;
        while (itNode = anchorNode?.nextSibling) {
            if (itNode === end) {
                break;
            }
            itNode.remove();
            const taskSet = this._subtreeTaskTrack.get(itNode as Element);
            if (taskSet) {
                for (const t of taskSet) {
                    const revoker = this._taskToRevokerMap.get(t);
                    revoker?.abort();
                    this._taskToRevokerMap.delete(t);
                }
            }
            this._subtreeTaskTrack.delete(itNode as Element);

            if (itNode instanceof Element) {
                itNode.querySelectorAll(`.${componentFlagClass}`).forEach((el) => {
                    const comp = elementToComponentMap.get(el);
                    if (comp) {
                        comp.disconnectedCallback();
                        comp._cleanup();
                    }
                });
            }
        }

        if (parent.isConnected) {
            for (const x of newElements) {
                x.querySelectorAll(`.${componentFlagClass}`).forEach((el) => {
                    const comp = elementToComponentMap.get(el);
                    if (comp) {
                        comp.connectedCallback();
                    }
                });
            }
        }

        if (isReactive) {
            this._subtreeRenderTaskTrack.set(task, nextTrie);
        } else {
            this._subtreeRenderTaskTrack.delete(task);
            this._untrackTask(task);
        }
    }

    protected _handleComponentRenderTask(task: ComponentRenderTask) {
        this._untrackTask(task);
        const compCls = this._components[task.comp];
        if (!compCls) {
            return;
        }
        const el = task.sub;
        const instance = Reflect.construct(compCls, []) as CivComponent;
        this._placeHolderElementToComponentMap.set(el, instance);
        instance.replaceElement(el);
    }

    protected _handleAttrSyncTask(task: AttrSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        // @ts-ignore
        task.attr.value = value;
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handlePropSyncTask(task: PropSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        if (this._placeHolderElementToComponentMap.has(task.tgt as Element)) {
            task.tgt = this._placeHolderElementToComponentMap.get(task.tgt as Element) as CivComponent;
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

        const opts: Record<string, unknown> = {};
        for (const x of traits) {
            opts[x] = true;
        }

        task.tgt.addEventListener(eventName, (e: Event) => {
            const ns = Object.create(task.ns || null);
            ns.$event = e;
            const { value } = this._evaluateExpr(task.expr, ns, true);

            if (typeof value === 'function') {
                value.call(this, e);
            }
        }, opts);

        this._untrackTask(task);
    }

    protected _digestTasks() {
        const thisBatch = [...this._pendingTasks];
        const batchSet = new WeakSet();
        this._pendingTasks.length = 0;
        for (const task of thisBatch) {
            if (batchSet.has(task)) {
                continue;
            }
            batchSet.add(task);
            switch (task.type) {
                case DomMaintenanceTaskType.SUBTREE_RENDER:
                    this._handleSubtreeRenderTask(task);
                    break;
                case DomMaintenanceTaskType.COMPONENT_RENDER:
                    this._handleComponentRenderTask(task);
                    break;
                case DomMaintenanceTaskType.ATTR_SYNC:
                    this._handleAttrSyncTask(task);
                    break;
                case DomMaintenanceTaskType.PROP_SYNC:
                    this._handlePropSyncTask(task);
                    break;
                case DomMaintenanceTaskType.TPL_SYNC:
                    this._handleTplSyncTask(task);
                    break;
                case DomMaintenanceTaskType.SUBTREE_TOGGLE:
                    this._handleSubtreeToggleTask(task);
                    break;
                case DomMaintenanceTaskType.EVENT_BRIDGE:
                    this._handleEventBridgeTask(task);
                    break;
            }
        }
    }

    protected _setupReactivity() {
        this[REACTIVE_KIT].on('assign', (tgt, prop, newVal, oldVal) => {
            const evtgt = this._reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { newVal, oldVal } });
                evtgt.dispatchEvent(ev);
            }
        });
        this[REACTIVE_KIT].on('delete', (tgt, prop, oldVal) => {
            const evtgt = this._reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { oldVal } });
                evtgt.dispatchEvent(ev);
            }
        });
        this[REACTIVE_KIT].on('define', (tgt, prop, desc, oldVal) => {
            const evtgt = this._reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { desc, oldVal } });
                evtgt.dispatchEvent(ev);
            }
        });
        this[REACTIVE_KIT].on('array-op', (tgt, method, ...args) => {
            const evtgt = this._reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(ARRAY_OP_TRIGGER, { detail: { method, args } });
                evtgt.dispatchEvent(ev);
            }
        });
    }
}
