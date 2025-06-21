import { CivComponent, Reactive, Template } from 'civ-fe';

@Template(document.getElementById('app')!.outerHTML, `#app {color: red;}`)
export class HelloWorld extends CivComponent {

    @Reactive()
    message: string = 'World';

    interval?: ReturnType<typeof setInterval>;

    override connectedCallback(): void {
        super.connectedCallback();
        this.interval = setInterval(() => this.message = this.message.endsWith('!') ? this.message.slice(0, -1) : this.message + '!', 1000);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        if (this.interval) {
            clearInterval(this.interval);
            delete this.interval;
        }
    }
}

new HelloWorld().replaceElement(document.getElementById('app')!);
