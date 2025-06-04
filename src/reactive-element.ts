import { activateReactivity, ReactivityHost } from "./decorators/reactive";

export interface ReactiveElement extends ReactivityHost { }

export class ReactiveElement extends HTMLElement {
    constructor() {
        super();
        activateReactivity(this);
    }

    render() {
        // Implement rendering logic for the component
        this.shadowRoot!.innerHTML = `<p>Hello from ReactiveElement!</p>`;
    }
}
