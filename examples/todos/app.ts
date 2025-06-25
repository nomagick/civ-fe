import { CivComponent, xhtml, Reactive, Template, getReactiveStorage, Foreign } from 'civ-fe';

interface TodoItem {
    title: string;
    done: boolean;
}

const todoList = getReactiveStorage<TodoItem[]>('todoList', []);

@Template(
    xhtml`
<div>
    <h3>Simple Todos Example</h3>
    <form @submit="addTodo">
    <input
        placeholder="enter todo and click +"
        required=""
        .value="title"
        @input="title = $event.target.value"
    />
    <button>+</button>
    </form>
    <div civ:for="todo of todoList">
        <input
        type="checkbox"
        .checked="todo.done"
        @change="todo.done = $event.target.checked"
        />
        <input
        type="text"
        .value="todo.title"
        @change="todo.title = $event.target.value"
        />
        <button @click="dropTodo(todo)">
        x
        </button>
    </div>
</div>`
)
export class SimpleTodo extends CivComponent {

    @Reactive
    title = '';

    @Foreign
    todoList = todoList;

    constructor() {
        super();
    }

    addTodo(ev?: Event) {
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
        this.title = ''; // Clear the input field after adding
    }

    dropTodo(todo: TodoItem) {
        const index = this.todoList.indexOf(todo);
        if (index > -1) {
            this.todoList.splice(index, 1);
        }
    }
}

new SimpleTodo().replaceElement(document.getElementById('app')!);
