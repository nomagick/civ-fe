import { CivComponent, html, Reactive, Template, scss, createTransitionGroup } from 'civ-fe';

import { shuffle } from 'lodash-es';

@Template(
    html`
<div>
  <button @click="insert">Insert at random index</button>
  <button @click="reset">Reset</button>
  <button @click="shuffle">Shuffle</button>

  <ul class="container" use:animate="transitionGroup">
    <li v-for="item of items" class="item">
      {{ item }}
      <button @click="remove(item)">x</button>
    </li>
  </ul>
</div>`,
    scss`
:host {
    .container {
        position: relative;
        padding: 0;
        list-style-type: none;
    }

    .item {
        width: 100%;
        height: 30px;
        background-color: #f3f3f3;
        border: 1px solid #666;
        box-sizing: border-box;
    }
}
`)
export class ListTransition extends CivComponent {

    @Reactive
    items = [1, 2, 3, 4, 5];

    insert() {
        const i = Math.round(Math.random() * this.items.length)
        this.items.splice(i, 0, this.items.length + 1)
    }

    reset() {
        this.items.length = 0; // clear the array
        this.items.push(...[1, 2, 3, 4, 5]);
    }

    shuffle() {
        const tmp = shuffle(this.items);
        this.items.length = 0; // clear the array
        this.items.push(...tmp);
    }

    remove(item: number) {
        const i = this.items.indexOf(item)
        if (i > -1) {
            this.items.splice(i, 1)
        }
    }

    transitionGroup(elem: HTMLElement) {

        createTransitionGroup(elem, {
            transition: 'all 0.5s cubic-bezier(0.55, 0, 0.1, 1)',
            from: {
                opacity: '0',
                transform: 'scaleY(0.01) translate(30px, 0)'
            },
            to: {
                opacity: '1',
                transform: ''
            },
            leaveTo: {
                opacity: '0',
                transform: 'scaleY(0.01) translate(30px, 0)',
                position: 'absolute',
            }
        })

    }

}


new ListTransition().replaceElement(document.getElementById('app')!);
