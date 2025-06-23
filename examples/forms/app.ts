import { CivComponent, html, Reactive, Template, getReactiveStorage } from 'civ-fe';

interface TodoItem {
    title: string;
    done: boolean;
}

const todoList = getReactiveStorage<TodoItem[]>('todoList', []);

@Template(
    html`
<form @submit={fn}>
  <h1>Sign Up</h1>
  <div class="field-block">
    <input
      name="email"
      type="email"
      placeholder="Email"
      required
      use:validate={[userNameExists]}
    />
    {errors.email && <ErrorMessage error={errors.email} />}
  </div>
  <div class="field-block">
    <input
      type="password"
      name="password"
      placeholder="Password"
      required=""
      minlength="8"
      onInput={(e) => setFields("password", e.target.value)}
      use:validate
    />
    {errors.password && <ErrorMessage error={errors.password} />}
  </div>
  <div class="field-block">
    <input
      type="password"
      name="confirmpassword"
      placeholder="Confirm Password"
      required=""
      use:validate={[matchesPassword]}
    />
    {errors.confirmpassword && (
      <ErrorMessage error={errors.confirmpassword} />
    )}
  </div>
  <button type="submit">Submit</button>
</form>`
)
export class SimpleTodo extends CivComponent {

    @Reactive()
    title = '';

    todoList = todoList;

    constructor() {
        super();
        this.foreign(todoList);
    }

    addTodo(ev?: Event): void {
        if (ev) {
            ev.preventDefault();
        }
        if (!this.title || this.title.trim() === '') {
            return;
        }
        this.todoList.unshift({
            title: this.title.trim(),
            done: false
        });
    }

    dropTodo(todo: TodoItem): void {
        const index = this.todoList.indexOf(todo);
        if (index > -1) {
            this.todoList.splice(index, 1);
        }
    }

    override connectedCallback(): void {
        super.connectedCallback();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this._cleanup();
    }
}

new SimpleTodo().replaceElement(document.getElementById('app')!);

