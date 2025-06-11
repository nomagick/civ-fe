import type { ReactivityHost } from "./decorators/reactive";

export enum DomMaintenanceTaskType {
    ATTR_SYNC = 'attrSync',
    PROP_SYNC = 'propSync',
    TPL_SYNC = 'tplSync',
    EVENT_BRIDGE = 'eventBridge',
    SUBTREE_TOGGLE = 'subtreeToggle',
    SUBTREE_RENDER = 'subtreeRender',
    COMPONENT_RENDER = 'componentRender',
}

export interface AttrSyncTask {
    type: DomMaintenanceTaskType.ATTR_SYNC;
    attr: Attr;
    expr: string;
    ns?: Record<string, unknown>;
}

export interface PropSyncTask {
    type: DomMaintenanceTaskType.PROP_SYNC;
    tgt: ReactivityHost | Element;
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
    anchor: [Node, Node];
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
    sub: Node;
    comp: string;
    traits: string[][];
    ns?: Record<string, unknown>;
}

export type DomMaintenanceTask =
    | AttrSyncTask
    | PropSyncTask
    | EventBridgeTask
    | SubtreeRenderTask
    | SubtreeToggleTask
    | TplSyncTask
    | ComponentRenderTask;
