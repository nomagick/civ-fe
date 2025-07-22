import { CivComponent, Reactive, ResolveComponents, Template, html } from 'civ-fe';

@Template(html`
<li>{{ todo.text }}</li>
`)
export class TodoItem extends CivComponent {

    @Reactive
    todo?: { text: string };

}

@ResolveComponents({ TodoItem })
@Template(html`
<ol>
    <TodoItem v-for="item of groceryList" prop:todo="item" />
</ol>
`)
export default class SimpleComponent extends CivComponent {

    @Reactive
    groceryList = [
        { id: 0, text: 'Vegetables' },
        { id: 1, text: 'Cheese' },
        { id: 2, text: 'Whatever else humans are supposed to eat' }
    ];

}