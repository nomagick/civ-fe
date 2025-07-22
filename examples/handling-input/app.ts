import { CivComponent, Reactive, Template, css, html } from 'civ-fe';

@Template(html`
<div>
    <!--
        Note there's no "ref" or ".value" at all.
    -->
    <h1>{{ message }}</h1>

    <!--
        Bind to a method/function.
        The @click syntax is short for v-on:click.
    -->
    <button @click="reverseMessage">Reverse Message</button>

    <!-- Can also be an inline expression statement -->
    <button @click="message += '!'">Append "!"</button>
    <!--
        We also provides modifiers for common tasks
        such as e.preventDefault() and e.stopPropagation(), but just for compatibility with Vue.js.
    -->
    <a href="https://www.gov.cn" @click.prevent="notify">
        A link with e.preventDefault()
    </a>
</div>
`, css`
:host button,a {
  display: block;
  margin-bottom: 1em;
}
`)
export default class HandlingInput extends CivComponent {

    @Reactive
    message: string = 'Hello World';

    reverseMessage() {
        // Access/mutate the value without any smart-ass api.
        this.message = this.message.split('').reverse().join('')
    }

    notify() {
        alert('navigation was prevented.')
    }
}