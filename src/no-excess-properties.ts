import { ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";

export interface PluginDocs {
  description: string;
  recommended?: boolean;
  requiresTypeChecking?: boolean;
}

const createRule = ESLintUtils.RuleCreator<PluginDocs>(
  () =>
    "https://bitbucket.org/unimorphic/eslint-plugin-no-excess-properties/README.MD"
);

interface OptionalSymbol {
  symbol: ts.Symbol | undefined;
}
type NameStrings = (string | undefined)[] | ts.__String[];

function compareNames(
  leftPropertyNames: NameStrings,
  rightPropertyNames: NameStrings,
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>
): void {
  leftPropertyNames = leftPropertyNames.map((s) => s?.toString());
  rightPropertyNames = rightPropertyNames.map((s) => s?.toString());

  const excessPropertyNames = rightPropertyNames.filter(
    (n) => n !== undefined && !leftPropertyNames.includes(n)
  );

  if (excessPropertyNames.length > 0) {
    context.report({
      data: { excessPropertyNames: excessPropertyNames },
      messageId: "noExcessProperties",
      node: rightNode,
    });
  }
}

function compareSymbols(
  leftSymbol: ts.Symbol | undefined,
  rightSymbol: ts.Symbol | undefined,
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>
): void {
  if (!leftSymbol || !rightSymbol) {
    return;
  }

  let leftPropertyNames: NameStrings = [];
  let rightPropertyNames: NameStrings = [];

  if (leftSymbol.members && rightSymbol.members) {
    leftPropertyNames = Array.from(leftSymbol.members.keys());
    rightPropertyNames = Array.from(rightSymbol.members.keys());
  }

  if (leftPropertyNames.length <= 0 || rightPropertyNames.length <= 0) {
    for (const declaration of leftSymbol.declarations ?? []) {
      if (
        ts.isFunctionLike(declaration) &&
        declaration.type &&
        ts.isTypeLiteralNode(declaration.type)
      ) {
        leftPropertyNames = declaration.type.members.map((m) =>
          ts.isPropertySignature(m) ? m.name.getText() : undefined
        );
      }
    }

    if (
      rightSymbol.valueDeclaration &&
      ts.isArrowFunction(rightSymbol.valueDeclaration) &&
      ts.isParenthesizedExpression(rightSymbol.valueDeclaration.body) &&
      ts.isObjectLiteralExpression(rightSymbol.valueDeclaration.body.expression)
    ) {
      rightPropertyNames =
        rightSymbol.valueDeclaration.body.expression.properties.map((p) =>
          p.name?.getText()
        );
    }
  }

  compareNames(leftPropertyNames, rightPropertyNames, rightNode, context);
}

const noExcessProperties = createRule({
  create: function (context) {
    const services = ESLintUtils.getParserServices(context);

    return {
      AssignmentExpression(node) {
        const leftType = services.getTypeAtLocation(node.left);
        const rightType = services.getTypeAtLocation(node.right);

        compareSymbols(leftType.symbol, rightType.symbol, node.right, context);
      },
      CallExpression(node) {
        if (node.arguments.length <= 0) {
          return;
        }

        const functionDeclaration = (
          services.getTypeAtLocation(node.callee) as OptionalSymbol
        ).symbol?.valueDeclaration;

        if (
          !functionDeclaration ||
          !ts.isFunctionDeclaration(functionDeclaration)
        ) {
          return;
        }

        for (let i = 0; i < functionDeclaration.parameters.length; i++) {
          if (i > node.arguments.length - 1) {
            break;
          }

          const param = functionDeclaration.parameters[i];
          const arg = services.getTypeAtLocation(node.arguments[i]);

          if (param.type && "symbol" in param.type) {
            compareSymbols(
              param.type.symbol as ts.Symbol,
              arg.symbol,
              node.arguments[i],
              context
            );
          }
        }
      },
      VariableDeclarator(node) {
        if (
          node.id.typeAnnotation?.typeAnnotation.type !==
            TSESTree.AST_NODE_TYPES.TSFunctionType ||
          node.init?.type !== TSESTree.AST_NODE_TYPES.ArrowFunctionExpression ||
          !node.id.typeAnnotation.typeAnnotation.returnType
        ) {
          return;
        }

        const functionReturn =
          node.id.typeAnnotation.typeAnnotation.returnType.typeAnnotation;
        const arrowFunction = node.init;

        const returnType = services.getTypeAtLocation(functionReturn);
        const arrowFunctionBodyType = services.getTypeAtLocation(
          arrowFunction.body
        );

        compareSymbols(
          returnType.symbol,
          arrowFunctionBodyType.symbol,
          arrowFunction.body,
          context
        );
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Excess properties are not allowed in assignments",
      recommended: true,
      requiresTypeChecking: true,
    },
    messages: {
      noExcessProperties: "Excess properties '{{ excessPropertyNames }}' found",
    },
    type: "suggestion",
    schema: [],
  },
  name: "no-excess-properties",
});

export default noExcessProperties;
