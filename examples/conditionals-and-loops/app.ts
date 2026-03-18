import { CivComponent, Reactive, Template, css, html } from 'civ-fe';

@Template(html`
<div>
    <button @click="show = !show">Toggle List</button>
    <button @click="list.push(list.length + 1)">Push Number</button>
    <button @click="list.pop()">Pop Number</button>
    <button @click="list.reverse()">Reverse List</button>

    <ul *if="show && list.length">
        <li *for="item of list">{{ item }}</li>
    </ul>
    <p *elif="list.length">List is not empty, but hidden.</p>
    <p *else>List is empty.</p>
</div>
`)
export default class ConditionalsAndLoops extends CivComponent {

    @Reactive
    show: boolean = true;
    @Reactive
    list = [1, 2, 3];

}
