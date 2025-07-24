import { CivComponent, Reactive, Template, scss, html, debounce } from 'civ-fe';
import { marked } from 'marked'

@Template(html`
<div class="editor">
    <textarea class="input" .value="input" @input="update"></textarea>
    <div class="output" v-html="output"></div>
</div>
`, scss`
body {
  margin: 0;
}

:host {
    &.editor {
        height: 100vh;
        display: flex;
    }

    .input,
    .output {
        overflow: auto;
        width: 50%;
        height: 100%;
        box-sizing: border-box;
        padding: 0 20px;
    }

    .input {
        border: none;
        border-right: 1px solid #ccc;
        resize: none;
        outline: none;
        background-color: #f6f6f6;
        font-size: 14px;
        font-family: 'Monaco', courier, monospace;
        padding: 20px;
    }

    code {
        color: #f66;
    }
}
`)
export default class Markdown extends CivComponent {

    @Reactive
    input: string = '# hello';
    @Reactive
    isRed: boolean = true;
    @Reactive
    color: CSSStyleDeclaration['color'] = 'green';

    get output() {
        return marked(this.input);
    }

    @debounce(100)
    update(ev: Event) {
        this.input = (ev.target as HTMLTextAreaElement).value;
    }
}
