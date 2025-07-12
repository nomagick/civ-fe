import { CivComponent, Reactive, Template, html, css, svg, ResolveComponents } from 'civ-fe';

function valueToPoint(value: number, index: number, total: number) {
    const x = 0
    const y = -value * 0.8
    const angle = ((Math.PI * 2) / total) * index
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    const tx = x * cos - y * sin + 100
    const ty = x * sin + y * cos + 100
    return {
        x: tx,
        y: ty
    }
}

type Axis = {
    label: string;
    value: number;
};

@Template(svg`
<text :x="point.x" :y="point.y">{{stat.label}}</text>
`)
export class AxisLabel extends CivComponent {

    @Reactive
    stat!: Axis;
    @Reactive
    index!: number;
    @Reactive
    total!: number;

    get point() {
        console.log('AxisLabel.point', this.stat, this.index, this.total);
        return valueToPoint(+this.stat.value + 10, this.index, this.total);
    }
}

@ResolveComponents({
    AxisLabel
})
@Template(svg`
<g>
  <polygon :points="points"></polygon>
  <circle cx="100" cy="100" r="80"></circle>
  <AxisLabel
    v-for="[index, stat] of stats.entries()"
    .stat="stat"
    .index="index"
    .total="stats.length"
  >
  </AxisLabel>
</g>`)
export class PolyGraph extends CivComponent {

    @Reactive
    stats: Axis[] = [];

    get points() {
        const total = this.stats.length;
        return this.stats.map((stat, i) => {
            const point = valueToPoint(stat.value, i, total);
            return `${point.x},${point.y}`;
        }).join(' ');
    }
}

@ResolveComponents({
    PolyGraph
})
@Template(html`
<div>
  <svg width="200" height="200">
    <PolyGraph .stats="stats"></PolyGraph>
  </svg>

  <!-- controls -->
  <div v-for="stat of stats">
    <label>{{stat.label}}</label>
    <input type="range" v-model="stat.value" min="0" max="100">
    <span>{{stat.value}}</span>
    <button @click="remove(stat)" class="remove">X</button>
  </div>

  <form id="add">
    <input name="newlabel" v-model="newLabel">
    <button @click="add">Add a Stat</button>
  </form>

  <pre id="raw">{{ JSON.stringify(stats, null, 2) }}</pre>
</div>`, css`
polygon {
  fill: #42b983;
  opacity: 0.75;
}

circle {
  fill: transparent;
  stroke: #999;
}

text {
  font-size: 10px;
  fill: #666;
}

label {
  display: inline-block;
  margin-left: 10px;
  width: 20px;
}

#raw {
  position: absolute;
  top: 0;
  left: 300px;
}`)
export class SvgApp extends CivComponent {

    @Reactive
    stats: Axis[] = [
        { label: 'A', value: 100 },
        { label: 'B', value: 100 },
        { label: 'C', value: 100 },
        { label: 'D', value: 100 },
        { label: 'E', value: 100 },
        { label: 'F', value: 100 }
    ];

    @Reactive
    newLabel = '';

    add(e: Event) {
        e.preventDefault()
        if (!this.newLabel) return
        this.stats.push({
            label: this.newLabel,
            value: 100
        })
        this.newLabel = ''
    }

    remove(stat: Axis) {
        if (this.stats.length > 3) {
            this.stats.splice(this.stats.indexOf(stat), 1)
        } else {
            alert("Can't delete more!")
        }
    }

}


new SvgApp().replaceElement(document.getElementById('app')!);
