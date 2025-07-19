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
import tseslint from "typescript-eslint";
import noExcessProperties from "eslint-plugin-no-excess-properties";

export default tseslint.config({
  extends: [
    noExcessProperties.configs.recommended,
  ],
})
```

### Fancy

```
import tseslint from "typescript-eslint";
import noExcessProperties from "eslint-plugin-no-excess-properties";

export default tseslint.config({
  plugins: {
    "no-excess-properties": noExcessProperties,
  },
  rules: {
    "no-excess-properties/object-literal": "error",
  },
})
```

## More Info

Related typescript-eslint issue: https://github.com/typescript-eslint/typescript-eslint/issues/10234

## Feedback

[Submit](https://bitbucket.org/unimorphic/eslint-plugin-no-excess-properties/issues/new) bug reports and other feedback in the [issues](https://bitbucket.org/unimorphic/eslint-plugin-no-excess-properties/issues?status=new&status=open) section

## License

MIT
