import { REACTIVE_TEMPLATE_CSS, REACTIVE_TEMPLATE_HTML } from "./decorators/template";
import { activateReactivity, ReactivityHost } from "./decorators/reactive";

export interface ReactiveElement extends ReactivityHost { }

export class ReactiveElement extends HTMLElement {
    static [REACTIVE_TEMPLATE_CSS]: string = '';
    static [REACTIVE_TEMPLATE_HTML]: string = '';

    protected customElement: Record<string, Element> = {
        
    };

    constructor() {
        super();
        activateReactivity(this);
    }

    render() {
        // Implement rendering logic for the component
        this.shadowRoot!.innerHTML = `<p>Hello from ReactiveElement!</p>`;
    }
}
