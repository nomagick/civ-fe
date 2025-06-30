import { CivComponent, Reactive, Template, css, html } from 'civ-fe';

@Template(html`
<div>
    <p>
    <span :title="message">
        Hover your mouse over me for a few seconds to see my dynamically bound title!
    </span>
    </p>
    <!--
    class bindings have special support for objects and arrays
    in addition to plain strings
    -->
    <p :class="{ red: isRed }" @click="toggleRed">
    This should be red... but click me to toggle it.
    </p>
    <!-- style bindings also support object and arrays -->
    <p :style="{ color }" @click="toggleColor">
    This should be green, and should toggle between green and blue on click.
    </p>
</div>
`, css`
:host .red {
  color: red;
}
`)
export class AttributeBindings extends CivComponent {

    @Reactive
    message: string = 'Hello World!';
    @Reactive
    isRed: boolean = true;
    @Reactive
    color: CSSStyleDeclaration['color'] = 'green';

    toggleRed() {
        this.isRed = !this.isRed;
    }

    toggleColor() {
        this.color = this.color === 'green' ? 'blue' : 'green'
    }
}

new AttributeBindings().replaceElement(document.getElementById('app')!);
