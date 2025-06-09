

let serial = 1;
export const REACTIVE_TEMPLATE_IDENTIFIER = Symbol('REACTIVE_TEMPLATE_IDENTIFIER');
export const REACTIVE_TEMPLATE_DOM = Symbol('REACTIVE_TEMPLATE_DOM');
export const REACTIVE_TEMPLATE_SHEET = Symbol('REACTIVE_TEMPLATE_SHEET');
export interface ReactiveTemplateMixin {
    new (...args: unknown[]): unknown;
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

        Reflect.set(target, REACTIVE_TEMPLATE_DOM, doc);
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

        Reflect.set(target, REACTIVE_TEMPLATE_SHEET, sheet);
    };
}

export function Template(html: string, css?: string) {
    return function <T extends ReactiveTemplateMixin>(target: T) {
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


