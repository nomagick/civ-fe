
export const GeneratorFunction = function* () { }.constructor as { new(...args: string[]): Generator };

// Functional approach alternative
export function extractForLoopTokens(forExpression: string): string[] {
    const parser = {
        extract(content: string): string[] {
            const declarationMatch = content.match(/^(.+?)\s+(?:of|in)\s+.+$/);
            const declaration = declarationMatch ? declarationMatch[1] : content.split(';')[0];

            return this.extractFromDeclaration(declaration.trim());
        },

        extractFromDeclaration(declaration: string): string[] {
            const tokens: string[] = [];
            const cleaned = declaration.replace(/^(const|let|var)\s+/, '');
            this.parsePattern(cleaned, tokens);
            return tokens;
        },

        parsePattern(pattern: string, tokens: string[]): void {
            const trimmedPattern = pattern.trim();

            if (trimmedPattern.startsWith('[')) {
                this.parseArrayPattern(trimmedPattern, tokens);
            } else if (trimmedPattern.startsWith('{')) {
                this.parseObjectPattern(trimmedPattern, tokens);
            } else {
                const identifier = trimmedPattern.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
                if (identifier) tokens.push(identifier[0]);
            }
        },

        parseArrayPattern(pattern: string, tokens: string[]): void {
            const inner = pattern.slice(1, -1);
            const elements = this.splitAtTopLevel(inner, ',');
            elements.forEach(element => {
                const trimmedElement = element.trim();
                if (trimmedElement) this.parsePattern(trimmedElement, tokens);
            });
        },

        parseObjectPattern(pattern: string, tokens: string[]): void {
            const inner = pattern.slice(1, -1);
            const properties = this.splitAtTopLevel(inner, ',');
            properties.forEach(property => {
                const trimmedProperty = property.trim();
                if (trimmedProperty) this.parseObjectProperty(trimmedProperty, tokens);
            });
        },

        parseObjectProperty(property: string, tokens: string[]): void {
            const colonIndex = this.findTopLevelChar(property, ':');

            if (colonIndex !== -1) {
                const value = property.slice(colonIndex + 1).trim();
                this.parsePattern(value, tokens);
            } else {
                const identifier = property.match(/^[a-zA-Z_$][a-zA-Z0-9_$]*/);
                if (identifier) tokens.push(identifier[0]);
            }
        },

        splitAtTopLevel(str: string, delimiter: string): string[] {
            const parts: string[] = [];
            let depth = 0;
            let current = '';

            for (const char of str) {
                if (char === '[' || char === '{') {
                    depth++;
                    current += char;
                } else if (char === ']' || char === '}') {
                    depth--;
                    current += char;
                } else if (char === delimiter && depth === 0) {
                    parts.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }

            parts.push(current);
            return parts;
        },

        findTopLevelChar(str: string, targetChar: string): number {
            let depth = 0;
            for (let i = 0; i < str.length; i++) {
                const char = str[i];
                if (char === '[' || char === '{') {
                    depth++;
                } else if (char === ']' || char === '}') {
                    depth--;
                } else if (char === targetChar && depth === 0) {
                    return i;
                }
            }
            return -1;
        }
    };

    return parser.extract(forExpression);
}
