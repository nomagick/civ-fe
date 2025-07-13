
const moveFunc: <T extends Node>(this: T, node: Node, anchor: Node | null) => T =
    'moveBefore' in Element.prototype ? Element.prototype.moveBefore : Element.prototype.insertBefore as any;

export function teleport(elem: Element, target = document.body, reference: Node | null = null): void {
    moveFunc.call(target, elem, reference);
}
