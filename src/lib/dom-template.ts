import { nsCollection } from "../protocol";


let serial = 1;
export const REACTIVE_TEMPLATE_IDENTIFIER = Symbol('REACTIVE_TEMPLATE_IDENTIFIER');
export const REACTIVE_TEMPLATE_DOM = Symbol('REACTIVE_TEMPLATE_DOM');
export const REACTIVE_TEMPLATE_SHEET = Symbol('REACTIVE_TEMPLATE_SHEET');
export interface ReactiveTemplateMixin {
    new(...args: unknown[]): unknown;
    [REACTIVE_TEMPLATE_IDENTIFIER]?: string;
    [REACTIVE_TEMPLATE_DOM]?: {
        document: Document,
        isElementTemplate?: boolean;
    };
    [REACTIVE_TEMPLATE_SHEET]?: {
        text: string;
        isGlobal?: boolean;
        sheet?: CSSStyleSheet;
        scopedText?: string;
    };
}

export function identify(target: ReactiveTemplateMixin, reIdentity?: any): string {
    if (!(typeof target === 'function')) {
        throw new TypeError("Only Class can be identified");
    }

    const n = Reflect.get(target, REACTIVE_TEMPLATE_IDENTIFIER);
    if (n && !reIdentity) {
        return n;
    }

    const thisSerial = serial++;

    const nn = `${target.name}-0x${thisSerial.toString(16)}`;

    Reflect.set(target, REACTIVE_TEMPLATE_IDENTIFIER, nn);

    return nn;
}

export function HTML(text: string, isElementTemplate?: boolean) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("HTML decorator is intended for classes themselves.");
        }
        identify(target);

        const doc = new DOMParser().parseFromString(text, 'text/html');

        if (!doc.body.firstElementChild && !doc.head.firstElementChild) {
            throw new Error("Invalid HTML template");
        }
        Reflect.set(target.prototype, REACTIVE_TEMPLATE_DOM, { document: doc, isElementTemplate });
    };
}

export function SVG(text: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("SVG decorator is intended for classes themselves.");
        }
        identify(target);

        let doc: Document;

        const isSnippet = !text.slice(0, 4).toLowerCase().startsWith('<svg');
        if (isSnippet) {
            doc = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>`, 'text/html');
            const rootElement = doc.body.firstElementChild?.firstElementChild;
            if (rootElement) {
                doc.body.insertBefore(rootElement, doc.body.firstElementChild);
            }
        } else {
            doc = new DOMParser().parseFromString(text, 'image/svg+xml');
        }

        Reflect.set(target.prototype, REACTIVE_TEMPLATE_DOM, { document: doc });
    };
}

export const INJECTED_NS_PREFIX = 'https://civkit.naiver.org/';

export function XHTML(text: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("XHTML decorator is intended for classes themselves.");
        }
        identify(target);

        const nsInjections = [
            'xmlns="http://www.w3.org/1999/xhtml"',
            ...nsCollection.map((ns) => `xmlns:${ns}="${INJECTED_NS_PREFIX}${ns}"`),
        ];
        const firstClose = text.indexOf('>');
        if (firstClose === -1) {
            throw new Error("Invalid XHTML template");
        }
        text = text.slice(0, firstClose) + ' ' + nsInjections.join(' ') + text.slice(firstClose);

        const doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');

        Reflect.set(target.prototype, REACTIVE_TEMPLATE_DOM, { document: doc });
    };
}

export function mangleSelectorText(cssRules: CSSRuleList, direction: 'toScoped' | 'toShadow' = 'toScoped'): void {
    for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule instanceof CSSGroupingRule) {
            mangleSelectorText(rule.cssRules, direction);
            continue;
        }
        if (rule instanceof CSSKeyframesRule) {
            mangleSelectorText(rule.cssRules, direction);
            continue;
        }
        if (rule instanceof CSSStyleRule) {
            if (direction === 'toScoped') {
                rule.selectorText = rule.selectorText
                    .replace(/:host\(/g, `:scope:is(`)
                    .replace(/:host/g, `:scope`);
            } else if (direction === 'toShadow') {
                rule.selectorText = rule.selectorText
                    .replace(/:scope/g, `:host`);
            }
        }
    }
}

export function CSS(text: string, isGlobal: boolean = false) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("CSS decorator is intended for classes themselves.");
        }
        identify(target, !target.hasOwnProperty(REACTIVE_TEMPLATE_IDENTIFIER));

        Reflect.set(target.prototype, REACTIVE_TEMPLATE_SHEET, { text, isGlobal });
    };
}

export interface TypedString {
    value: string;
    type: string;
}

export function Template(html: string | TypedString, css?: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof html === 'string') {
            HTML(html)(target);
        } else if (html.type === 'application/xhtml+xml') {
            XHTML(html.value)(target);
        } else if (html.type === 'image/svg+xml') {
            SVG(html.value)(target);
        } else {
            HTML(html.value)(target);
        }
        if (css) {
            CSS(css)(target);
        }
    };
}

export function ElementTemplate(html: string | TypedString, css?: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof html === 'string') {
            HTML(html, true)(target);
        } else if (html.type === 'application/xhtml+xml') {
            throw new Error("XHTML is not supported as Element template.");
        } else if (html.type === 'image/svg+xml') {
            throw new Error("SVG is not supported as Element template.");
        } else {
            HTML(html.value, true)(target);
        }
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
export function xhtml(strings: TemplateStringsArray, ...values: any[]): TypedString {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
            result += values[i];
        }
    }
    return {
        value: result,
        type: 'application/xhtml+xml'
    };
}
export function svg(strings: TemplateStringsArray, ...values: any[]): TypedString {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
            result += values[i];
        }
    }
    return {
        value: result,
        type: 'image/svg+xml'
    };
}
