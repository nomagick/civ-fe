import { CivComponent, Reactive, Template } from 'civ-fe';

@Template(document.getElementById('app')!.outerHTML, `#app {color: red;}`)
export class HelloWorld extends CivComponent {

    @Reactive()
    message: string = 'World';

    constructor() {
        super();
        setInterval(()=> this.message = this.message.endsWith('!') ? this.message.slice(0, -1) : this.message + '!', 1000);
    }
}

new HelloWorld().replaceElement(document.getElementById('app')!);
