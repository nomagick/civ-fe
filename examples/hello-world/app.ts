import { CivComponent, Reactive, HTML } from 'civ-fe';


@HTML(document.getElementById('template')!.outerHTML)
export class HelloWorld extends CivComponent {

    @Reactive()
    message: string = 'World';
}
