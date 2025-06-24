import { CivComponent, html, Reactive, Template } from 'civ-fe';


const EMAILS = ["johnsmith@outlook.com", "mary@gmail.com", "djacobs@move.org", "test@example.com"];

function fetchUserName(name: string) {
    return new Promise((resolve) => {
        setTimeout(() => resolve(EMAILS.indexOf(name) > -1), 200);
    });
}

@Template(
    html`
<form $ref="setupFormValidation($element, onSubmit)">
  <h1>Sign Up</h1>
  <div class="field-block">
    <input
      name="email"
      type="email"
      placeholder="Email"
      required
      $ref="setupInputValidation($element, userNameExists)"
    />
    <span civ:if="errors.email" class="error-message" .textContent="errors.email"></span>
  </div>
  <div class="field-block">
    <input
      type="password"
      name="password"
      placeholder="Password"
      required
      minlength="8"
      @input="fields.password = $event.target.value"
      $ref="setupInputValidation"
    />
    <span civ:if="errors.password" class="error-message" .textContent="errors.password"></span>
  </div>
  <div class="field-block">
    <input
      type="password"
      name="confirmpassword"
      placeholder="Confirm Password"
      required
      $ref="setupInputValidation($element, matchesPassword)"
    />
    <span civ:if="errors.confirmpassword" class="error-message" .textContent="errors.confirmpassword"></span>
  </div>
  <button type="submit">Submit</button>
</form>`)
export class Forms extends CivComponent {

    @Reactive
    title = '';

    @Reactive
    fields = {
        email: '',
        password: '',
    }

    props = {} as { [k: string]: { elem: HTMLInputElement, validators: ((value: string) => boolean)[] } };

    constructor() {
        super();
    }

    onSubmit(ev?: Event) {
        if (ev) {
            ev.preventDefault();
        }
        console.log('Done');
    }

    setupFormValidation(el: HTMLFormElement, cb?: Function) {
        el.setAttribute('novalidate', '');
        el.onsubmit=(ev)=> {
            ev.preventDefault();

            cb?.();
        }
    }

}

new Forms().replaceElement(document.getElementById('app')!);

