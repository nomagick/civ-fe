import { CivComponent, css, html, Reactive, Template } from 'civ-fe';

@Template(
    html`<div>Count value is {{count}}</div>`,
    css`
    #app {
        color: auto;
        font-size: 2rem;
    }`
)
export class Counter extends CivComponent {

    @Reactive
    count = 0;

    interval?: ReturnType<typeof setInterval>;

    connectedCallback() {
        if (this.interval) {
            clearInterval(this.interval);
        }
        this.interval = setInterval(() => this.count++, 1000);
    }

    disconnectedCallback() {
        if (this.interval) {
            clearInterval(this.interval);
            delete this.interval;
        }
    }
}

new Counter().replaceElement(document.getElementById('app')!);
