import { CivComponent, Reactive, Template, scss, html, maxConcurrency } from 'civ-fe';

const API_URL = `https://api.github.com/repos/nomagick/civ-fe/commits?per_page=3&sha=`;

@Template(html`
<div>
    <h1>Latest Civ-FE Commits</h1>
    <span v-for="branch of branches">
      <input type="radio"
        :id="branch"
        :value="branch"
        name="branch"
        v-model="currentBranch">
      <label :for="branch">{{ branch }}</label>
    </span>
    <p>nomagick/civ-fe@{{ currentBranch }}</p>
    <ul v-if="commits.length > 0">
      <li v-for="{ html_url, sha, author, commit } of commits">
        <a :href="html_url" target="_blank" class="commit">{{ sha.slice(0, 7) }}</a>
        - <span class="message">{{ truncate(commit.message) }}</span><br>
        by <span class="author">
          <a :href="author.html_url" target="_blank">{{ commit.author.name }}</a>
        </span>
        at <span class="date">{{ formatDate(commit.author.date) }}</span>
      </li>
    </ul>
</div>
`, scss`
:host {
    a {
        text-decoration: none;
        color: #42b883;
    }
    li {
        line-height: 1.5em;
        margin-bottom: 20px;
    }
    .author,
    .date {
        font-weight: bold;
    }
}
`)
export default class FetchingData extends CivComponent {

    branches = ['main', 'release']

    @Reactive
    currentBranch: this['branches'][number] = this.branches[0];

    @Reactive
    commits: unknown[] = [];

    truncate(v: string) {
        const newline = v.indexOf('\n')
        return newline > 0 ? v.slice(0, newline) : v
    }

    formatDate(v: string) {
        return v.replace(/T|Z/g, ' ')
    }

    @maxConcurrency(1)
    async updateBranchRoutine() {
        const url = `${API_URL}${this.currentBranch}`;
        this.commits = await (await fetch(url)).json();
    }

    constructor() {
        super();

        this.watch('currentBranch', (branch) => {
            console.log(`Fetching commits for branch: ${branch}`);
            this.updateBranchRoutine();
        }, { immediate: true });
    }

}