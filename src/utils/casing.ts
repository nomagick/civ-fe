export function toKebabCase(className: string): string {
    return className
        // Insert hyphens before uppercase letters, digits following letters, 
        // and letters following digits
        .replace(/([a-z0-9])([A-Z])|([a-zA-Z])(\d)|(\d)([a-zA-Z])/g, '$1$3$5-$2$4$6')
        // Convert to lowercase
        .toLowerCase()
        // Replace spaces, underscores with hyphens and normalize multiple hyphens
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        // Remove leading/trailing hyphens
        .replace(/^-+|-+$/g, '');
}
