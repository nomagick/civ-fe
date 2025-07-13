import { CivComponent, html, Reactive, Template, scss, createTransition, ResolveComponents } from 'civ-fe';



@Template(
    html`
<div v-if="show" class="modal-mask" use:transition="transition">
  <div class="modal-container">
    <div class="modal-header">
      <slot name="header">default header</slot>
    </div>
    <div class="modal-body">
      <slot name="body">default body</slot>
    </div>
    <div class="modal-footer">
      <slot name="footer">
        default footer
        <button
          class="modal-default-button"
          @click="domEmit('close')"
        >OK</button>
      </slot>
    </div>
  </div>
</div>`,
    scss`
:host {
    &.modal-mask {
        position: fixed;
        z-index: 9998;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        transition: opacity 0.3s ease;
    }

    .modal-container {
        width: 300px;
        margin: auto;
        padding: 20px 30px;
        background-color: #fff;
        border-radius: 2px;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.33);
        transition: all 0.3s ease;
    }

    .modal-header h3 {
        margin-top: 0;
        color: #42b983;
    }

    .modal-body {
        margin: 20px 0;
    }

    .modal-default-button {
        float: right;
    }

}
`)
export class Modal extends CivComponent {

    @Reactive
    show = false;

    transition(elem: HTMLElement) {
        createTransition(elem, {
            transition: [
                'opacity 300ms ease',
                'transform 300ms ease'
            ],
            from: {
                opacity: '0',
                transform: 'scale(1.1)'
            },
            to: {
                opacity: '1',
                transform: '',
            },
        });
    }

}

@ResolveComponents({
    modal: Modal
})
@Template(
    html`
<div>
    <button id="show-modal" @click="showModal = true">Show Modal</button>

      <!-- use the modal component, pass in the prop -->
      <modal .show="showModal" @close="showModal = false" use:teleport="teleport">
        <template for="header">
          <h3>Custom Header</h3>
        </template>
      </modal>
</div>`
)
export class ModalApp extends CivComponent {

    @Reactive
    showModal = false;

}

new ModalApp().replaceElement(document.getElementById('app')!);
