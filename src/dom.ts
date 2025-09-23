import type { EventHandlerTrait, Traits } from "./protocol";
import type { CivComponent } from "civ-component";

export enum DomMaintenanceTaskType {
    ATTR_SYNC = 'attrSync',
    PROP_SYNC = 'propSync',
    MODEL_SYNC = 'modelSync',
    TPL_SYNC = 'tplSync',
    EVENT_BRIDGE = 'eventBridge',
    SUBTREE_TOGGLE = 'subtreeToggle',
    SUBTREE_RENDER = 'subtreeRender',
    COMPONENT_RENDER = 'componentRender',
    ELEMENT_REF = 'elementRef',
}

export interface AttrSyncTask {
    type: DomMaintenanceTaskType.ATTR_SYNC;
    attr: Attr;
    expr: string;
    ns?: Record<string, unknown>;
}

export interface PropSyncTask {
    type: DomMaintenanceTaskType.PROP_SYNC;
    tgt: CivComponent | Element;
    prop: string;
    expr: string;
    ns?: Record<string, unknown>;
}

export interface ModelSyncTask {
    type: DomMaintenanceTaskType.MODEL_SYNC;
    tgt: Element;
    expr: string;
    ns?: Record<string, unknown>;
}

export interface TplSyncTask {
    type: DomMaintenanceTaskType.TPL_SYNC;
    text: Text;
    expr: string;
    ns?: Record<string, unknown>;
}

export interface EventBridgeTask {
    type: DomMaintenanceTaskType.EVENT_BRIDGE;
    tgt: EventTarget;
    event: string;
    expr: string;
    evTraits?: EventHandlerTrait[];
    ns?: Record<string, unknown>;
}

export interface SubtreeRenderTask {
    type: DomMaintenanceTaskType.SUBTREE_RENDER;
    tpl: Element;
    anchor: [Element, Node, Node];
    expr: string;
    injectNs: string[];
    ns?: Record<string, unknown>;
}

export interface SubtreeToggleTask {
    type: DomMaintenanceTaskType.SUBTREE_TOGGLE;
    anchor: Node;
    exprGroup: [string, Element][];
    ns?: Record<string, unknown>;
}

export interface ComponentRenderTask {
    type: DomMaintenanceTaskType.COMPONENT_RENDER;
    sub: Element;
    comp: string;
    traits: Traits;
    ns?: Record<string, unknown>;
}

export interface ElementReferenceTask {
    type: DomMaintenanceTaskType.ELEMENT_REF;
    tgt: Element;
    expr: string;
    ns?: Record<string, unknown>;
}

export type DomMaintenanceTask =
    | SubtreeRenderTask
    | ComponentRenderTask
    | AttrSyncTask
    | PropSyncTask
    | ModelSyncTask
    | TplSyncTask
    | SubtreeToggleTask
    | EventBridgeTask
    | ElementReferenceTask;


export enum DomConstructionTaskType {
    SET_ATTR = 'setAttr',
    SET_PROP = 'setProp',
    ATTACH = 'attach',
    DETACH = 'detach',
    REPLACE = 'replace',
    SEQUENCE_MANGLE = 'sequenceMangle',
    GROUP_TOGGLE = 'groupToggle',
}

export interface SetAttrTask {
    type: DomConstructionTaskType.SET_ATTR;
    sub: Attr;
    val: any;
}
export interface SetPropTask {
    type: DomConstructionTaskType.SET_PROP;
    sub: Node;
    prop: string;
    val: any;
    fn?: (tsk: SetPropTask) => void;
}
export interface NodeAttachTask {
    type: DomConstructionTaskType.ATTACH;
    sub: Node;
    anchor: Node;
}
export interface NodeDetachTask {
    type: DomConstructionTaskType.DETACH;
    sub: Node;
    dispose?: boolean;
}
export interface NodeReplaceTask {
    type: DomConstructionTaskType.REPLACE;
    tgt: Node;
    sub: Node;
}
export interface NodeSequenceMangleTask {
    type: DomConstructionTaskType.SEQUENCE_MANGLE;
    anchor: [Element, Node, Node];
    seq: Node[];
}
export interface NodeGroupToggleTask {
    type: DomConstructionTaskType.GROUP_TOGGLE;
    anchor: Node;
    chosen: Node | null;
    rest: Node[];
}

export type DomConstructionTask = SetAttrTask | SetPropTask | NodeAttachTask |
    NodeDetachTask | NodeReplaceTask | NodeSequenceMangleTask | NodeGroupToggleTask;

export const tagNameToClassMap = {
    // Document structure
    'html': HTMLHtmlElement,
    'head': HTMLHeadElement,
    'body': HTMLBodyElement,
    'title': HTMLTitleElement,
    'meta': HTMLMetaElement,
    'link': HTMLLinkElement,
    'style': HTMLStyleElement,
    'script': HTMLScriptElement,
    'base': HTMLBaseElement,

    // Headings
    'h1': HTMLHeadingElement,
    'h2': HTMLHeadingElement,
    'h3': HTMLHeadingElement,
    'h4': HTMLHeadingElement,
    'h5': HTMLHeadingElement,
    'h6': HTMLHeadingElement,

    // Content sections
    'div': HTMLDivElement,
    'span': HTMLSpanElement,
    'p': HTMLParagraphElement,
    'hr': HTMLHRElement,
    'pre': HTMLPreElement,
    'blockquote': HTMLQuoteElement,
    'q': HTMLQuoteElement,

    // Semantic elements
    'address': HTMLElement,
    'article': HTMLElement,
    'aside': HTMLElement,
    'footer': HTMLElement,
    'header': HTMLElement,
    'main': HTMLElement,
    'nav': HTMLElement,
    'section': HTMLElement,
    'hgroup': HTMLElement,
    'figure': HTMLElement,
    'figcaption': HTMLElement,

    // Text semantics
    'br': HTMLBRElement,
    'cite': HTMLElement,
    'code': HTMLElement,
    'em': HTMLElement,
    'i': HTMLElement,
    'kbd': HTMLElement,
    'mark': HTMLElement,
    's': HTMLElement,
    'samp': HTMLElement,
    'small': HTMLElement,
    'strong': HTMLElement,
    'sub': HTMLElement,
    'sup': HTMLElement,
    'time': HTMLTimeElement,
    'u': HTMLElement,
    'var': HTMLElement,
    'wbr': HTMLElement,
    'b': HTMLElement,
    'bdi': HTMLElement,
    'bdo': HTMLElement,
    'dfn': HTMLElement,
    'abbr': HTMLElement,

    // Lists
    'ul': HTMLUListElement,
    'ol': HTMLOListElement,
    'li': HTMLLIElement,
    'dl': HTMLDListElement,
    'dt': HTMLElement,
    'dd': HTMLElement,

    // Links and media
    'a': HTMLAnchorElement,
    'img': HTMLImageElement,
    'area': HTMLAreaElement,
    'map': HTMLMapElement,
    'audio': HTMLAudioElement,
    'video': HTMLVideoElement,
    'source': HTMLSourceElement,
    'track': HTMLTrackElement,
    'embed': HTMLEmbedElement,
    'object': HTMLObjectElement,
    'param': HTMLParamElement,
    'picture': HTMLPictureElement,

    // Forms
    'form': HTMLFormElement,
    'input': HTMLInputElement,
    'textarea': HTMLTextAreaElement,
    'button': HTMLButtonElement,
    'select': HTMLSelectElement,
    'option': HTMLOptionElement,
    'optgroup': HTMLOptGroupElement,
    'label': HTMLLabelElement,
    'fieldset': HTMLFieldSetElement,
    'legend': HTMLLegendElement,
    'datalist': HTMLDataListElement,
    'output': HTMLOutputElement,
    'progress': HTMLProgressElement,
    'meter': HTMLMeterElement,

    // Tables
    'table': HTMLTableElement,
    'caption': HTMLTableCaptionElement,
    'col': HTMLTableColElement,
    'colgroup': HTMLTableColElement,
    'thead': HTMLTableSectionElement,
    'tbody': HTMLTableSectionElement,
    'tfoot': HTMLTableSectionElement,
    'tr': HTMLTableRowElement,
    'td': HTMLTableCellElement,
    'th': HTMLTableCellElement,

    // Interactive
    'details': HTMLDetailsElement,
    // 'summary': HTMLSummaryElement,
    'dialog': HTMLDialogElement,
    'menu': HTMLMenuElement,

    // Web components
    'slot': HTMLSlotElement,
    'template': HTMLTemplateElement,

    // Frames
    'iframe': HTMLIFrameElement,

    // Ruby annotations
    'ruby': HTMLElement,
    'rt': HTMLElement,
    'rp': HTMLElement,

    // Edits
    'del': HTMLModElement,
    'ins': HTMLModElement,

    // Graphics
    'canvas': HTMLCanvasElement,

    // Data
    'data': HTMLDataElement,

    // Other elements that use HTMLElement
    'noscript': HTMLElement,
};
