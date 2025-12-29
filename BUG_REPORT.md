# Bug Report for Civ-FE Repository

## Summary
Found 5 bugs in the codebase through systematic code review and analysis.

---

## Bug #1: Incorrect Import Path in Router
**File:** `src/civ-router.ts`  
**Line:** 5  
**Severity:** High (Runtime Error)

**Issue:**
```typescript
import { setImmediate } from 'lib/lang';
```

**Problem:** The import uses an absolute path `'lib/lang'` instead of a relative path. This will fail at runtime unless there's a specific module resolution configuration.

**Fix:**
```typescript
import { setImmediate } from './lib/lang';
```

---

## Bug #2: Syntax Error - Extra Backticks
**File:** `src/lib/attr.ts`  
**Line:** 112  
**Severity:** High (Syntax Error)

**Issue:**
```typescript
                    }``
```

**Problem:** There are two extra backticks (``) at the end of the closing brace. This appears to be a typo that creates invalid syntax.

**Fix:**
```typescript
                    }
```

---

## Bug #3: Incorrect Set Constructor Usage
**File:** `src/lib/attr.ts`  
**Line:** 66  
**Severity:** High (Runtime Error)

**Issue:**
```typescript
target[REACTIVE_ATTR_MAPPING][attrName] = new Set<string>(...(target[REACTIVE_ATTR_MAPPING][attrName] || []));
```

**Problem:** The spread operator `...` is incorrectly used with the `Set` constructor. The `Set` constructor expects a single iterable argument, not spread arguments. When `target[REACTIVE_ATTR_MAPPING][attrName]` exists and contains items, this will cause a runtime error like:
```
TypeError: [element] is not iterable (cannot read property Symbol(Symbol.iterator))
```

**Example of failure:**
```javascript
// If target[REACTIVE_ATTR_MAPPING][attrName] is a Set with ["key1", "key2"]
new Set(...["key1", "key2"])  // Becomes: new Set("key1", "key2") - ERROR!
```

**Fix:**
```typescript
target[REACTIVE_ATTR_MAPPING][attrName] = new Set<string>(target[REACTIVE_ATTR_MAPPING][attrName] || []);
```

---

## Bug #4: Incorrect ReactiveKit Property Access
**File:** `src/lib/attr.ts`  
**Line:** 109  
**Severity:** Medium (Logic Error)

**Issue:**
```typescript
Reflect.set(this[REACTIVE_KIT], key, v);
```

**Problem:** The code is setting a property directly on the `ReactiveKit` instance instead of on its `proxy` property. This bypasses the reactive proxy system and won't trigger change detection/reactivity updates. Looking at other usages in the codebase (e.g., `reactive.ts` line 55), the correct pattern is to set on `this[REACTIVE_KIT].proxy`.

**Fix:**
```typescript
Reflect.set(this[REACTIVE_KIT].proxy, key, v);
```

---

## Bug #5: Undefined Type Reference
**File:** `src/civ-component.ts`  
**Line:** 175  
**Severity:** Medium (Type Error)

**Issue:**
```typescript
this.__shadowRoot = this.attachShadow({ mode: 'open', registry: (this.constructor as typeof CivElement).customElementRegistry });
```

**Problem:** The code references `CivElement` which is not defined anywhere in the codebase. A search through all TypeScript files shows no export or definition of `CivElement`. This appears to be a typo and should likely be `CivComponent`.

**Fix:**
```typescript
this.__shadowRoot = this.attachShadow({ mode: 'open', registry: (this.constructor as typeof CivComponent).customElementRegistry });
```

---

## Testing Recommendations

1. **Bug #1 & #2:** These will likely cause immediate runtime/parse errors in certain conditions and should be fixed immediately.

2. **Bug #3:** Add unit tests for the `ReactiveAttr` decorator, specifically testing cases where attributes are observed on elements that already have reactive attribute mappings.

3. **Bug #4:** Test the reactive attribute system to ensure attribute changes properly trigger reactive updates.

4. **Bug #5:** Verify shadow DOM functionality with extended HTMLElement classes.

---

## Additional Notes

- The TypeScript compiler didn't catch most of these issues, likely due to:
  - `@ts-ignore` comments suppressing type checking
  - Loose module resolution settings
  - Runtime-only bugs that don't manifest at compile time

- Consider enabling stricter TypeScript compiler options and reducing the use of `@ts-ignore` comments.
