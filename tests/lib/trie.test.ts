import { TrieNode } from '../../src/lib/trie';

describe('TrieNode', () => {
    describe('constructor', () => {
        it('should create a node with key', () => {
            const node = new TrieNode('a');
            
            expect(node.key).toBe('a');
            expect(node.parent).toBeNull();
            expect(node.payload).toBeUndefined();
        });

        it('should create a node with key and payload', () => {
            const payload = { value: 42 };
            const node = new TrieNode('a', payload);
            
            expect(node.key).toBe('a');
            expect(node.payload).toBe(payload);
        });
    });

    describe('isLeaf', () => {
        it('should return undefined for node without children', () => {
            const node = new TrieNode('a');
            
            expect(node.isLeaf).toBe(true);
        });

        it('should return true for node with empty children map', () => {
            const node = new TrieNode('a');
            node.children = new Map();
            
            expect(node.isLeaf).toBe(true);
        });

        it('should return false for node with children', () => {
            const node = new TrieNode('a');
            node.children = new Map();
            node.children.set('b', new TrieNode('b'));
            
            expect(node.isLeaf).toBe(false);
        });
    });

    describe('insert', () => {
        it('should insert single element', () => {
            const root = new TrieNode('root');
            
            const leaf = root.insert('a');
            
            expect(leaf.key).toBe('a');
            expect(leaf.parent).toBe(root);
            expect(root.children?.has('a')).toBe(true);
        });

        it('should insert multiple elements', () => {
            const root = new TrieNode('root');
            
            const leaf = root.insert('a', 'b', 'c');
            
            expect(leaf.key).toBe('c');
            expect(root.children?.has('a')).toBe(true);
            expect(root.children?.get('a')?.children?.has('b')).toBe(true);
            expect(root.children?.get('a')?.children?.get('b')?.children?.has('c')).toBe(true);
        });

        it('should return same node when inserting empty series', () => {
            const root = new TrieNode('root');
            
            const result = root.insert();
            
            expect(result).toBe(root);
        });

        it('should reuse existing nodes', () => {
            const root = new TrieNode('root');
            
            const leaf1 = root.insert('a', 'b');
            const leaf2 = root.insert('a', 'b');
            
            expect(leaf1).toBe(leaf2);
        });

        it('should create branching paths', () => {
            const root = new TrieNode('root');
            
            root.insert('a', 'b', 'c');
            root.insert('a', 'b', 'd');
            root.insert('a', 'e');
            
            expect(root.children?.size).toBe(1);
            expect(root.children?.get('a')?.children?.size).toBe(2);
            expect(root.children?.get('a')?.children?.get('b')?.children?.size).toBe(2);
        });

        it('should work with different key types', () => {
            const root = new TrieNode<number>(0);
            
            const leaf = root.insert(1, 2, 3);
            
            expect(leaf.key).toBe(3);
            expect(root.contains(1, 2, 3)).toBe(true);
        });
    });

    describe('contains', () => {
        it('should return true for existing series', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c');
            
            expect(root.contains('a', 'b', 'c')).toBe(true);
        });

        it('should return false for non-existing series', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c');
            
            expect(root.contains('a', 'b', 'd')).toBe(false);
        });

        it('should return false for partial series', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c');
            
            expect(root.contains('a', 'b')).toBe(true);
        });

        it('should throw error for empty series', () => {
            const root = new TrieNode('root');
            
            expect(() => root.contains()).toThrow('Trie series must have at least one element');
        });

        it('should return false for non-existing first element', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b');
            
            expect(root.contains('x', 'y')).toBe(false);
        });
    });

    describe('seek', () => {
        it('should find existing series', () => {
            const root = new TrieNode('root');
            const leaf = root.insert('a', 'b', 'c');
            leaf.payload = { value: 42 };
            
            const result = root.seek('a', 'b', 'c');
            
            expect(result.found).toBe(true);
            expect(result.ptr).toBe(leaf);
            expect(result.payload).toEqual({ value: 42 });
            expect(result.deviation).toEqual([]);
        });

        it('should return deviation for non-existing series', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b');
            
            const result = root.seek('a', 'b', 'c', 'd');
            
            expect(result.found).toBe(false);
            expect(result.deviation).toEqual(['c', 'd']);
        });

        it('should return current node for empty series', () => {
            const root = new TrieNode('root');
            root.payload = { value: 'root-payload' };
            
            const result = root.seek();
            
            expect(result.found).toBe(true);
            expect(result.ptr).toBe(root);
            expect(result.payload).toEqual({ value: 'root-payload' });
        });

        it('should return deviation at first element if not found', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b');
            
            const result = root.seek('x', 'y');
            
            expect(result.found).toBe(false);
            expect(result.ptr).toBe(root);
            expect(result.deviation).toEqual(['x', 'y']);
        });

        it('should handle partial matches', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c', 'd');
            
            const result = root.seek('a', 'b');
            
            expect(result.found).toBe(true);
            expect(result.ptr.key).toBe('b');
        });
    });

    describe('fullPath', () => {
        it('should return path from root to leaf', () => {
            const root = new TrieNode('root');
            const leaf = root.insert('a', 'b', 'c');
            
            const path = leaf.fullPath;
            
            expect(path).toEqual(['root', 'a', 'b', 'c']);
        });

        it('should return single element for root', () => {
            const root = new TrieNode('root');
            
            const path = root.fullPath;
            
            expect(path).toEqual(['root']);
        });

        it('should work for intermediate nodes', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c');
            
            const intermediate = root.children?.get('a')?.children?.get('b');
            const path = intermediate?.fullPath;
            
            expect(path).toEqual(['root', 'a', 'b']);
        });
    });

    describe('ancestors', () => {
        it('should iterate through ancestors', () => {
            const root = new TrieNode('root');
            const leaf = root.insert('a', 'b', 'c');
            
            const ancestors = Array.from(leaf.ancestors());
            
            expect(ancestors.length).toBe(3);
            expect(ancestors[0].key).toBe('b');
            expect(ancestors[1].key).toBe('a');
            expect(ancestors[2].key).toBe('root');
        });

        it('should return empty for root node', () => {
            const root = new TrieNode('root');
            
            const ancestors = Array.from(root.ancestors());
            
            expect(ancestors.length).toBe(0);
        });

        it('should return single ancestor for direct child', () => {
            const root = new TrieNode('root');
            const child = root.insert('a');
            
            const ancestors = Array.from(child.ancestors());
            
            expect(ancestors.length).toBe(1);
            expect(ancestors[0]).toBe(root);
        });
    });

    describe('traverse', () => {
        it('should traverse in DFS mode by default', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b');
            root.insert('c', 'd');
            
            const nodes = Array.from(root.traverse());
            const keys = nodes.map(n => n.key);
            
            expect(keys[0]).toBe('root');
            // DFS visits depth-first
        });

        it('should traverse in BFS mode', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b');
            root.insert('c', 'd');
            
            const nodes = Array.from(root.traverse('bfs'));
            const keys = nodes.map(n => n.key);
            
            expect(keys[0]).toBe('root');
            expect(keys[1]).toBe('a');
            expect(keys[2]).toBe('c');
        });

        it('should visit all nodes', () => {
            const root = new TrieNode(0);
            root.insert(1, 2, 3);
            root.insert(1, 4);
            root.insert(5);
            
            const nodes = Array.from(root.traverse('bfs'));
            
            expect(nodes.length).toBe(6); // root + 5 inserted nodes
        });

        it('should handle single node', () => {
            const root = new TrieNode('root');
            
            const nodes = Array.from(root.traverse());
            
            expect(nodes.length).toBe(1);
            expect(nodes[0]).toBe(root);
        });

        it('should handle linear chain', () => {
            const root = new TrieNode('root');
            root.insert('a', 'b', 'c', 'd');
            
            const nodes = Array.from(root.traverse('dfs'));
            
            expect(nodes.length).toBe(5);
        });
    });

    describe('parent relationship', () => {
        it('should maintain parent-child relationships', () => {
            const root = new TrieNode('root');
            const leaf = root.insert('a', 'b', 'c');
            
            expect(leaf.parent?.key).toBe('b');
            expect(leaf.parent?.parent?.key).toBe('a');
            expect(leaf.parent?.parent?.parent?.key).toBe('root');
            expect(leaf.parent?.parent?.parent?.parent).toBeNull();
        });
    });
});

