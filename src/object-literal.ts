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
  () => "https://bitbucket.org/unimorphic/eslint-plugin-no-excess-properties",
);

function isObjectLiteral(type: ts.Type): boolean {
  return (
    (type as TypeOptionalSymbol).symbol !== undefined &&
    tsutils.isSymbolFlagSet(type.symbol, ts.SymbolFlags.ObjectLiteral)
  );
}

function resolveType(type: ts.Type) {
  let resolvedType = type;

  const callSignatures = resolvedType.getCallSignatures();
  if (callSignatures.length === 1) {
    resolvedType = callSignatures[0].getReturnType();
  }

  const arrayType = resolvedType.getNumberIndexType();
  if (
    arrayType &&
    (resolvedType as TypeOptionalSymbol).symbol?.name === "Array"
  ) {
    resolvedType = arrayType;
  }

  return resolvedType;
}

function compareTypes(
  leftType: ts.Type,
  rightType: ts.Type,
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties", []>>,
): void {
  const allLeftTypes = tsutils.unionConstituents(leftType);
  const allRightTypes = tsutils.unionConstituents(rightType);

  for (const rightType of allRightTypes) {
    const rightResolvedType = resolveType(rightType);

    if (!isObjectLiteral(rightResolvedType)) {
      continue;
    }

    const rightPropertyNames = rightResolvedType
      .getProperties()
      .map((p) => p.name);

    let bestMatchExcessPropertyNames: string[] | null = null;
    for (const leftType of allLeftTypes) {
      const leftResolvedType = resolveType(leftType);
      const leftPropertyNames = leftResolvedType
        .getProperties()
        .map((p) => p.name);

      if (
        leftResolvedType.getStringIndexType() !== undefined ||
        leftResolvedType.getNumberIndexType() !== undefined
      ) {
        bestMatchExcessPropertyNames = null;
        break;
      }

      const excessPropertyNames = rightPropertyNames.filter(
        (n) => !leftPropertyNames.includes(n),
      );

      if (
        leftPropertyNames.length > 0 &&
        (bestMatchExcessPropertyNames === null ||
          excessPropertyNames.length < bestMatchExcessPropertyNames.length)
      ) {
        bestMatchExcessPropertyNames = excessPropertyNames;
      }
    }

    if (
      bestMatchExcessPropertyNames &&
      bestMatchExcessPropertyNames.length > 0
    ) {
      context.report({
        data: {
          excessPropertyNames: bestMatchExcessPropertyNames.join(", "),
        },
        messageId: "noExcessProperties",
        node: rightNode,
      });
    }
  }
}

const noExcessProperties = createRule({
  create: function (context) {
    const services = ESLintUtils.getParserServices(context);
    const typeChecker = services.program.getTypeChecker();

    return {
      AssignmentExpression(node) {
        const leftType = services.getTypeAtLocation(node.left);
        const rightType = services.getTypeAtLocation(node.right);

        compareTypes(leftType, rightType, node.right, context);
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
          let paramType = typeChecker.getTypeOfSymbolAtLocation(
            functionSignature.parameters[i],
            functionNode,
          );

          const declarations = functionSignature.parameters[i].declarations;
          if (
            declarations?.some((d) => ts.isParameter(d) && d.dotDotDotToken)
          ) {
            const arrayType = paramType.getNumberIndexType();
            if (arrayType) {
              paramType = arrayType;
            }
          }

          compareTypes(paramType, argType, node.arguments[i], context);
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

        compareTypes(leftType, rightType, node, context);
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
          functionNode.returnType.typeAnnotation,
        );
        if (
          (returnType as TypeOptionalSymbol).symbol?.name === "Promise" &&
          tsutils.isTypeReference(returnType)
        ) {
          const promiseTypes = typeChecker.getTypeArguments(returnType);
          if (promiseTypes.length === 1) {
            returnType = promiseTypes[0];
          }
        }

        const argType = services.getTypeAtLocation(node.argument);

        compareTypes(returnType, argType, node.argument, context);
      },
      VariableDeclarator(node) {
        if (!node.id.typeAnnotation || !node.init) {
          return;
        }

        const leftType = services.getTypeAtLocation(
          node.id.typeAnnotation.typeAnnotation,
        );
        const rightType = services.getTypeAtLocation(node.init);

        compareTypes(leftType, rightType, node.init, context);
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
    schema: [],
    type: "suggestion",
  },
  name: "object-literal",
});

export default noExcessProperties;
