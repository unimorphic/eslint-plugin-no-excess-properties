# eslint-plugin-no-excess-properties

ESLint plugin for TypeScript that warns when there are excess properties on object literals

Currently has a single rule `no-excess-properties/object-literal` that uses [typed linting](https://typescript-eslint.io/getting-started/typed-linting)

## Install

```
npm install --save-dev eslint-plugin-no-excess-properties
```

## Config

In the `eslint.config.mjs` file:

### Basic

```
import { defineConfig } from "eslint/config";
import noExcessProperties from "eslint-plugin-no-excess-properties";

export default defineConfig({
  extends: [
    noExcessProperties.configs.recommended,
  ],
})
```

### Fancy

```
import { defineConfig } from "eslint/config";
import noExcessProperties from "eslint-plugin-no-excess-properties";

export default defineConfig({
  plugins: {
    "no-excess-properties": noExcessProperties,
  },
  rules: {
    "no-excess-properties/object-literal": "error",
  },
})
```

## Example Linted Code

See the [test file](https://github.com/unimorphic/eslint-plugin-no-excess-properties/blob/master/src/object-literal.test.ts) for more examples

### Incorrect

```
let test1: { prop1: number; } = { prop1: 1 };
const test2 = { prop1: 2, extraPropertyNotInTest1: 3 };
test1 = test2; // Error
```

### Correct

```
let test1: { prop1: number; } = { prop1: 1 };
const test2 = { prop1: 2 };
test1 = test2; // OK
```

## More Info

Related typescript-eslint issue: https://github.com/typescript-eslint/typescript-eslint/issues/10234

## Feedback

[Submit](https://github.com/unimorphic/eslint-plugin-no-excess-properties/issues/new) bug reports and other feedback in the [issues](https://github.com/unimorphic/eslint-plugin-no-excess-properties/issues) section

## License

MIT
