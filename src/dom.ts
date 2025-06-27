import { Traits } from "protocol";
import type { CivComponent } from "civ-component";

export enum DomMaintenanceTaskType {
    ATTR_SYNC = 'attrSync',
    PROP_SYNC = 'propSync',
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
