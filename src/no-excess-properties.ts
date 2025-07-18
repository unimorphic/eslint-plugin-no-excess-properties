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

type TypeOptionalSymbol = Omit<ts.Type, "symbol"> & {
  symbol: ts.Symbol | undefined;
};

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
      data: { excessPropertyNames: excessPropertyNames.join(", ") },
      messageId: "noExcessProperties",
      node: rightNode,
    });
  }
}

function compareSymbols(
  leftType: TypeOptionalSymbol,
  rightType: TypeOptionalSymbol,
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>
): void {
  if (!leftType.symbol || !rightType.symbol) {
    return;
  }

  let leftPropertyNames: NameStrings = [];
  let rightPropertyNames: NameStrings = [];

  if (
    leftType.symbol.members &&
    rightType.symbol.members &&
    rightType.symbol.escapedName.toString() === "__object"
  ) {
    leftPropertyNames = leftType.getProperties().map((p) => p.name);
    rightPropertyNames = rightType.getProperties().map((p) => p.name);
  }

  if (leftPropertyNames.length <= 0 || rightPropertyNames.length <= 0) {
    const leftCallSignatures = leftType.getCallSignatures();
    if (leftCallSignatures.length === 1) {
      const returnTypeProperties = leftCallSignatures[0]
        .getReturnType()
        .getNonNullableType()
        .getProperties();
      leftPropertyNames = returnTypeProperties.map((p) => p.name);
    }

    const rightCallSignatures = rightType.getCallSignatures();
    if (rightCallSignatures.length === 1) {
      const returnType = rightCallSignatures[0]
        .getReturnType()
        .getNonNullableType() as TypeOptionalSymbol;

      if (returnType.symbol?.escapedName.toString() === "__object") {
        rightPropertyNames = returnType.getProperties().map((p) => p.name);
      }
    }
  }

  compareNames(leftPropertyNames, rightPropertyNames, rightNode, context);
}

const noExcessProperties = createRule({
  create: function (context) {
    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();

    return {
      AssignmentExpression(node) {
        const leftType = services.getTypeAtLocation(node.left);
        const rightType = services.getTypeAtLocation(node.right);

        compareSymbols(leftType, rightType, node.right, context);
      },
      CallExpression(node) {
        if (node.arguments.length <= 0) {
          return;
        }

        const functionNode = services.esTreeNodeToTSNodeMap.get(node);
        const functionSignature =
          typeChecker.getResolvedSignature(functionNode);

        if (!functionSignature) {
          return;
        }

        for (let i = 0; i < functionSignature.parameters.length; i++) {
          if (i > node.arguments.length - 1) {
            break;
          }

          const arg = services.getTypeAtLocation(node.arguments[i]);
          const paramType = typeChecker.getTypeOfSymbolAtLocation(
            functionSignature.parameters[i],
            functionNode
          ) as TypeOptionalSymbol;

          if (paramType.symbol?.escapedName.toString() !== "Array") {
            compareSymbols(paramType, arg, node.arguments[i], context);
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
          returnType,
          arrowFunctionBodyType,
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
