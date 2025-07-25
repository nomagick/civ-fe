import { CivComponent, Reactive, Template, css, html } from 'civ-fe';

@Template(html`
<div>
    <h2>Text Input</h2>
    <input v-model="text">
    <p>{{ text }}</p>

    <h2>Checkbox</h2>
    <input type="checkbox" id="checkbox" v-model="checked">
    <label for="checkbox">Checked: {{ checked }}</label>

    <!--
      multiple checkboxes can bind to the same
      array v-model value
    -->
    <h2>Multi Checkbox</h2>
    <input type="checkbox" id="jack" value="Jack" v-model="checkedNames">
    <label for="jack">Jack</label>
    <input type="checkbox" id="john" value="John" v-model="checkedNames">
    <label for="john">John</label>
    <input type="checkbox" id="mike" value="Mike" v-model="checkedNames">
    <label for="mike">Mike</label>
    <p>Checked names: {{ checkedNames }}</p>

    <h2>Radio</h2>
    <input type="radio" id="one" value="One" v-model="picked">
    <label for="one">One</label>
    <br>
    <input type="radio" id="two" value="Two" v-model="picked">
    <label for="two">Two</label>
    <p>Picked: {{ picked }}</p>

    <h2>Select</h2>
    <select v-model="selected">
      <option disabled value="">Please select one</option>
      <option>A</option>
      <option>B</option>
      <option>C</option>
    </select>
    <p>Selected: {{ selected }}</p>

    <h2>Multi Select</h2>
    <select v-model="multiSelected" multiple style="width:100px">
      <option>A</option>
      <option>B</option>
      <option>C</option>
    </select>
    <p>Selected: {{ multiSelected }}</p>
</div>
`)
export default class FormBindings extends CivComponent {

    @Reactive
    text = 'Edit me';
    @Reactive
    checked = true;
    @Reactive
    checkedNames = ['Jack'];
    @Reactive
    picked = 'One';
    @Reactive
    selected = 'A';
    @Reactive
    multiSelected = ['A'];

}