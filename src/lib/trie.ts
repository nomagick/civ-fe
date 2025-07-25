const neverArr = [] as never[];
Object.freeze(neverArr);

export class TrieNode<T = unknown, D = unknown> {
    key: T;
    parent: TrieNode<T, D> | null = null;

    children?: Map<T, TrieNode<T, D>>;

    get isLeaf() {
        return this.children?.size === 0;
    }

    constructor(key: T, public payload?: D) {
        this.key = key;
    }

    get fullPath() {
        const output: T[] = [];
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: TrieNode<T> | null = this;

        while (node !== null) {
            output.unshift(node.key);
            node = node.parent;
        }

        return output;
    }

    insert(...series: T[]): TrieNode<T, D> {
        if (series.length === 0) {
            return this;
        }
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: TrieNode = this;

        for (const key of series) {
            node.children ??= new Map<T, TrieNode<T, D>>();
            if (!node.children.has(key)) {
                node.children.set(key, new TrieNode(key));
                node.children.get(key)!.parent = node;
            }

            node = node.children.get(key)!;
        }

        return node as any;
    }

    contains(...series: T[]) {
        if (series.length === 0) {
            throw new Error('Trie series must have at least one element');
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: TrieNode<T> | null = this;

        for (const key of series) {
            if (!node.children?.has(key)) {
                return false;
            }

            node = node.children.get(key)!;
        }

        return true;
    }

    seek(...series: T[]): { found: true; ptr: TrieNode<T, D>; payload?: D, deviation: never[] } | { found: false; ptr: TrieNode<T, D>; deviation: T[] } {
        if (series.length === 0) {
            return {
                found: true,
                ptr: this,
                payload: this.payload,
                deviation: neverArr
            };
        }

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let node: TrieNode<T, D> | null = this;
        const [head, ...tail] = series;

        if (!node.children?.has(head)) {
            return {
                found: false,
                ptr: node,
                deviation: series
            };
        }

        node = node.children.get(head)!;

        return node.seek(...tail) as any;
    }

    *ancestors() {
        let node: TrieNode<T> | null = this.parent;

        while (node !== null) {
            yield node;
            node = node.parent;
        }
    }

    *traverse(mode: 'dfs' | 'bfs' = 'dfs') {
        const stack: TrieNode<T>[] = [this];

        if (mode === 'bfs') {
            while (stack.length > 0) {
                const node = stack.shift()!;
                yield node;

                if (!node.children) {
                    continue;
                }

                for (const child of node.children.values()) {
                    stack.push(child);
                }
            }
            return;
        }

        // dfs
        while (stack.length > 0) {
            const node = stack.pop()!;
            yield node;

            if (!node.children) {
                continue;
            }

            for (const child of node.children.values()) {
                stack.push(child);
            }
        }

    }
}

