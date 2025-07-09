import { CivComponent, Reactive, Template, scss, html, unwrap, ResolveComponents } from 'civ-fe';


@Template(html`
<table v-if="filteredData.length">
  <thead>
    <tr>
      <th v-for="key of columns"
        @click="sortBy(key)"
        :class="{ active: sortKey == key }">
        {{ capitalize(key) }}
        <span v-if="sortKey === key" class="arrow" :class="sortDirection > 0 ? 'arrow asc' : 'arrow dsc'">
        </span>
      </th>
    </tr>
  </thead>
  <tbody>
    <tr v-for="entry of filteredData">
      <td v-for="key of columns">
        {{entry[key]}}
      </td>
    </tr>
  </tbody>
</table>
`, scss`
:host {
    &.table {
        border: 2px solid #42b983;
        border-radius: 3px;
        background-color: #fff;
    }

    th {
        background-color: #42b983;
        color: rgba(255, 255, 255, 0.66);
        cursor: pointer;
        user-select: none;
    }

    td {
        background-color: #f9f9f9;
    }

    th,
    td {
        min-width: 120px;
        padding: 10px 20px;
    }

    th.active {
        color: #fff;
    }

    th.active .arrow {
        opacity: 1;
    }

    .arrow {
        display: inline-block;
        vertical-align: middle;
        width: 0;
        height: 0;
        margin-left: 5px;
        opacity: 0.66;
    }

    .arrow.asc {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-bottom: 4px solid #fff;
    }

    .arrow.dsc {
        border-left: 4px solid transparent;
        border-right: 4px solid transparent;
        border-top: 4px solid #fff;
    }
}
`)
export class Grid extends CivComponent {

    @Reactive
    data: object[] = [];
    @Reactive
    columns: string[] = [];
    @Reactive
    filterKey?: string;
    @Reactive
    sortKey?: string;
    @Reactive
    sortDirection?: -1 | 1;

    get filteredData() {
        const data = unwrap(this.data);
        if (this.filterKey) {
            return data.filter((item) => {
                return Object.values(item).some((value) =>
                    String(value).toLowerCase().includes(this.filterKey!.toLowerCase())
                );
            });
        }
        if (this.sortKey) {
            return [...data].sort((a, b) => {
                const aValue = Reflect.get(a, this.sortKey!);
                const bValue = Reflect.get(b, this.sortKey!);
                if (aValue < bValue) return -1 * (this.sortDirection === -1 ? 1 : 0);
                if (aValue > bValue) return 1 * (this.sortDirection === -1 ? 1 : 0);
                return 0;
            });
        }

        return data;
    }

    sortBy(field: string) {
        if (this.sortKey !== field) {
            this.sortKey = field;
            this.sortDirection = 1;
        } else {
            this.sortDirection = this.sortDirection === 1 ? -1 : 1;
        }
    }

    capitalize(str: string) {
        return str.charAt(0).toUpperCase() + str.slice(1)
    }

}

@ResolveComponents({
    DemoGrid: Grid
})
@Template(html`
<div>
    <form id="search">
      Search <input name="query" v-model="searchQuery" />
    </form>
    <DemoGrid
      .data="gridData"
      .columns="gridColumns"
      .filter-key="searchQuery">
    </DemoGrid>
</div>`
)
export class GridApp extends CivComponent {

    @Reactive
    searchQuery: string = '';
    @Reactive
    gridColumns: string[] = ['name', 'power'];
    @Reactive
    gridData: object[] = [
        { name: 'Chuck Norris', power: Infinity },
        { name: 'Bruce Lee', power: 9000 },
        { name: 'Jackie Chan', power: 7000 },
        { name: 'Jet Li', power: 8000 }
    ];

}

new GridApp().replaceElement(document.getElementById('app')!);
