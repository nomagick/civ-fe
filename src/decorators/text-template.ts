


export const REACTIVE_TEMPLATE_HTML = Symbol('REACTIVE_TEMPLATE_HTML');
export const REACTIVE_TEMPLATE_CSS = Symbol('REACTIVE_TEMPLATE_CSS');
export interface ReactiveTemplateMixin {
    [REACTIVE_TEMPLATE_HTML]?: string;
    [REACTIVE_TEMPLATE_CSS]?: string;
}

export function HTML(text: string) {
    return function <T extends typeof Element>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("HTML decorator is intended for classes themselves.");
        }

        Reflect.set(target, REACTIVE_TEMPLATE_HTML, text);
    };
}

export function CSS(text: string) {
    return function <T extends typeof Element>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("CSS decorator is intended for classes themselves.");
        }

        Reflect.set(target, REACTIVE_TEMPLATE_CSS, text);
    };
}

export function Template(html: string, css?: string) {
    return function <T extends typeof Element>(target: T) {
        HTML(html)(target);
        if (css) {
            CSS(css)(target);
        }
    };
}

// HTML no-op template formatter
function _noop(strings: TemplateStringsArray, ...values: any[]): string {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
            result += values[i];
        }
    }
    return result;
}

export const html = _noop;
export const css = _noop;


