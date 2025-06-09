
export interface TemplateChunk {
    type: 'text' | 'expression';
    value: string;
}

export function parseTemplate(template: string): TemplateChunk[] {
    const regex = /{{(.*?)}}/g;
    let result: TemplateChunk[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(template)) !== null) {
        if (match.index > lastIndex) {
            result.push({
                type: 'text',
                value: template.slice(lastIndex, match.index)
            });
        }
        result.push({
            type: 'expression',
            value: match[1].trim()
        });
        lastIndex = regex.lastIndex;
    }

    if (lastIndex < template.length) {
        result.push({
            type: 'text',
            value: template.slice(lastIndex)
        });
    }

    return result;
}
