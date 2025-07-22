import { Template, CivRouter, html } from 'civ-fe';

import SimpleComponent from '../simple-component/app';
import ModalApp from '../modal/app';
import Markdown from '../markdown/app';
import ListTransition from '../list-transition/app';
import HelloWorld from '../hello-world/app';
import HandlingInput from '../handling-input/app';
import GridApp from '../grid/app';
import Forms from '../forms/app';
import FormBindings from '../form-bindings/app';
import FetchingData from '../fetching-data/app';
import Counter from '../counter/app';
import ConditionalsAndLoops from '../conditionals-and-loops/app';
import AttributeBindings from '../attribute-bindings/app';
import SvgApp from '../svg/app';
import SimpleTodo from '../todos/app';
import TreeApp from '../tree/app';

@Template(html`
<div>
    <nav>
      <a href="/simple-component">Simple Component</a>
      <a href="/modal">Modal</a>
      <a href="/markdown">Markdown</a>
      <a href="/list-transition">List Transition</a>
      <a href="/hello-world">Hello World</a>
      <a href="/handling-input">Handling Input</a>
      <a href="/grid">Grid</a>
      <a href="/forms">Forms</a>
      <a href="/form-bindings">Form Bindings</a>
      <a href="/fetching-data">Fetching Data</a>
      <a href="/counter">Counter</a>
      <a href="/conditionals-and-loops">Conditionals and Loops</a>
      <a href="/attribute-bindings">Attribute Bindings</a>
      <a href="/svg">SVG</a>
      <a href="/todos">Todos</a>
      <a href="/tree">Tree</a>
    </nav>
    
</div>
  `)
export default class AppRouter extends CivRouter {
    routes = [
        { path: '/simple-component', component: SimpleComponent },
        { path: '/modal', component: ModalApp },
        { path: '/markdown', component: Markdown },
        { path: '/list-transition', component: ListTransition },
        { path: '/hello-world', component: HelloWorld },
        { path: '/handling-input', component: HandlingInput },
        { path: '/grid', component: GridApp },
        { path: '/forms', component: Forms },
        { path: '/form-bindings', component: FormBindings },
        { path: '/fetching-data', component: FetchingData },
        { path: '/counter', component: Counter },
        { path: '/conditionals-and-loops', component: ConditionalsAndLoops },
        { path: '/attribute-bindings', component: AttributeBindings },
        { path: '/svg', component: SvgApp },
        { path: '/todos', component: SimpleTodo },
        { path: '/tree', component: TreeApp },
    ];

}

