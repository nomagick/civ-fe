import { toKebabCase } from '../../src/utils/casing';

describe('toKebabCase', () => {
    it('should convert camelCase to kebab-case', () => {
        expect(toKebabCase('camelCase')).toBe('camel-case');
        expect(toKebabCase('myVariableName')).toBe('my-variable-name');
    });

    it('should convert PascalCase to kebab-case', () => {
        expect(toKebabCase('PascalCase')).toBe('pascal-case');
        expect(toKebabCase('MyClassName')).toBe('my-class-name');
    });

    it('should handle snake_case', () => {
        expect(toKebabCase('snake_case')).toBe('snake-case');
        expect(toKebabCase('my_variable_name')).toBe('my-variable-name');
    });

    it('should handle spaces', () => {
        expect(toKebabCase('hello world')).toBe('hello-world');
        expect(toKebabCase('multiple   spaces')).toBe('multiple-spaces');
    });

    it('should handle numbers', () => {
        expect(toKebabCase('test123')).toBe('test-123');
        expect(toKebabCase('123test')).toBe('123-test');
        expect(toKebabCase('test123value')).toBe('test-123-value');
    });

    it('should handle mixed numbers and letters', () => {
        expect(toKebabCase('version2Update')).toBe('version-2-update');
        expect(toKebabCase('iOS10Update')).toBe('i-os-10-update');
    });

    it('should handle uppercase sequences', () => {
        expect(toKebabCase('HTTPSConnection')).toBe('httpsconnection');
        expect(toKebabCase('XMLParser')).toBe('xmlparser');
    });

    it('should remove leading and trailing hyphens', () => {
        expect(toKebabCase('-leading')).toBe('leading');
        expect(toKebabCase('trailing-')).toBe('trailing');
        expect(toKebabCase('--both--')).toBe('both');
    });

    it('should normalize multiple hyphens', () => {
        expect(toKebabCase('multiple---hyphens')).toBe('multiple-hyphens');
        expect(toKebabCase('test--value')).toBe('test-value');
    });

    it('should handle already kebab-case strings', () => {
        expect(toKebabCase('already-kebab-case')).toBe('already-kebab-case');
        expect(toKebabCase('kebab-case-string')).toBe('kebab-case-string');
    });

    it('should handle empty string', () => {
        expect(toKebabCase('')).toBe('');
    });

    it('should handle single character', () => {
        expect(toKebabCase('a')).toBe('a');
        expect(toKebabCase('A')).toBe('a');
    });

    it('should handle single word', () => {
        expect(toKebabCase('hello')).toBe('hello');
        expect(toKebabCase('HELLO')).toBe('hello');
    });

    it('should handle mixed separators', () => {
        expect(toKebabCase('my_variable Name')).toBe('my-variable-name');
        expect(toKebabCase('test_Case String')).toBe('test-case-string');
    });

    it('should convert to lowercase', () => {
        expect(toKebabCase('UPPERCASE')).toBe('uppercase');
        expect(toKebabCase('MixedCASE')).toBe('mixed-case');
    });

    it('should handle complex real-world examples', () => {
        expect(toKebabCase('ComponentName')).toBe('component-name');
        expect(toKebabCase('myHTTPServer2')).toBe('my-httpserver-2');
        expect(toKebabCase('parseHTML5Document')).toBe('parse-html-5-document');
        expect(toKebabCase('iOS_AppDelegate')).toBe('i-os-app-delegate');
    });

    it('should handle consecutive numbers', () => {
        expect(toKebabCase('test123456')).toBe('test-123456');
        expect(toKebabCase('version99Beta')).toBe('version-99-beta');
    });

    it('should handle numbers at start', () => {
        expect(toKebabCase('2ndPlace')).toBe('2-nd-place');
        expect(toKebabCase('1stItem')).toBe('1-st-item');
    });
});

