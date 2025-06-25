import { nsCollection } from "../protocol";


let serial = 1;
export const REACTIVE_TEMPLATE_IDENTIFIER = Symbol('REACTIVE_TEMPLATE_IDENTIFIER');
export const REACTIVE_TEMPLATE_DOM = Symbol('REACTIVE_TEMPLATE_DOM');
export const REACTIVE_TEMPLATE_SHEET = Symbol('REACTIVE_TEMPLATE_SHEET');
export interface ReactiveTemplateMixin {
    new(...args: unknown[]): unknown;
    [REACTIVE_TEMPLATE_IDENTIFIER]?: string;
    [REACTIVE_TEMPLATE_DOM]?: Document;
    [REACTIVE_TEMPLATE_SHEET]?: CSSStyleSheet;
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

    const nn = `${target.name}-${thisSerial.toString(16)}`;

    Reflect.set(target, REACTIVE_TEMPLATE_IDENTIFIER, nn);

    return nn;
}

export function HTML(text: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("HTML decorator is intended for classes themselves.");
        }
        identify(target);

        const doc = new DOMParser().parseFromString(text, 'text/html');

        if (!doc.body.firstElementChild && !doc.head.firstElementChild) {
            throw new Error("Invalid HTML template");
        }
        Reflect.set(target.prototype, REACTIVE_TEMPLATE_DOM, doc);
    };
}

export function XHTML(text: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("XHTML decorator is intended for classes themselves.");
        }
        identify(target);

        const nsInjections = [
            'xmlns="http://www.w3.org/1999/xhtml"',
            ...nsCollection.map((ns) => `xmlns:${ns}="https://civkit.naiver.org/${ns}"`),
        ];
        const firstClose = text.indexOf('>');
        if (firstClose === -1) {
            throw new Error("Invalid XHTML template");
        }
        text = text.slice(0, firstClose) + ' ' + nsInjections.join(' ') + text.slice(firstClose);

        const doc = new DOMParser().parseFromString(text, 'application/xhtml+xml');

        Reflect.set(target.prototype, REACTIVE_TEMPLATE_DOM, doc);
    };
}

function mangleSelectorText(cssRules: CSSRuleList, identifier: string): void {

    for (let i = 0; i < cssRules.length; i++) {
        const rule = cssRules[i];
        if (rule instanceof CSSGroupingRule) {
            mangleSelectorText(rule.cssRules, identifier);
            continue;
        }
        if (rule instanceof CSSStyleRule) {
            rule.selectorText = rule.selectorText
                .replace(/:host\(/g, `.${identifier}:is(`)
                .replace(/:host/g, `.${identifier}`)
                .replace(/::slotted\(/g, `.${identifier}__slotted :is(`);
        }
    }
}

export function CSS(text: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
        if (typeof target !== 'function') {
            throw new TypeError("CSS decorator is intended for classes themselves.");
        }

        const identifier = identify(target, !target.hasOwnProperty(REACTIVE_TEMPLATE_IDENTIFIER));
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(text);
        mangleSelectorText(sheet.cssRules, identifier);

        Reflect.set(target.prototype, REACTIVE_TEMPLATE_SHEET, sheet);
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
        } else {
            HTML(html.value)(target);
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


