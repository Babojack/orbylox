import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

export default [
  {
    files: ["src/**/*.{js,mjs,cjs,jsx}"],
    ...pluginJs.configs.recommended,
    ...pluginReact.configs.flat.recommended,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
    },
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "unused-imports": pluginUnusedImports,
    },
    rules: {
      // Undefinierte Bezeichner sind Laufzeitfehler — hier abfangen, nicht beim Nutzer.
      "no-undef": "error",
      /**
       * Zugriff auf eine Variable VOR ihrer Deklaration.
       *
       * Das ist kein Stilthema, sondern ein Absturz: `const` und `let` sind
       * bis zu ihrer Zeile gesperrt, der Zugriff wirft "Cannot access X before
       * initialization". Genau das ist passiert — in `ProjectsList` griff eine
       * `useMemo` auf `projects` zu, das erst 70 Zeilen weiter unten aus der
       * Abfrage kam. Die Projektliste war komplett weiss, und weder `npm run
       * build` noch der Linter sagten ein Wort.
       *
       * `functions: false`, weil Funktionsdeklarationen hochgezogen werden und
       * ihr Aufruf vor der Zeile völlig in Ordnung ist — das ist im React-Code
       * üblich und kein Fehler.
       */
      "no-use-before-define": [
        "error",
        { functions: false, classes: true, variables: true, allowNamedExports: false },
      ],
      "no-unused-vars": "off",
      "react/jsx-uses-vars": "error",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unknown-property": [
        "error",
        { ignore: ["cmdk-input-wrapper", "toast-close"] },
      ],
      "react-hooks/rules-of-hooks": "error",
    },
  },
];
