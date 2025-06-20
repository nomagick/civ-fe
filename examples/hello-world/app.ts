import { CivComponent, Reactive, HTML } from 'civ-fe';


@HTML(document.getElementById('app')!.outerHTML)
export class HelloWorld extends CivComponent {

    @Reactive()
    message: string = 'World';
}

new HelloWorld().replaceElement(document.getElementById('app')!);
