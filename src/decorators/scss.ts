// @ts-ignore
const sass = await import('https://jspm.dev/sass');

export function scss(strings: TemplateStringsArray, ...values: any[]): string {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
        result += strings[i];
        if (i < values.length) {
            result += values[i];
        }
    }

    return sass.compileString(result, { style: 'compressed' })
}
