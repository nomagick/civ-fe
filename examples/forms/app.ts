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
    @Reactive
    errors = {} as Record<string, string>;

    props = {} as { [k: string]: { elem: HTMLInputElement, validators: ((value: string) => boolean | Promise<boolean>)[] } };

    constructor() {
        super();
    }

    onSubmit(ev?: Event) {
        if (ev) {
            ev.preventDefault();
        }
        console.log('Done');
    }

    async validate(field?: string) {
        let ok = true;
        for (const [name, { elem, validators }] of Object.entries(this.props)) {
            if (field && name !== field) {
                continue;
            }
            const value = elem.value.trim();
            let txt;
            for (const validator of validators) {
                try {
                    if (!await validator(value)) {
                        txt = `Invalid value for ${name}`;
                    }
                } catch (err: any) {
                    txt = err.message;
                    break;
                }
            }
            if (txt) {
                ok = false;
                elem.setCustomValidity(txt);
                elem.classList.add('error-input');
                this.errors[name] = elem.validationMessage;
            }
        }
        return ok;
    }

    setupFormValidation(el: HTMLFormElement, cb?: Function) {
        el.setAttribute('novalidate', '');
        el.onsubmit = async(ev) => {
            ev.preventDefault();

            if (!await this.validate()) {
                return;
            }

            cb?.();
        }
    }
    setupInputValidation(el: HTMLInputElement, ...validators: ((value: string) => boolean|Promise<boolean>)[]) {
        this.props[el.name] = {
            elem: el,
            validators
        };
        el.oninput = () => {
            if (!this.errors[el.name]) {
                return;
            }
            delete this.errors[el.name];
            el.classList.remove('error-input');
        }
        el.onblur = ()=> {
            this.validate(el.name);
        }
    }

    matchesPassword(value: string) {
        if (value === this.fields.password) {
            return true;
        }
        throw new Error("Passwords must match");
    }
    async userNameExists(value: string) {
        const exists = await fetchUserName(value);
        if (exists) {
            throw new Error(`${value} is already being used`);
        }

        return true;
    }

}

new Forms().replaceElement(document.getElementById('app')!);

