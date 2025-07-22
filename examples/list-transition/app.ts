import { CivComponent, html, Reactive, Template, scss } from 'civ-fe';

import { shuffle } from 'lodash-es';

@Template(
    html`
<div>
  <button @click="insert">Insert at random index</button>
  <button @click="reset">Reset</button>
  <button @click="shuffle">Shuffle</button>

  <ul class="container" use:transition-group="createTransitionGroup($element, {leaveTo: 'leave-to', leaveFrom: 'leave-from'})">
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
    /* 1. declare transition */
    .in-transition {
        transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
    }

    /* 2. declare enter from and leave to state */
    .enter-from,
    .leave-to {
        opacity: 0;
        transform: scaleY(0.01) translate(30px, 0);
    }

    /* 3. ensure leaving items are taken out of layout flow so that moving
        animations can be calculated correctly. */
    .leave-from,
    .leave-to {
        position: absolute;
    }
}
`)
export default class ListTransition extends CivComponent {

    @Reactive
    items = [1, 2, 3, 4, 5];

    id = this.items.length;

    insert() {
        const i = Math.round(Math.random() * this.items.length)
        this.items.splice(i, 0, ++this.id)
    }

    reset() {
        this.items.length = 0; // clear the array
        this.items.push(...[1, 2, 3, 4, 5]);
        this.id = this.items.length;
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

}