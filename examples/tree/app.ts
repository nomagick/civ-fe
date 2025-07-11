import { CivComponent, Reactive, Template, html, scss, ResolveComponents } from 'civ-fe';

type TreeModel = {
    name: string;
    children?: TreeModel[];
}

@ResolveComponents({
    TreeItem
})
@Template(html`
<li>
  <div
    :class="{ bold: isFolder }"
    @click="toggle"
    @dblclick="changeType">
    {{ model.name }}
    <span v-if="isFolder">[{{ isOpen ? '-' : '+' }}]</span>
  </div>
  <ul .style="{display: isOpen ? undefined : 'none'}" v-if="isFolder">
    <!--
      A component can recursively render itself using its
      "name" option (inferred from filename if using SFC)
    -->
    <TreeItem
      class="item"
      v-for="model of model.children"
      .model="model">
    </TreeItem>
    <li class="add" @click="addChild">+</li>
  </ul>
</li>
`)
export class TreeItem extends CivComponent {

    @Reactive
    model?: TreeModel;
    @Reactive
    isOpen: boolean = false;

    get isFolder() {
        return Array.isArray(this.model?.children);
    }

    toggle() {
        this.isOpen = !this.isOpen;
    }

    addChild() {
        this.model?.children?.push({
            name: 'new stuff'
        });
    }

    changeType() {
        if (!this.isFolder) {
            if (this.model) {
                this.model.children = [];
                this.addChild();
                this.isOpen = true;
            }
        }
    }
}

@ResolveComponents({
    TreeItem
})
@Template(html`
<ul>
    <TreeItem class="item" .model="treeData"></TreeItem>
</ul>`,
scss`
.item {
    cursor: pointer;
    line-height: 1.5;
}
.bold {
    font-weight: bold;
}
`)
export class TreeApp extends CivComponent {

    @Reactive
    treeData: object = {
        name: 'My Tree',
        children: [
            { name: 'hello' },
            { name: 'world' },
            {
                name: 'child folder',
                children: [
                    {
                        name: 'child folder',
                        children: [{ name: 'hello' }, { name: 'world' }]
                    },
                    { name: 'hello' },
                    { name: 'world' },
                    {
                        name: 'child folder',
                        children: [{ name: 'hello' }, { name: 'world' }]
                    }
                ]
            }
        ]
    };

}

new TreeApp().replaceElement(document.getElementById('app')!);
