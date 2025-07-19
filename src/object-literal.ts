import { ASTUtils, ESLintUtils, TSESTree } from "@typescript-eslint/utils";
import { RuleContext } from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";
import * as tsutils from "ts-api-utils";

export interface PluginDocs {
  description: string;
  recommended?: boolean;
  requiresTypeChecking?: boolean;
}

type TypeOptionalSymbol = Omit<ts.Type, "symbol"> & {
  symbol: ts.Symbol | undefined;
};

const createRule = ESLintUtils.RuleCreator<PluginDocs>(
  () =>
    "https://bitbucket.org/unimorphic/eslint-plugin-no-excess-properties/README.md"
);

function getAllPropertyNames(type: ts.Type): string[] {
  const allTypes = tsutils.typeConstituents(type);

  return allTypes.reduce<string[]>(
    (all, t) => all.concat(...t.getProperties().map((p) => p.name)),
    []
  );
}

function isObjectLiteral(type: ts.Type): boolean {
  const allTypes = tsutils.typeConstituents(type);

  return allTypes.some(
    (t) =>
      (t as TypeOptionalSymbol).symbol !== undefined &&
      tsutils.isSymbolFlagSet(t.symbol, ts.SymbolFlags.ObjectLiteral)
  );
}

function compareNames(
  leftPropertyNames: string[],
  rightPropertyNames: string[],
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>
): void {
  if (leftPropertyNames.length <= 0) {
    return;
  }

  const excessPropertyNames = rightPropertyNames.filter(
    (n) => !leftPropertyNames.includes(n)
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
  leftType: ts.Type,
  rightType: ts.Type,
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>
): void {
  if (leftType.getStringIndexType() || leftType.getNumberIndexType()) {
    return;
  }

  let leftPropertyNames: string[] = [];
  let rightPropertyNames: string[] = [];

  if (isObjectLiteral(rightType)) {
    leftPropertyNames = getAllPropertyNames(leftType);
    rightPropertyNames = getAllPropertyNames(rightType);
  }

  if (leftPropertyNames.length <= 0 || rightPropertyNames.length <= 0) {
    const leftCallSignatures = leftType.getCallSignatures();
    if (leftCallSignatures.length === 1) {
      const returnType = leftCallSignatures[0].getReturnType();

      leftPropertyNames = getAllPropertyNames(returnType);
    }

    const rightCallSignatures = rightType.getCallSignatures();
    if (rightCallSignatures.length === 1) {
      const returnType = rightCallSignatures[0].getReturnType();

      if (isObjectLiteral(returnType)) {
        rightPropertyNames = getAllPropertyNames(returnType);
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

          const argType = services.getTypeAtLocation(node.arguments[i]);
          const paramType = typeChecker.getTypeOfSymbolAtLocation(
            functionSignature.parameters[i],
            functionNode
          );

          compareSymbols(paramType, argType, node.arguments[i], context);
        }
      },
      Property(node) {
        const leftNode = services.esTreeNodeToTSNodeMap.get(node);

        if (leftNode.kind !== ts.SyntaxKind.PropertyAssignment) {
          return;
        }

        const leftType = typeChecker.getContextualType(leftNode.initializer);
        const rightType = services.getTypeAtLocation(node);

        if (!leftType) {
          return;
        }

        compareSymbols(leftType, rightType, node, context);
      },
      ReturnStatement(node) {
        if (!node.argument) {
          return;
        }

        let functionNode: TSESTree.Node | undefined = node.parent;
        while (functionNode && !ASTUtils.isFunction(functionNode)) {
          functionNode = functionNode.parent;
        }

        if (!functionNode?.returnType) {
          return;
        }

        let returnType = services.getTypeAtLocation(
          functionNode.returnType.typeAnnotation
        );
        if (
          returnType.symbol.name === "Promise" &&
          tsutils.isTypeReference(returnType)
        ) {
          const promiseTypes = typeChecker.getTypeArguments(returnType);
          if (promiseTypes.length === 1) {
            returnType = promiseTypes[0];
          }
        }

        const argType = services.getTypeAtLocation(node.argument);

        compareSymbols(returnType, argType, node.argument, context);
      },
      VariableDeclarator(node) {
        if (!node.id.typeAnnotation || !node.init) {
          return;
        }

        const leftType = services.getTypeAtLocation(
          node.id.typeAnnotation.typeAnnotation
        );
        const rightType = services.getTypeAtLocation(node.init);

        compareSymbols(leftType, rightType, node.init, context);
      },
    };
  },
  defaultOptions: [],
  meta: {
    docs: {
      description: "Warn when excess properties are found on object literals",
      recommended: true,
      requiresTypeChecking: true,
    },
    messages: {
      noExcessProperties: "Excess properties '{{ excessPropertyNames }}' found",
    },
    type: "suggestion",
    schema: [],
  },
  name: "object-literal",
});

export default noExcessProperties;
