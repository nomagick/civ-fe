import { runOncePerClass } from "./lib/once";
import { INJECTED_NS_PREFIX, REACTIVE_TEMPLATE_DOM, REACTIVE_TEMPLATE_SHEET, ReactiveTemplateMixin, identify, mangleSelectorText } from "./lib/dom-template";
import { activateReactivity, initReactivity, REACTIVE_KIT, ReactivityHost } from "./lib/reactive";
import {
    attachedEventName, detachEventName, moveEventName, movedEventName,
    attrToTrait, componentFlagClass, isMagicForAttr, isMagicForTemplateElement,
    significantFlagClass, subtreeTemplateFlagClass,
    Traits, EventHandlerTrait,
} from "./protocol";
import { GeneratorFunction } from "./utils/lang";
import { parseTemplate } from "./utils/template-parser";
import {
    AttrSyncTask, ComponentRenderTask, DomConstructionTask, DomConstructionTaskType,
    DomMaintenanceTask, DomMaintenanceTaskType, ElementReferenceTask, EventBridgeTask,
    ModelSyncTask,
    NodeReplaceTask, PropSyncTask, SetPropTask, SubtreeRenderTask, SubtreeToggleTask, TplSyncTask
} from "./dom";
import { TrieNode } from "./lib/trie";
import { ReactiveAttrMixin, setupAttrObserver } from "./lib/attr";
import { EVENT_EMITTER_REVOKERS, EventEmitter } from "./lib/event-emitter";
import { perNextTick } from "./lib/tick";
import { unwrap } from "./lib/reactive-kit";
import { isPrimitiveLike, mixin } from "./lib/lang";
import { CivFeError } from "./error";
import { mixins } from "./mixins";

type mixins = typeof mixins;
export interface CivComponent extends EventEmitter, ReactivityHost, ReactiveTemplateMixin, ReactiveAttrMixin, mixins { }
export const elementToComponentMap: WeakMap<Element, CivComponent> = new WeakMap();

const forExpRegex = /^(?<expr1>.+?)\s+(?<typ>in|of)\s+(?<expr2>.+)$/;
let serial = 1;

type ExprFn = (this: CivComponent, _ns: Record<string, unknown>, assignment?: unknown) => unknown;
type GenExprFn = (this: CivComponent, _ns: Record<string, unknown>) => Generator;
type WatcherOpts = { signal?: AbortSignal, immediate?: boolean, once?: boolean; };

const ANY_WRITE_OP_TRIGGER = '__civ_any_write_op_trigger__';

const stringProps = new Set([
    'textContent', 'innerHTML', 'innerText', 'value', 'placeholder', 'title', 'aria-label',
    'spellcheck', 'autocapitalize', 'autocomplete', 'autocorrect',
    'lang', 'dir', 'id', 'style',
]);

const moveFunc: <T extends Node>(this: T, node: Node, anchor: Node | null) => T =
    'moveBefore' in Element.prototype ? Element.prototype.moveBefore : Element.prototype.insertBefore as any;

const listenerAddedForTask = new WeakSet<DomMaintenanceTask>();
const reactiveTargets: WeakMap<object, EventTarget> = new WeakMap();
const placeHolderElementToRealElementMap: WeakMap<Node, Node> = new WeakMap();

export const SYM_CIV_COMPONENT = Symbol('CivComponent');

const CIV_ELEMENT_CLS_CACHE = new WeakMap();
const CIV_SCOPED_SHEET_CACHE = new WeakMap<typeof CivComponent, CSSStyleSheet>();

export class CivComponent extends EventTarget {
    static mode: string = 'auto'; // auto | dom | shadow
    static components: Record<string, typeof CivComponent> = {};
    static customElementRegistry: CustomElementRegistry = customElements;
    static expressionMap: Map<string, ExprFn> = new Map();
    static generatorExpressionMap?: Map<string, GenExprFn>;
    static elemTraitsLookup: Map<string, Traits> = new Map();
    readonly serial = serial++;

    get element(): Element {
        if (this instanceof Element) {
            return this;
        }

        return this.__element!;
    }

    protected __element?: Element;

    protected __shadowRoot?: ShadowRoot;
    protected _pendingTasks: DomMaintenanceTask[];
    protected _pendingConstructions: Map<DomConstructionTask | DomMaintenanceTask, DomConstructionTask>;
    protected _signal: AbortSignal;
    protected _revokers: Set<AbortController>;
    protected _subtreeRenderTaskTrack?: WeakMap<SubtreeRenderTask, TrieNode<object, Element>>;
    protected _placeHolderElementToTasksMap?: WeakMap<Element, Set<DomMaintenanceTask>>;
    protected _taskToHostElementMap: WeakMap<DomMaintenanceTask, Element>;
    protected _taskToRevokerMap: WeakMap<DomMaintenanceTask, AbortController>;
    protected _subtreeTaskTrack: WeakMap<Element, Set<DomMaintenanceTask>>;
    protected _nextFrameRecept?: ReturnType<typeof requestAnimationFrame>;

    static customElement<T extends HTMLElement = HTMLElement>(extendsCls: { new(): T; prototype: T; } = HTMLElement as any): {
        [k in keyof typeof CivComponent]: (typeof CivComponent)[k];
    } & { new(): CivComponent & T; prototype: CivComponent & T; } {
        if (CIV_ELEMENT_CLS_CACHE.has(extendsCls)) {
            return CIV_ELEMENT_CLS_CACHE.get(extendsCls)! as any;
        }
        // @ts-ignore
        interface cls extends CivComponent { };
        // @ts-ignore
        class cls extends extendsCls {
            constructor() {
                super();
                this._pendingTasks = [];
                this._pendingConstructions = new Map();
                this._revokers = new Set();
                this._taskToHostElementMap = new WeakMap();
                this._taskToRevokerMap = new WeakMap();
                this._subtreeTaskTrack = new WeakMap();
                this[EVENT_EMITTER_REVOKERS] = new Map();
                Reflect.apply(initReactivity, this, []);
                const constructor = this.constructor as typeof CivComponent;
                this._digestTemplateMagicExpressions(constructor.mode);
                if (constructor.mode === 'shadow') {
                    this._attachShadow();
                }
                this._activateTemplate(constructor.mode);
                if (this.__element) {
                    elementToComponentMap.set(this.__element, this);
                    if ('observedAttributes' in this.constructor) {
                        // @ts-ignore
                        setupAttrObserver.call(this);
                    }
                }
                this._setupReactivity();
                Reflect.apply(activateReactivity, this, []);
                this._digestTasks();
                const abortCtl = new AbortController();
                this._revokers.add(abortCtl);
                this._signal = abortCtl.signal;
            }
        }
        Object.assign(cls, this);
        if (extendsCls !== HTMLElement) {
            const elementName = extendsCls.name.slice('HTML'.length, -('Element'.length)).toLowerCase();
            Reflect.set(cls, SYM_CIV_COMPONENT, elementName);
        }
        mixin(cls.prototype, this.prototype);
        Object.defineProperty(cls, 'name', { value: `Civ${extendsCls.name}`, configurable: true, writable: false });
        CIV_ELEMENT_CLS_CACHE.set(extendsCls, cls as any);

        return cls as any;
    }

    constructor() {
        super();
        this._pendingTasks = [];
        this._pendingConstructions = new Map();
        this._revokers = new Set();
        this._taskToHostElementMap = new WeakMap();
        this._taskToRevokerMap = new WeakMap();
        this._subtreeTaskTrack = new WeakMap();
        this[EVENT_EMITTER_REVOKERS] = new Map();
        Reflect.apply(initReactivity, this, []);
        const constructor = this.constructor as typeof CivComponent;
        this._digestTemplateMagicExpressions(constructor.mode);
        if (constructor.mode === 'shadow') {
            this._attachShadow();
        }
        this._activateTemplate(constructor.mode);
        if (this.__element) {
            elementToComponentMap.set(this.__element, this);
            if ('observedAttributes' in this.constructor) {
                // @ts-ignore
                setupAttrObserver.call(this);
            }
        }
        this._setupReactivity();
        Reflect.apply(activateReactivity, this, []);
        this._digestTasks();
        const abortCtl = new AbortController();
        this._revokers.add(abortCtl);
        this._signal = abortCtl.signal;
    }

    protected _attachShadow() {
        // @ts-ignore
        this.__shadowRoot = this.attachShadow({ mode: 'open', registry: (this.constructor as typeof CivElement).customElementRegistry });

        const sheet = this[REACTIVE_TEMPLATE_SHEET];
        if (sheet) {
            if (!sheet.sheet) {
                sheet.sheet = new CSSStyleSheet();
                sheet.sheet.replaceSync(sheet.text);
            }
            this.__shadowRoot!.adoptedStyleSheets.push(sheet.sheet);
        }

        return this.__shadowRoot!;
    }

    foreign(eventTarget: ReactivityHost) {
        const abortCtl = this[REACTIVE_KIT].connect(eventTarget[REACTIVE_KIT]);
        this._revokers.add(abortCtl);

        return abortCtl;
    }

    replaceElement(el: Element, relTask?: ComponentRenderTask) {
        const targetElement = this.element;

        const attributes = el.attributes;
        for (let i = attributes.length - 1; i >= 0; i--) {
            const attr = attributes[i];
            if (attr.name === 'class') {
                continue;
            }
            el.removeAttributeNode(attr);
            targetElement.setAttributeNode(attr);
        }
        const compCls = this.constructor as typeof CivComponent;
        const clsId = identify(compCls);
        for (let i = 0; i < el.classList.length; i++) {
            const cls = el.classList[i];
            targetElement.classList.add(cls);
        }

        if (this.__shadowRoot) {
            // @ts-ignore
            targetElement.append(...el.childNodes);
        } else {
            // "class" attribute could have been replaced, loosing class identifier, adding it back here
            this.element.classList.add(clsId);
            const namedTemplates = el.querySelectorAll<HTMLElement>(`:scope>[slot]:not([slot=""])`);
            if (namedTemplates.length) {
                namedTemplates.forEach((el) => el.remove());
            }
            const defaultSlot = targetElement.querySelector<HTMLElement>('slot:not([name])');
            if (defaultSlot) {
                // defaultSlot.classList.add(`${clsId}__slotted`);
                const nodes: Node[] = [];
                el.childNodes.forEach((node) => {
                    nodes.push(node);
                });
                defaultSlot.replaceChildren(...nodes);
            } else if (!namedTemplates.length && el.childElementCount) {
                console.warn(`Component ${clsId} has no default slot, but has child elements. These elements will be ignored.`);
            }

            namedTemplates.forEach((template) => {
                const slotAttr = template.getAttribute('slot');
                if (!slotAttr) {
                    return;
                }
                const targetSlot = targetElement.querySelector<HTMLElement>(`slot[name="${slotAttr}"]`);
                if (!targetSlot) {
                    return;
                }
                // targetSlot.classList.add(`${clsId}__slotted`);
                targetSlot.replaceChildren(template);
            });
        }

        const taskSet = this._subtreeTaskTrack.get(el);
        if (taskSet) {
            this._subtreeTaskTrack.set(targetElement, taskSet);
            for (const t of taskSet) {
                this._taskToHostElementMap.set(t, targetElement);
            }
        }

        const tsk: NodeReplaceTask = {
            type: DomConstructionTaskType.REPLACE,
            tgt: el,
            sub: targetElement,
        };
        this._setConstruction(relTask || tsk, tsk);

        return targetElement;
    }

    protected _cleanup() {
        for (const x of this._revokers) {
            x.abort();
        }
    }

    cleanup() {
        return this._cleanup();
    }

    watch<T extends keyof this>(prop: T, cb: (newVal: this[T], oldVal: this[T]) => void, opts?: WatcherOpts): void;
    watch<P extends object, T extends keyof P>(prop: T, ref: P, cb: (newVal: P[T], oldVal: P[T]) => void, opts?: WatcherOpts): void;
    watch() {
        let prop: string = arguments[0];
        let ref: object = this;
        let cb;
        let opts: WatcherOpts = {};
        if (typeof arguments[1] === 'object') {
            [, ref, cb, opts] = arguments;
        } else {
            [, cb, opts] = arguments;
        }
        const finalRef = ref === this ? this[REACTIVE_KIT].target : unwrap(ref);

        this[REACTIVE_KIT].addEventListener('change', (event) => {
            const [tgt, propName, newVal, oldVal] = (event as CustomEvent).detail;
            if (tgt === finalRef && propName === prop) {
                cb(newVal, oldVal);
            }
        }, { signal: opts?.signal || this._signal, once: opts?.once });
        if (opts?.immediate) {
            cb(Reflect.get(finalRef, prop), undefined);
        }
    }

    domEmit(eventName: string, ...args: unknown[]) {
        const event = new CustomEvent(eventName, {
            composed: true,
            detail: args,
            bubbles: true,
        });
        let elem: Element;
        try {
            // @ts-ignore
            elem = $element;
        } catch {
            // $element is not defined, fallback to this.element
            elem = this.element;
        }
        elem.dispatchEvent(event);
    }

    [Symbol.dispose]() {
        this.cleanup();
    }
    async [Symbol.asyncDispose]() {
        this[Symbol.dispose]();
    }

    protected get _expressionMap() {
        return (this.constructor as typeof CivComponent).expressionMap;
    }
    protected get _generatorExpressionMap() {
        return (this.constructor as typeof CivComponent).generatorExpressionMap;
    }
    protected get _elemTraitsLookup() {
        return (this.constructor as typeof CivComponent).elemTraitsLookup;
    }
    protected get _components() {
        return (this.constructor as typeof CivComponent).components;
    }

    @runOncePerClass
    protected _digestTemplateMagicExpressions(mode: string) {
        const constructor = this.constructor as typeof CivComponent;
        if (constructor.hasOwnProperty('components')) {
            const components = constructor.components;
            for (const [k, v] of Object.entries(components)) {
                Reflect.set(components, k.toUpperCase(), v);
            }
        }
        if (!Object.getPrototypeOf(this).hasOwnProperty(REACTIVE_TEMPLATE_DOM)) {
            return;
        }
        const dom = this[REACTIVE_TEMPLATE_DOM];
        if (!dom) {
            return;
        }

        for (const attr of Array.from(dom.documentElement.attributes)) {
            if (attr.name.startsWith('xmlns') && attr.value.startsWith(INJECTED_NS_PREFIX)) {
                dom.documentElement.removeAttributeNode(attr);
            }
        }
        const slotPresent = dom.querySelector('slot') !== null;
        if (mode === 'auto') {
            mode = (this instanceof HTMLElement && (slotPresent || typeof Reflect.get(constructor, SYM_CIV_COMPONENT) !== 'string')) ? 'shadow' : 'dom';
            Reflect.set(constructor, 'mode', mode);
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

        if (!constructor.hasOwnProperty('expressionMap')) {
            constructor.expressionMap = new Map();
        }
        const expressionMap = constructor.expressionMap;
        const generatorExpressionMap = new Map();
        if (!constructor.hasOwnProperty('elemTraitsLookup')) {
            constructor.elemTraitsLookup = new Map();
        }
        const elemTraitsLookup = constructor.elemTraitsLookup;
        const elemTraitsMap: Map<Element, Traits> = new Map();
        const components = constructor.components;

        let elem = walker.currentNode as Element | Text;
        do {
            if (elem instanceof Text) {
                const tpl = elem.textContent || '';
                const parsed = parseTemplate(tpl);
                if (!parsed.length || !parsed.some((x) => x.type === 'expression')) {
                    continue;
                }

                const exprFn = new Function(
                    `with(this) {
                        with(arguments[0]) {
                            return [${parsed.map((x) => x.type === 'expression' ? x.value : JSON.stringify(x.value)).join(', ')}];
                            }
                        }`) as ExprFn;
                expressionMap.set(tpl, exprFn);
                const parentTraits = elemTraitsMap.get(elem.parentElement!) || [];
                parentTraits.push(['tpl']);
                elemTraitsMap.set(elem.parentElement!, parentTraits);
                elem.parentElement!.classList.add(significantFlagClass);

                continue;
            }
            const elemTraits: Traits = [];
            const magicAttrs: Attr[] = [];
            if (Reflect.get(components, elem.tagName.toUpperCase())) {
                elem.classList.add(componentFlagClass);
            }

            for (let i = 0; i < elem.attributes.length; i++) {
                const attr = elem.attributes[i];
                const name = attr.name;
                const expr = attr.value.trim();

                const trait = attrToTrait(name, expr);
                if (!trait) {
                    continue;
                }
                elemTraits.push(trait);
                magicAttrs.push(attr);
                if (trait.length === 1 || !trait.includes(expr)) {
                    continue;
                }
                if (!expr) {
                    continue;
                }
                if (trait[0] === 'model') {
                    // Model sync expr have assignment capability
                    expressionMap.set(expr, new Function(
                        `with(this) { with(arguments[0]) { if (arguments.length >= 2) { ${expr} = arguments[1];} return ${expr}; } }`
                    ) as ExprFn);
                }

                if (isMagicForAttr(name)) {
                    if (generatorExpressionMap.has(expr)) {
                        elem.classList.add(subtreeTemplateFlagClass);
                        continue;
                    }
                    const matched = expr.match(forExpRegex);
                    if (!matched) {
                        throw new Error(`Invalid expression for *for: ${expr}`);
                    }
                    elem.classList.add(subtreeTemplateFlagClass);
                    const { expr1, typ, expr2 } = matched.groups!;
                    const genFn = new GeneratorFunction(`with(this) { with(arguments[0]) { const __iterable_ = ${expr2}; yield __iterable_; for (${expr1} ${typ} __iterable_) { yield arguments[0]; } } }`) as unknown as GenExprFn;
                    Object.defineProperty(genFn, 'name', {
                        value: `*${genFn.name}`,
                        configurable: true
                    });
                    generatorExpressionMap.set(expr, genFn);
                } else if (!expressionMap.has(expr)) {
                    expressionMap.set(expr, new Function(
                        `with(this) { with(arguments[0]) { return ${expr}; } }`
                    ) as ExprFn);
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
        for (const [k, v] of elemTraitsMap) {
            const sn = `${serial++}`;
            k.setAttribute(significantFlagClass, sn);
            elemTraitsLookup.set(sn, v);
        }
        const sheet = this[REACTIVE_TEMPLATE_SHEET];
        if (sheet && mode === 'dom') {
            if (!sheet.scopedText) {
                const tempSheet = new CSSStyleSheet();
                tempSheet.replaceSync(sheet.text);
                mangleSelectorText(tempSheet.cssRules, 'toScoped');
                const cssTexts: string[] = [];
                for (const cssRule of tempSheet.cssRules) {
                    cssTexts.push(cssRule.cssText);
                }
                sheet.scopedText = cssTexts.join('\n');
            }
            let scopedSheet = CIV_SCOPED_SHEET_CACHE.get(constructor);
            if (!scopedSheet) {
                scopedSheet = new CSSStyleSheet();
                const customElementName = constructor.customElementRegistry.getName(constructor as any);
                let selector = Reflect.get(constructor, SYM_CIV_COMPONENT);
                if (typeof selector !== 'string') {
                    selector = customElementName;
                } else {
                    if (!customElementName) {
                        throw new Error(`Component ${identify(constructor)} is defined to extend ${selector}, but not registered as custom element.`);
                    }
                    selector = `${selector}[is="${customElementName}"]`;
                }
                if (!selector) {
                    selector = `.${identify(constructor)}`;
                }
                scopedSheet.replaceSync(`@scope (${selector}) {\n${sheet.scopedText}\n}\n`);
                CIV_SCOPED_SHEET_CACHE.set(constructor, scopedSheet);
            }
            if (!document.adoptedStyleSheets.includes(scopedSheet)) {
                document.adoptedStyleSheets.push(scopedSheet);
            }
        }
        if (generatorExpressionMap.size) {
            constructor.generatorExpressionMap = generatorExpressionMap;
        }
    }

    protected _activateTemplate(mode: string) {
        const tplDom = this[REACTIVE_TEMPLATE_DOM];
        const constructor = this.constructor as typeof CivComponent;
        if (!tplDom) {
            if (this instanceof Element) {
                if (this.__shadowRoot) {
                    return;
                }
                const registeredName = constructor.customElementRegistry.getName(constructor as any);
                if (registeredName) {
                    this.setAttribute('is', registeredName);
                } else {
                    this.classList.add(identify(constructor));
                }
                return;
            }
            if (mode === 'dom') {
                const elem = document.createElement(`div`);
                elem.classList.add(identify(constructor));
                this.__element = elem;
            } else if (mode === 'shadow') {
                const elem = document.createElement(`div`);
                this.__shadowRoot?.append(elem);
            }

            return;
        }

        if ((this instanceof Element) || this.__shadowRoot) {
            const tgt: Element | ShadowRoot = this.__shadowRoot || this as any;
            if (tplDom instanceof XMLDocument) {
                tgt.append(document.importNode(tplDom.documentElement, true));
            } else if (tplDom.body.firstChild) {
                for (const x of tplDom.body.childNodes) {
                    tgt.append(document.importNode(x, true));
                }
            } else {
                tgt.append(document.importNode(tplDom.head, true));
            }
        } else {
            const tgtNode = tplDom instanceof XMLDocument ?
                tplDom.documentElement : (tplDom.body.firstElementChild || tplDom.head);
            const rootElement = document.importNode(tgtNode, true);
            if (isMagicForTemplateElement(rootElement)) {
                throw new Error(`Template for component ${identify(this.constructor as typeof CivComponent)} cannot be a *for template.`);
            }
            this.__element = rootElement;
        }


        if (mode === 'dom') {
            this.element.classList.add(identify(this.constructor as typeof CivComponent));
        }

        this._renderTemplateElem();
    }

    protected _trackTask(task: DomMaintenanceTask, hostElem: Element) {
        this._pendingTasks.push(task);
        this._taskToHostElementMap.set(task, hostElem);
        if (task.type === DomMaintenanceTaskType.COMPONENT_RENDER) {
            this._placeHolderElementToTasksMap ??= new WeakMap();
            this._placeHolderElementToTasksMap.set(task.sub, new Set());
        } else if (task.type === DomMaintenanceTaskType.SUBTREE_TOGGLE) {
            for (const [, el] of task.exprGroup) {
                if (this._placeHolderElementToTasksMap?.has(el)) {
                    this._placeHolderElementToTasksMap.get(el)!.add(task);
                }
            }
        } else if ('tgt' in task && this._placeHolderElementToTasksMap?.has(task.tgt as any)) {
            this._placeHolderElementToTasksMap.get(task.tgt as any)!.add(task);
        }

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
    protected _setConstruction(rel: DomConstructionTask | DomMaintenanceTask, task: DomConstructionTask) {
        this._pendingConstructions.set(rel, task);
    }

    protected _renderTemplateElem(inputElem?: Element, ns?: Record<string, unknown>) {
        const host = inputElem ?? (this.__shadowRoot || this.element);
        if (!host) {
            throw new Error('Unexpected condition: host node unidentified');
        }
        const elem = (host === this.__shadowRoot ? this : host) as Element;
        const elemTraitsLookup = this._elemTraitsLookup;
        const expressionMap = this._expressionMap;
        let el;
        while (el = host.querySelector(`.${subtreeTemplateFlagClass}`)) {
            const start = document.createComment(`=== Start ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            const end = document.createComment(`=== End ${identify(this.constructor as typeof CivComponent)} ${el.getAttribute(significantFlagClass) || ''}`);
            el.before(start);
            el.after(end);
            const parent = el.parentElement!;
            el.remove();
            el.classList.remove(subtreeTemplateFlagClass);

            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                throw new Error(`Invalid template, unknown elSerial for element in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const [, expr, nsJoint] = elemTraitsLookup.get(elSerial)?.find(([t]) => t === 'for') || [];
            if (!expr) {
                throw new Error(`Cannot find *for expression for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const injectNs = nsJoint?.split(',').filter(Boolean);
            if (!injectNs?.length) {
                throw new Error(`Invalid *for expression: ${expr} for element with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
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

        const compHdl = (el: Element) => {
            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                throw new Error(`Element with component flag does not have a significant flag class in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const traits = elemTraitsLookup.get(elSerial) || [];
            this._trackTask({
                type: DomMaintenanceTaskType.COMPONENT_RENDER,
                sub: el,
                comp: el.tagName.toUpperCase(),
                traits,
                ns
            }, elem);
        };
        if (elem.classList.contains(componentFlagClass)) {
            compHdl(elem);
        }
        host.querySelectorAll(`.${componentFlagClass}`).forEach(compHdl);

        const handler = (el: Element) => {
            const elSerial = el.getAttribute(significantFlagClass) || '';
            if (!elSerial) {
                return;
            }
            const traits = elemTraitsLookup.get(elSerial);
            if (!traits) {
                throw new Error(`Cannot find traits for element ${el.tagName} with serial ${elSerial} in component ${identify(this.constructor as typeof CivComponent)}`);
            }
            const hasPlainTrait = traits.some(([trait]) => trait === 'plain');
            for (const [trait, ...args] of traits) {
                switch (trait) {
                    case 'attr': {
                        const [attrName, expr] = args;
                        if (attrName === 'class') {
                            this._trackTask({
                                type: DomMaintenanceTaskType.PROP_SYNC,
                                tgt: el,
                                prop: 'classList',
                                expr,
                                ns,
                            }, elem);
                            break;
                        } else if (attrName === 'style') {
                            this._trackTask({
                                type: DomMaintenanceTaskType.PROP_SYNC,
                                tgt: el,
                                prop: 'style',
                                expr,
                                ns,
                            }, elem);
                            break;
                        }
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
                        let mappedPropName = propName;
                        if (mappedPropName.includes('-')) {
                            mappedPropName = mappedPropName.replaceAll(/-+([a-z])/g, (_match, p1) => p1.toUpperCase());
                        }
                        this._trackTask({
                            type: DomMaintenanceTaskType.PROP_SYNC,
                            tgt: el,
                            prop: mappedPropName,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'model': {
                        const [expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.MODEL_SYNC,
                            tgt: el,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    case 'event': {
                        const [eventName, expr, ...evTraits] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: el,
                            event: eventName,
                            expr,
                            evTraits: evTraits as EventHandlerTrait[],
                            ns,
                        }, elem);
                        break;
                    }
                    case 'documentEvent': {
                        const [eventName, expr, ...evTraits] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.EVENT_BRIDGE,
                            tgt: document,
                            event: eventName,
                            expr,
                            evTraits: evTraits as EventHandlerTrait[],
                            ns,
                        }, elem);
                        break;
                    }
                    case 'if': {
                        const [expr] = args;
                        const exprGroup: [string, Element][] = [
                            [expr, el]
                        ];
                        let ptr: ChildNode | null = el;
                        while (ptr = ptr.nextSibling) {
                            if (ptr instanceof Comment) {
                                continue;
                            } else if (ptr instanceof Text) {
                                if (ptr.textContent?.trim()) {
                                    break;
                                }
                                continue;
                            }
                            if (ptr instanceof Element) {
                                const elSerial = ptr.getAttribute(significantFlagClass);
                                if (!elSerial) {
                                    break;
                                }
                                const traits = elemTraitsLookup.get(elSerial);
                                const elifTrait = traits?.find(([t]) => t === 'elif');
                                if (elifTrait) {
                                    const [, expr] = elifTrait;
                                    exprGroup.push([expr, ptr]);
                                    continue;
                                }

                                const elseTrait = traits?.find(([t]) => t === 'else');
                                if (elseTrait) {
                                    exprGroup.push(['', ptr]);
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
                        for (const node of el.childNodes) {
                            if (!(node instanceof Text)) {
                                continue;
                            }
                            if (!node.textContent) {
                                continue;
                            }

                            if (expressionMap.has(node.textContent)) {
                                this._trackTask({
                                    type: DomMaintenanceTaskType.TPL_SYNC,
                                    text: node,
                                    expr: node.textContent,
                                    ns,
                                }, elem);
                            }
                        }

                        break;
                    }
                    case 'ref': {
                        const [expr] = args;
                        this._trackTask({
                            type: DomMaintenanceTaskType.ELEMENT_REF,
                            tgt: el,
                            expr,
                            ns,
                        }, elem);
                        break;
                    }
                    default: {
                        break;
                    }
                }
            }

            // TODO: check if it makes sense to keep these
            el.classList.remove(significantFlagClass);
            if (el.classList.length === 0) {
                el.removeAttribute('class');
            }
            el.removeAttribute(significantFlagClass);
        };

        handler.call(this, elem);
        host.querySelectorAll(`.${significantFlagClass}`).forEach(handler);
    }

    protected _evaluateExpr(expr: string, ns: Record<string, unknown> = Object.create(null), noListen?: unknown, assignment?: unknown) {
        if (!expr) {
            return { value: expr, vecs: [] };
        }
        const fn = this._expressionMap.get(expr);
        if (!fn) {
            throw new Error(`Cannot find eval function for expression: ${expr}`);
        }

        if (fn.name.startsWith('*')) {
            throw new Error(`Cannot evaluate generator function: ${fn.name}. Use _evaluateForExpr instead.`);
        }

        if (noListen) {
            if (arguments.length >= 4) {
                return { value: fn.call(this, ns, assignment), vecs: [] };
            }
            return { value: fn.call(this, ns), vecs: [] };
        }

        const dedup = new Map<object, Set<string>>();
        const vecs: [object, string][] = [];

        const hdl = (tgt: object, prop: string) => {
            const s = dedup.get(tgt);
            if (!s) {
                dedup.set(tgt, new Set([prop]));
                vecs.push([tgt, prop]);
                return;
            }
            if (s.has(prop)) {
                return;
            }
            s.add(prop);
            vecs.push([tgt, prop]);
        };

        this[REACTIVE_KIT].on('access', hdl);
        let r;
        try {
            r = arguments.length >= 4 ? fn.call(this, ns, assignment) : fn.call(this, ns);
        } catch (error) {
            const err = CivFeError.from(error);
            err.message = `[TPL expr: ${expr}] ${err.message}`;
            // @ts-ignore
            if (Error.captureStackTrace) {
                // @ts-ignore
                Error.captureStackTrace(err, fn);
            }
            throw err;
        } finally {
            this[REACTIVE_KIT].off('access', hdl);
        }

        return { value: r, vecs };
    }

    protected *_evaluateForExpr(expr: string, ns: Record<string, unknown> = Object.create(null)) {
        const fn = this._generatorExpressionMap?.get(expr);
        if (!fn) {
            throw new Error(`Cannot find generator function for expression: ${expr}`);
        }

        if (!fn.name.startsWith('*')) {
            throw new Error(`Cannot evaluate non generator function: ${fn.name}. Use _evaluateExpr instead.`);
        }

        const dedup = new Map<object, Set<string>>();
        const vecs: [object, string][] = [];

        const hdl = (tgt: object, prop: string) => {
            const s = dedup.get(tgt);
            if (!s) {
                dedup.set(tgt, new Set([prop]));
                vecs.push([tgt, prop]);
                return;
            }
            if (s.has(prop)) {
                return;
            }
            s.add(prop);
            vecs.push([tgt, prop]);
        };
        this[REACTIVE_KIT].on('access', hdl);
        let it, initialYield;
        try {
            it = fn.call(this, ns) as Generator;
            initialYield = it.next();
        } catch (error) {
            const err = CivFeError.from(error);
            err.message = `[TPL expr: ${expr}] ${err.message}`;
            // @ts-ignore
            if (Error.captureStackTrace) {
                // @ts-ignore
                Error.captureStackTrace(err, fn);
            }
            throw err;
        } finally {
            this[REACTIVE_KIT].off('access', hdl);
        }

        yield { value: initialYield.value, vecs, ns };

        const dDedup = new Map<object, Set<string>>();
        const dVecs: [object, string][] = [];
        const dhdl = (tgt: object, prop: string) => {
            const s1 = dedup.get(tgt);
            if (s1 && s1.has(prop)) {
                return;
            }
            const s2 = dDedup.get(tgt);
            if (!s2) {
                dDedup.set(tgt, new Set([prop]));
                dVecs.push([tgt, prop]);
                return;
            }
            if (s2.has(prop)) {
                return;
            }
            s2.add(prop);
            dVecs.push([tgt, prop]);
        };
        this[REACTIVE_KIT].on('access', dhdl);

        try {
            for (const x of it) {
                yield { value: x, vecs: vecs.concat(dVecs), ns };
                dVecs.length = 0;
                dDedup.clear();
            }
        } catch (error) {
            const err = CivFeError.from(error);
            err.message = `[TPL iter: ${expr}] ${err.message}`;
            // @ts-ignore
            if (Error.captureStackTrace) {
                // @ts-ignore
                Error.captureStackTrace(err, fn);
            }
            throw err;
        } finally {
            this[REACTIVE_KIT].off('access', dhdl);
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
            this._digestTasks();
        };

        for (const [tgt, prop] of vecs) {
            let evtgt = reactiveTargets.get(tgt);
            if (!evtgt) {
                evtgt = new EventTarget();
                reactiveTargets.set(tgt, evtgt);
            }
            evtgt.addEventListener(prop, handler, { signal: abortCtl.signal, once: true });
        }
        this._taskToRevokerMap.set(task, abortCtl);

        return abortCtl;
    }

    protected _handleSubtreeRenderTask(task: SubtreeRenderTask) {
        const nsObj: Record<string, unknown> = Object.create(task.ns || null);
        const it = this._evaluateForExpr(task.expr, nsObj);

        const initialYield = it.next().value;
        if (!initialYield) {
            throw new Error(`Invalid *for expression: ${task.expr} in component ${identify(this.constructor as typeof CivComponent)}`);
        }
        let equivalentIterable = initialYield.value;
        if (!equivalentIterable) {
            it.return();
        }
        let isReactive = false;
        if (initialYield.vecs.length) {
            const vecs = [...initialYield.vecs];
            isReactive = true;
            if (initialYield.value instanceof Iterator) {
                const lastVec = vecs[vecs.length - 1];
                const bv = lastVec[0];
                vecs.push([bv, ANY_WRITE_OP_TRIGGER]);
                equivalentIterable = bv;
            } else if (equivalentIterable && Symbol.iterator in equivalentIterable) {
                const unwrapped = unwrap(equivalentIterable);
                if (unwrapped !== equivalentIterable) {
                    equivalentIterable = unwrapped;
                    vecs.push([unwrapped, ANY_WRITE_OP_TRIGGER]);
                }
            }

            this._setupTaskRecurrence(task, vecs);
        } else if (equivalentIterable && Symbol.iterator in equivalentIterable) {
            const unwrapped = unwrap(equivalentIterable);
            if (unwrapped !== equivalentIterable) {
                isReactive = true;
                equivalentIterable = unwrapped;
                this._setupTaskRecurrence(task, [[unwrapped, ANY_WRITE_OP_TRIGGER]]);
            }
        }
        this._subtreeRenderTaskTrack ??= new WeakMap();
        const previousTrie = this._subtreeRenderTaskTrack.get(task);
        const nextTrie = new TrieNode<object, Element>(equivalentIterable as Iterable<unknown>);

        const newSequence: Node[] = [];
        const nodeSet = new WeakSet();

        if (equivalentIterable) {
            for (const identifier of task.injectNs) {
                Reflect.set(nsObj, identifier, undefined);
            }
        }
        for (const _x of it) {
            const cloneNs = Object.create(task.ns || null);
            Object.assign(cloneNs, nsObj);
            const series = task.injectNs.map((x) => Reflect.get(cloneNs, x));

            const n = previousTrie?.seek(...series);
            if (n?.found && n.payload) {
                nextTrie.insert(...series).payload = n.payload;
                if (nodeSet.has(n.payload)) {
                    const subTreeElem = task.tpl.cloneNode(true) as Element;
                    this._renderTemplateElem(subTreeElem, cloneNs);
                    newSequence.push(subTreeElem);
                    nodeSet.add(subTreeElem);
                    continue;
                }
                newSequence.push(n.payload);
                nodeSet.add(n.payload);
                continue;
            }

            const subTreeElem = task.tpl.cloneNode(true) as Element;
            this._renderTemplateElem(subTreeElem, cloneNs);
            nextTrie.insert(...series).payload = subTreeElem;
            newSequence.push(subTreeElem);
            nodeSet.add(subTreeElem);
        }

        this._setConstruction(task, {
            type: DomConstructionTaskType.SEQUENCE_MANGLE,
            anchor: task.anchor,
            seq: newSequence,
        });

        if (isReactive) {
            this._subtreeRenderTaskTrack.set(task, nextTrie);
        } else {
            this._subtreeRenderTaskTrack.delete(task);
            this._untrackTask(task);
        }
    }

    protected _handleComponentRenderTask(task: ComponentRenderTask) {
        this._untrackTask(task);
        let compCls = this._components[task.comp];
        if (!compCls) {
            const customCls = (this.constructor as typeof CivComponent).customElementRegistry.get(task.comp);
            if (!customCls) {
                return;
            }
            compCls = customCls as any;
        }
        const el = task.sub;
        const instance = Reflect.construct(compCls, []) as CivComponent;
        const newEl = instance.replaceElement(el);
        placeHolderElementToRealElementMap.set(el, newEl);
        const relTasks = this._placeHolderElementToTasksMap?.get(el);
        if (relTasks?.size) {
            for (const t of relTasks) {
                if (t.type === DomMaintenanceTaskType.SUBTREE_TOGGLE) {
                    for (const pair of t.exprGroup) {
                        if (pair[1] === el) {
                            pair[1] = newEl;
                        }
                    }
                } else if (t.type === DomMaintenanceTaskType.PROP_SYNC) {
                    t.tgt = instance;
                } else if ('tgt' in t) {
                    t.tgt = newEl;
                }
            }
        }
    }

    protected _handleAttrSyncTask(task: AttrSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        this._setConstruction(task, {
            type: DomConstructionTaskType.SET_ATTR,
            sub: task.attr,
            val: (value === undefined || value === null) ? '' : value,
        });
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handlePropSyncTask(task: PropSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        if (task.tgt instanceof Node) {
            const curVal = Reflect.get(task.tgt, task.prop);
            if (curVal instanceof DOMTokenList) {
                this._setConstruction(task, {
                    type: DomConstructionTaskType.SET_PROP,
                    sub: task.tgt,
                    prop: task.prop,
                    val: value,
                    fn: DOMTokenListSync,
                });
            } else if (curVal instanceof CSSStyleDeclaration) {
                this._setConstruction(task, {
                    type: DomConstructionTaskType.SET_PROP,
                    sub: task.tgt,
                    prop: task.prop,
                    val: value,
                    fn: CSSStyleDeclarationSync,
                });
            } else {
                let normalizedValue = value;

                if (stringProps.has(task.prop) && (normalizedValue === undefined || normalizedValue === null)) {
                    normalizedValue = '';
                }
                this._setConstruction(task, {
                    type: DomConstructionTaskType.SET_PROP,
                    sub: task.tgt,
                    prop: task.prop,
                    val: normalizedValue,
                });
            }
        } else {
            Reflect.set(task.tgt, task.prop, value);
        }
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handleModelSyncTask(task: ModelSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        const el = task.tgt;

        let recur = true;

        if (el instanceof HTMLInputElement) {
            switch (el.type) {
                case 'checkbox': {
                    if (!listenerAddedForTask.has(task)) {
                        el.addEventListener('change', (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            if (target.value === 'on') {
                                this._evaluateExpr(task.expr, task.ns, true, target.checked);
                            } else {
                                const { value } = this._evaluateExpr(task.expr, task.ns, true);
                                if (Array.isArray(value)) {
                                    if (target.checked && !value.includes(target.value)) {
                                        value.push(target.value);
                                    } else if (!target.checked && value.includes(target.value)) {
                                        const index = value.indexOf(target.value);
                                        if (index !== -1) {
                                            value.splice(index, 1);
                                        }
                                    }
                                } else if (value && value !== target.value) {
                                    this._evaluateExpr(task.expr, task.ns, true, target.checked ? [value, target.value] : value);
                                } else if (!value) {
                                    this._evaluateExpr(task.expr, task.ns, true, target.checked ? target.value : '');
                                }
                            }
                        }, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }
                    this._setConstruction(task, {
                        type: DomConstructionTaskType.SET_PROP,
                        sub: el,
                        prop: 'checked',
                        val: value,
                        fn: checkboxInputSync
                    });
                    break;
                }
                case 'radio': {
                    if (!listenerAddedForTask.has(task)) {
                        el.addEventListener('change', (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            const equiv = target.value === 'on' ? target.checked : target.value;
                            this._evaluateExpr(task.expr, task.ns, true, equiv);
                        }, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }
                    this._setConstruction(task, {
                        type: DomConstructionTaskType.SET_PROP,
                        sub: el,
                        prop: 'checked',
                        val: value,
                        fn: checkboxInputSync,
                    });
                    break;
                }
                case 'image': {
                    recur = false;
                    break;
                }
                case 'file': {
                    if (!listenerAddedForTask.has(task)) {
                        el.addEventListener('change', (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            this._evaluateExpr(task.expr, task.ns, true, Array.from(target.files || []));
                        }, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }
                    recur = false;
                    break;
                }

                case 'number': {
                    if (!listenerAddedForTask.has(task)) {
                        el.addEventListener('change', (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            this._evaluateExpr(task.expr, task.ns, true, target.valueAsNumber);
                        }, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }

                    this._setConstruction(task, {
                        type: DomConstructionTaskType.SET_PROP,
                        sub: el,
                        prop: 'value',
                        val: (value === undefined || value === null) ? '' : String(value),
                    });
                    break;
                }

                case 'week':
                case 'month':
                case 'datetime-local':
                case 'datetime':
                case 'date': {
                    if (!listenerAddedForTask.has(task)) {
                        el.addEventListener('change', (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            this._evaluateExpr(task.expr, task.ns, true, target.valueAsDate);
                        }, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }

                    this._setConstruction(task, {
                        type: DomConstructionTaskType.SET_PROP,
                        sub: el,
                        prop: 'value',
                        val: (value === undefined || value === null) ? '' : String(value),
                    });
                    break;
                }
                default: {
                    if (!listenerAddedForTask.has(task)) {
                        const hdl = (e: Event) => {
                            const target = this.getEventTarget<HTMLInputElement>(e);
                            this._evaluateExpr(task.expr, task.ns, true, target.value);
                        };
                        el.addEventListener('change', hdl, { signal: this._signal });
                        el.addEventListener('input', hdl, { signal: this._signal });
                        listenerAddedForTask.add(task);
                    }
                    this._setConstruction(task, {
                        type: DomConstructionTaskType.SET_PROP,
                        sub: el,
                        prop: 'value',
                        val: (value === undefined || value === null) ? '' : String(value),
                    });
                    break;
                }
            }
        } else if (el instanceof HTMLSelectElement) {
            if (el.multiple) {
                if (!listenerAddedForTask.has(task)) {
                    el.addEventListener('change', (e: Event) => {
                        const target = this.getEventTarget<HTMLSelectElement>(e);
                        const { value } = this._evaluateExpr(task.expr, task.ns, true);
                        if (Array.isArray(value)) {
                            value.length = 0;
                            value.push(...Array.from(target.selectedOptions).map((x) => x.value));
                        } else {
                            this._evaluateExpr(task.expr, task.ns, true, Array.from(target.selectedOptions).map((x) => x.value));
                        }
                    }, { signal: this._signal });
                    listenerAddedForTask.add(task);
                }
                this._setConstruction(task, {
                    type: DomConstructionTaskType.SET_PROP,
                    sub: el,
                    prop: 'options',
                    val: value,
                    fn: selectOptionsSync,
                });
            } else {
                if (!listenerAddedForTask.has(task)) {
                    el.addEventListener('change', (e: Event) => {
                        const target = this.getEventTarget<HTMLSelectElement>(e);
                        this._evaluateExpr(task.expr, task.ns, true, target.value);
                    }, { signal: this._signal });
                    listenerAddedForTask.add(task);
                }
                this._setConstruction(task, {
                    type: DomConstructionTaskType.SET_PROP,
                    sub: el,
                    prop: 'value',
                    val: (value === undefined || value === null) ? '' : String(value),
                });
            }
        } else {
            if (!listenerAddedForTask.has(task)) {
                const hdl = (e: Event) => {
                    const target = this.getEventTarget<HTMLInputElement>(e);
                    this._evaluateExpr(task.expr, task.ns, true, target.value);
                };
                el.addEventListener('change', hdl, { signal: this._signal });
                el.addEventListener('input', hdl, { signal: this._signal });
                listenerAddedForTask.add(task);
            }
            this._setConstruction(task, {
                type: DomConstructionTaskType.SET_PROP,
                sub: el,
                prop: 'value',
                val: (value === undefined || value === null) ? '' : String(value),
            });
        }

        if (recur) {
            this._setupTaskRecurrence(task, vecs);
        } else {
            this._untrackTask(task);
        }
    }


    protected _handleTplSyncTask(task: TplSyncTask) {
        const { vecs, value } = this._evaluateExpr(task.expr, task.ns);
        let normalizedValue = value;
        if (Array.isArray(value)) {
            normalizedValue = value.map((x) => {
                if (x === undefined || x === null) {
                    return '';
                }
                if (typeof x === 'object') {
                    if (!isPrimitiveLike(x)) {
                        vecs.push([unwrap(x), ANY_WRITE_OP_TRIGGER]);
                    }
                    return JSON.stringify(x);
                }

                return String(x);
            }).join('');
        }

        this._setConstruction(task, {
            type: DomConstructionTaskType.SET_PROP,
            sub: task.text,
            prop: 'nodeValue',
            val: normalizedValue,
        });
        this._setupTaskRecurrence(task, vecs);
    }

    protected _handleSubtreeToggleTask(task: SubtreeToggleTask) {
        const allVecs = [];
        let chosen = null;
        const rest = [];
        for (const [expr, el] of task.exprGroup) {
            if (chosen) {
                rest.push(el);
                continue;
            }
            const { vecs: vecs, value } = this._evaluateExpr(expr, task.ns);
            allVecs.push(...vecs);
            if (value) {
                chosen = el;
            } else {
                rest.push(el);
            }
        }

        this._setConstruction(task, {
            type: DomConstructionTaskType.GROUP_TOGGLE,
            anchor: task.anchor,
            chosen: chosen,
            rest,
        });

        this._setupTaskRecurrence(task, allVecs);
    }

    protected _handleEventBridgeTask(task: EventBridgeTask) {
        const { event: eventName, evTraits: traits = [], tgt } = task;
        let stopPropagation = false;
        let preventDefault = false;
        let targetSelf = false;
        const opts: Record<string, unknown> = { signal: this._signal };
        for (const x of traits) {
            switch (x) {
                case 'stop': {
                    stopPropagation = true;
                    break;
                }
                case 'prevent': {
                    preventDefault = true;
                    break;
                }
                case 'self': {
                    targetSelf = true;
                    break;
                }
                case 'capture':
                case 'once':
                case 'passive': {
                    opts[x] = true;
                    break;
                }
            }
        }

        task.tgt.addEventListener(eventName, (e: Event) => {
            if (stopPropagation) {
                e.stopPropagation();
            }
            if (preventDefault) {
                e.preventDefault();
            }
            if (targetSelf && this.getEventTarget(e) !== tgt) {
                return;
            }
            const ns = Object.create(task.ns || null);

            if (e.composed) {
                const origFunc = e.composedPath;
                const composedPathSnapshot = e.composedPath();
                Object.defineProperty(e, 'composedPath', {
                    value: function () {
                        const upstream = origFunc.call(this);
                        if (!upstream.length) {
                            return composedPathSnapshot;
                        }
                        return upstream;
                    },
                    writable: false,
                    enumerable: false,
                    configurable: true,
                });
            }
            ns.$event = e;
            ns.$element = task.tgt;
            const { value } = this._evaluateExpr(task.expr, ns, true);

            if (typeof value === 'function') {
                value.call(this, e);
            }
        }, opts);

        this._untrackTask(task);
    }

    protected _handleElementReferenceTask(task: ElementReferenceTask) {
        const ns = Object.create(task.ns || null);
        ns.$element = task.tgt;
        const { value } = this._evaluateExpr(task.expr, ns, true);

        if (typeof value === 'function') {
            value.call(this, task.tgt);
        }

        this._untrackTask(task);
    }


    private __digestMaintenanceTasks() {
        let thisBatch;
        while ((thisBatch = this._pendingTasks).length) {
            this._pendingTasks = [];
            const batchSet = new WeakSet();
            for (const task of thisBatch) {
                if (batchSet.has(task)) {
                    continue;
                }
                batchSet.add(task);
                try {
                    switch (task.type) {
                        case DomMaintenanceTaskType.SUBTREE_RENDER: {
                            this._handleSubtreeRenderTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.COMPONENT_RENDER: {
                            this._handleComponentRenderTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.ATTR_SYNC: {
                            this._handleAttrSyncTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.PROP_SYNC: {
                            this._handlePropSyncTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.MODEL_SYNC: {
                            this._handleModelSyncTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.TPL_SYNC: {
                            this._handleTplSyncTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.SUBTREE_TOGGLE: {
                            this._handleSubtreeToggleTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.EVENT_BRIDGE: {
                            this._handleEventBridgeTask(task);
                            break;
                        }
                        case DomMaintenanceTaskType.ELEMENT_REF: {
                            this._handleElementReferenceTask(task);
                            break;
                        }
                    }
                } catch (err) {
                    this.emit('error', CivFeError.from(err, task), task);
                }
            }
        }
    }

    private __digestConstructionTasks() {
        if (!this._pendingConstructions.size) {
            return;
        }

        for (const con of this._pendingConstructions.values()) {
            try {
                switch (con.type) {
                    case DomConstructionTaskType.SET_ATTR: {
                        con.sub.value = con.val;
                        break;
                    }
                    case DomConstructionTaskType.SET_PROP: {
                        if (con.fn) {
                            con.fn.call(this, con);
                            break;
                        }
                        Reflect.set(con.sub, con.prop, con.val);
                        break;
                    }

                    case DomConstructionTaskType.ATTACH: {
                        const sub = con.sub;
                        con.anchor.parentNode?.insertBefore(sub, con.anchor);
                        attachRoutine.call(this, sub);
                        break;
                    }
                    case DomConstructionTaskType.REPLACE: {
                        const tgt = con.tgt;
                        const sub = con.sub;
                        if (tgt instanceof Element) {
                            tgt.replaceWith(sub);
                        } else {
                            tgt.parentNode?.replaceChild(sub, tgt);
                        }
                        attachRoutine.call(this, sub);
                        break;
                    }
                    case DomConstructionTaskType.DETACH: {
                        const sub = con.sub;
                        if (!sub.isConnected) {
                            break;
                        }
                        const rm = detachRoutine.call(this, sub, con.dispose);
                        if (!rm) {
                            break;
                        }
                        if (sub instanceof Element) {
                            sub.remove();
                        } else {
                            sub.parentNode?.removeChild(sub);
                        }
                        break;
                    }
                    case DomConstructionTaskType.SEQUENCE_MANGLE: {
                        const [parent, start, end] = con.anchor;

                        let anchorNode: Node | null = start.nextSibling;
                        const nodeOffsetSnapshot = new Map<Node | null, number>();
                        let offset = 0;
                        nodeOffsetSnapshot.set(start, offset++);

                        const insertionActionPoints: [Node, Node | null, boolean, boolean][] = [];
                        const arrangedNodes = new WeakSet<Node>();
                        let visuallyMoved = false;
                        for (const x of con.seq) {
                            const el = placeHolderElementToRealElementMap.get(x) || x;
                            if (el.parentElement && el.parentElement !== parent) {
                                // Element exists but moved to another place
                                continue;
                            }
                            if (anchorNode === el) {
                                if (visuallyMoved) {
                                    insertionActionPoints.push([el, el, false, true]);
                                    moveRoutine.call(this, el);
                                }
                                anchorNode = el.nextSibling;
                                nodeOffsetSnapshot.set(anchorNode, offset++);
                                while (anchorNode && arrangedNodes.has(anchorNode)) {
                                    anchorNode = anchorNode.nextSibling;
                                    nodeOffsetSnapshot.set(anchorNode, offset++);
                                }
                                continue;
                            }
                            visuallyMoved = true;
                            const isMove = el.isConnected;
                            insertionActionPoints.push([el, anchorNode, isMove, false]);
                            arrangedNodes.add(el);
                            if (isMove) {
                                moveRoutine.call(this, el);
                            }
                        }

                        for (const [node, anchor, isMove, isVisualMove] of insertionActionPoints) {
                            if (isVisualMove) {
                                // This is a visual move, so we don't need to do anything
                                continue;
                            }
                            if (isMove) {
                                if (node instanceof Element) {
                                    moveFunc.call(parent, node, anchor);
                                    continue;
                                }
                                parent.insertBefore(node, anchor);
                                continue;
                            }
                            parent.insertBefore(node, anchor);
                        }

                        const childNodes = parent.childNodes;
                        let i = 0;
                        while (childNodes[i] && childNodes[i] !== start) {
                            i++;
                        }
                        const baseOffset = i + 1;
                        if (anchorNode !== end) {
                            let itNode: Node | undefined | null = anchorNode;
                            while (itNode) {
                                if (itNode === end) {
                                    break;
                                }
                                const thisNode: Node = itNode;
                                const rm = detachRoutine.call(this, thisNode, true);
                                itNode = thisNode.nextSibling;
                                nodeOffsetSnapshot.set(itNode, offset++);
                                if (!rm) {
                                    // Moving the lingering nodes back to their original positions
                                    // Otherwise they are always at the bottom of the list, breaking animation/transition
                                    const thisOffset = nodeOffsetSnapshot.get(thisNode);
                                    if (thisOffset) {
                                        parent.insertBefore(thisNode, childNodes[baseOffset + thisOffset] || end);
                                    }
                                    continue;
                                }
                                if (thisNode instanceof Element) {
                                    thisNode.remove();
                                } else {
                                    thisNode.parentElement?.removeChild(thisNode);
                                }
                            }
                        }

                        for (const [node, _anchor, isMove, isVisualMove] of insertionActionPoints) {
                            if (isMove) {
                                movedRoutine.call(this, node);
                                continue;
                            }
                            if (isVisualMove) {
                                movedRoutine.call(this, node, false);
                                continue;
                            }
                            attachRoutine.call(this, node);
                        }

                        break;
                    }
                    case DomConstructionTaskType.GROUP_TOGGLE: {
                        const anchor = con.anchor;
                        const chosen = con.chosen;
                        if (!anchor.parentNode) {
                            for (const el of [chosen, ...con.rest]) {
                                if (!el?.parentNode) {
                                    continue;
                                }
                                el.parentNode.insertBefore(anchor, el);
                                break;
                            }
                        }
                        if (chosen) {
                            const previouslyConnected = chosen.isConnected;
                            anchor.parentNode?.insertBefore(chosen, anchor);
                            if (!previouslyConnected) {
                                attachRoutine.call(this, chosen);
                            }
                        }
                        for (const el of con.rest) {
                            if (!el.isConnected) {
                                continue;
                            }
                            const rm = detachRoutine.call(this, el);
                            if (!rm) {
                                continue;
                            }
                            if (el instanceof Element) {
                                el.remove();
                            } else {
                                el.parentNode?.removeChild(el);
                            }
                        }
                        break;
                    }
                }
            } catch (err) {
                this.emit('error', CivFeError.from(err, con), con);
            }
        }
        this._pendingConstructions.clear();
    }

    @perNextTick
    protected _digestTasks() {
        this.__digestMaintenanceTasks();
        if (this._nextFrameRecept || !this._pendingConstructions.size) {
            return;
        }
        this._nextFrameRecept = requestAnimationFrame(() => {
            this.__digestConstructionTasks();
            delete this._nextFrameRecept;
        });
    }

    protected _setupReactivity() {
        this[REACTIVE_KIT].on('change', (tgt, prop, newVal, oldVal) => {
            const evtgt = reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { newVal, oldVal } });
                evtgt.dispatchEvent(ev);
                const ev2 = new CustomEvent(ANY_WRITE_OP_TRIGGER, { detail: { newVal, oldVal } });
                evtgt.dispatchEvent(ev2);
            }
        });
        this[REACTIVE_KIT].on('delete', (tgt, prop, oldVal) => {
            const evtgt = reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { oldVal } });
                evtgt.dispatchEvent(ev);
                const ev2 = new CustomEvent(ANY_WRITE_OP_TRIGGER, { detail: { oldVal } });
                evtgt.dispatchEvent(ev2);
            }
        });
        this[REACTIVE_KIT].on('define', (tgt, prop, desc, oldVal) => {
            const evtgt = reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(prop, { detail: { desc, oldVal } });
                evtgt.dispatchEvent(ev);
                const ev2 = new CustomEvent(ANY_WRITE_OP_TRIGGER, { detail: { desc, oldVal } });
                evtgt.dispatchEvent(ev2);
            }
        });
        this[REACTIVE_KIT].on('array-op', (tgt, method, ...args) => {
            const evtgt = reactiveTargets.get(tgt);
            if (evtgt) {
                const ev = new CustomEvent(ANY_WRITE_OP_TRIGGER, { detail: { method, args } });
                evtgt.dispatchEvent(ev);
            }
        });

        this.on('error', (...args: any[]) => {
            console.error(`${this.constructor.name}`, ...args);
        });
    }
}
Reflect.set(CivComponent, SYM_CIV_COMPONENT, true);
mixin(CivComponent.prototype, EventEmitter.prototype);
mixin(CivComponent.prototype, mixins);

export function isCivComponent(obj: any): obj is CivComponent {
    return obj.constructor?.[SYM_CIV_COMPONENT] || false;
}

function attachRoutine(this: CivComponent, sub: Node) {
    if (sub.isConnected) {
        const event = new CustomEvent(attachedEventName, {
            detail: { component: this },
            bubbles: true,
        });
        sub.dispatchEvent(event);
        if (sub instanceof Element) {
            const hdl = (el: Element) => {
                const comp = elementToComponentMap.get(el);
                if (!comp) {
                    return;
                }
                if ('connectedCallback' in comp && typeof comp.connectedCallback === 'function') {
                    Reflect.apply(comp.connectedCallback, comp, []);
                }
            };
            hdl(sub);
            sub.querySelectorAll(`.${componentFlagClass}`).forEach(hdl);
        }
    }
}

function moveRoutine(this: CivComponent, sub: Node) {
    if (sub.isConnected) {
        const event = new CustomEvent(moveEventName, {
            detail: { component: this },
            bubbles: true,
        });
        sub.dispatchEvent(event);
    }
}
function movedRoutine(this: CivComponent, sub: Node, isRealMove: boolean = true) {
    if (sub.isConnected) {
        const event = new CustomEvent(movedEventName, {
            detail: { component: this },
            bubbles: true,
        });
        sub.dispatchEvent(event);
        if (sub instanceof Element) {
            const comp = elementToComponentMap.get(sub);
            if (!comp) {
                return;
            }
            if (isRealMove && 'connectedMoveCallback' in comp && typeof comp.connectedMoveCallback === 'function') {
                Reflect.apply(comp.connectedMoveCallback, comp, []);
            }
            // sub.querySelectorAll(`.${componentFlagClass}`).forEach(hdl);
        }
    }
}
function detachRoutine(this: CivComponent, sub: Node, dispose?: boolean) {
    const event = new CustomEvent(detachEventName, {
        detail: { component: this },
        cancelable: true,
        bubbles: true,
    });
    const continueRemoving = sub.dispatchEvent(event);
    if (dispose) {
        const taskSet = this._subtreeTaskTrack.get(sub as Element);
        if (taskSet) {
            for (const t of taskSet) {
                const revoker = this._taskToRevokerMap.get(t);
                revoker?.abort();
                this._taskToRevokerMap.delete(t);
            }
        }
        this._subtreeTaskTrack.delete(sub as Element);
    }
    if (sub instanceof Element) {
        const hdl = (el: Element) => {
            const comp = elementToComponentMap.get(el);
            if (!comp) {
                if (dispose) {
                    const sel = el as any as CivComponent;
                    (sel[Symbol.dispose] || sel[Symbol.asyncDispose])?.call(sel);
                }

                return;
            }
            if (sub.isConnected && 'disconnectedCallback' in comp && typeof comp.disconnectedCallback === 'function') {
                Reflect.apply(comp.disconnectedCallback, comp, []);
            }
            if (dispose) {
                (comp[Symbol.dispose] || comp[Symbol.asyncDispose])?.call(comp);
            }
        };
        hdl(sub);
        sub.querySelectorAll(`.${componentFlagClass}`).forEach(hdl);
    }

    return continueRemoving;
}

function DOMTokenListSync(task: SetPropTask) {
    const { sub, prop, val } = task;
    if (!(sub instanceof Element)) {
        return;
    }
    const list = Reflect.get(sub, prop);
    if (!(list instanceof DOMTokenList)) {
        return;
    }
    if (typeof val === 'object' && val !== null) {
        for (const [k, v] of Object.entries(val)) {
            if (v) {
                list.add(k);
            } else {
                list.remove(k);
            }
        }
        return;
    }
    if (Array.isArray(val)) {
        list.value = val.join(' ');
        return;
    }
    if (typeof val === 'string') {
        list.value = val;
        return;
    }
    list.value = '';
}

function selectOptionsSync(task: SetPropTask) {
    const { sub, prop, val } = task;
    if (!(sub instanceof HTMLSelectElement)) {
        return;
    }
    const options = Reflect.get(sub, prop) as HTMLOptionsCollection;

    const selectedValues = new Set<string>();
    if (Array.isArray(val)) {
        for (const v of val) {
            selectedValues.add(String(v));
        }
    } else if (val === null || val === undefined) {
        selectedValues.clear();
    } else {
        selectedValues.add(String(val));
    }
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (selectedValues.has(option.value)) {
            option.selected = true;
        } else {
            option.selected = false;
        }
    }
}

function checkboxInputSync(task: SetPropTask) {
    const { sub, prop, val } = task;
    if (!(sub instanceof HTMLInputElement)) {
        return;
    }
    if (sub.type !== 'checkbox' && sub.type !== 'radio') {
        return;
    }
    if (prop !== 'checked') {
        return;
    }
    if (sub.value === 'on') {
        sub.checked = Boolean(val);
        return;
    }
    if (Array.isArray(val)) {
        sub.checked = val.includes(sub.value);
        return;
    }

    sub.checked = sub.value === val;

}

function CSSStyleDeclarationSync(task: SetPropTask) {
    const { sub, prop, val } = task;
    if (!(sub instanceof Element)) {
        return;
    }
    const style = Reflect.get(sub, prop);
    if (!(style instanceof CSSStyleDeclaration)) {
        return;
    }
    if (typeof val === 'object' && val !== null) {
        for (const [k, v] of Object.entries(val)) {
            if (k in style) {
                const normalizedValue = (v === undefined || v === null) ? '' : String(v);
                Reflect.set(style, k, normalizedValue);
            }
        }
        return;
    }
    if (Array.isArray(val)) {
        style.cssText = val.map((x) => {
            const txt = `${x}`.trim();
            return txt.endsWith(';') ? txt : `${txt};`;
        }).join('\n');
        return;
    }
    if (typeof val === 'string') {
        style.cssText = val;
        return;
    }

    style.cssText = '';
}


export function Foreign<T extends CivComponent>(target: T, key: string, _descriptor?: PropertyDescriptor) {
    if (typeof target === 'function') {
        throw new TypeError("Foreign decorator is intended for class properties or methods, not for classes themselves.");
    }

    let val: unknown;
    let revoker: AbortController | undefined;

    Object.defineProperty(target, key, {
        configurable: true,
        enumerable: true,
        get() {
            return val;
        },
        set(this: T, value) {
            if (value === val) {
                return;
            }
            val = value;
            if (revoker) {
                revoker.abort();
                this._revokers.delete(revoker);
                revoker = undefined;
            }
            revoker = this.foreign(value);
        }
    });
}

export function ResolveComponents(mappings: Record<string, typeof CivComponent>) {
    return function (target: typeof CivComponent) {
        if (typeof target !== 'function') {
            throw new TypeError("ResolveComponents decorator is intended for class constructors, not for class instances.");
        }
        if (!isCivComponent(target.prototype)) {
            throw new TypeError("ResolveComponents decorator is intended for sub-class of CivComponent.");
        }


        if (target.hasOwnProperty('components')) {
            Object.assign(target.components, mappings);
        } else if (target.components) {
            target.components = Object.assign(Object.create(target.components), mappings);
        } else {
            target.components = { ...mappings };
        }
    };
}

export function CustomElement(tagName: string, iExtends?: string) {
    return function (target: CustomElementConstructor) {
        if (typeof target !== 'function') {
            throw new TypeError("CustomElement decorator is intended for class constructors, not for class instances.");
        }
        let civComponentExtends = Reflect.get(target, SYM_CIV_COMPONENT);
        if (civComponentExtends === true) {
            civComponentExtends = undefined;
        }
        customElements.define(tagName, target, { extends: iExtends || civComponentExtends });
    };
}
