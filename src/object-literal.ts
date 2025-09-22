import {
  ASTUtils,
  ESLintUtils,
  ParserServicesWithTypeInformation,
  TSESTree,
} from "@typescript-eslint/utils";
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

function isChildNode(node: TSESTree.Node, parentNode: TSESTree.Node) {
  let parent: TSESTree.Node | undefined = node;
  do {
    parent = parent.parent;
    if (parent === parentNode) {
      return true;
    }
  } while (parent);
  return false;
}

function splitTypes(types: ts.Type[]) {
  const result = {
    advancedTypes: [[], []] as ts.Type[][],
    basicTypes: [] as ts.Type[],
  };

  for (const type of types) {
    const callSignatures = type.getCallSignatures();
    if (callSignatures.length === 1) {
      result.advancedTypes[0].push(callSignatures[0].getReturnType());
      continue;
    }

    const arrayType = type.getNumberIndexType();
    if (arrayType && (type as TypeOptionalSymbol).symbol?.name === "Array") {
      result.advancedTypes[1].push(arrayType);
      continue;
    }

    result.basicTypes.push(type);
  }

  return result;
}

function report(
  properties: ts.Symbol[],
  parentNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties" | "noExcessProperty", []>>,
  services: ParserServicesWithTypeInformation,
) {
  const propertyNodes = properties.map((p) =>
    p.valueDeclaration
      ? services.tsNodeToESTreeNodeMap.get(p.valueDeclaration)
      : null,
  );

  if (propertyNodes.every((p) => p && isChildNode(p, parentNode))) {
    for (let i = 0; i < properties.length; i++) {
      context.report({
        data: { excessPropertyName: properties[i].name },
        messageId: "noExcessProperty",
        node: propertyNodes[i] ?? parentNode,
      });
    }
    return;
  }

  if (properties.length > 1) {
    context.report({
      data: { excessPropertyNames: properties.map((p) => p.name).join(", ") },
      messageId: "noExcessProperties",
      node: parentNode,
    });
    return;
  }

  context.report({
    data: { excessPropertyName: properties[0].name },
    messageId: "noExcessProperty",
    node: parentNode,
  });
}

function compareTypes(
  leftTypes: ts.Type[],
  rightTypes: ts.Type[],
  rightNode: TSESTree.Node,
  context: Readonly<RuleContext<"noExcessProperties" | "noExcessProperty", []>>,
  services: ParserServicesWithTypeInformation,
): void {
  const allLeftTypes = splitTypes(
    leftTypes.flatMap((t) => tsutils.unionConstituents(t)),
  );
  const allRightTypes = splitTypes(
    rightTypes.flatMap((t) => tsutils.unionConstituents(t)),
  );

  for (let i = 0; i < allLeftTypes.advancedTypes.length; i++) {
    if (
      allLeftTypes.advancedTypes[i].length > 0 &&
      allRightTypes.advancedTypes[i].length > 0
    ) {
      compareTypes(
        allLeftTypes.advancedTypes[i],
        allRightTypes.advancedTypes[i],
        rightNode,
        context,
        services,
      );
    }
  }

  for (const rightType of allRightTypes.basicTypes) {
    if (!isObjectLiteral(rightType)) {
      continue;
    }

    const rightProperties = rightType.getProperties();

    let bestMatchExcessProperties: ts.Symbol[] | null = null;
    for (const leftType of allLeftTypes.basicTypes) {
      const leftPropertyNames = leftType.getProperties().map((p) => p.name);

      if (
        leftType.getStringIndexType() !== undefined ||
        leftType.getNumberIndexType() !== undefined
      ) {
        bestMatchExcessProperties = null;
        break;
      }

      const excessProperties = rightProperties.filter(
        (p) =>
          !leftPropertyNames.includes(p.name) &&
          (p.flags & ts.SymbolFlags.Optional) === 0,
      );

      if (
        leftPropertyNames.length > 0 &&
        (bestMatchExcessProperties === null ||
          excessProperties.length < bestMatchExcessProperties.length)
      ) {
        bestMatchExcessProperties = excessProperties;
      }
    }

    if (bestMatchExcessProperties && bestMatchExcessProperties.length > 0) {
      report(bestMatchExcessProperties, rightNode, context, services);
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

        compareTypes([leftType], [rightType], node.right, context, services);
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

          compareTypes(
            [paramType],
            [argType],
            node.arguments[i],
            context,
            services,
          );
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

        compareTypes([leftType], [rightType], node, context, services);
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

        compareTypes([returnType], [argType], node.argument, context, services);
      },
      VariableDeclarator(node) {
        if (!node.id.typeAnnotation || !node.init) {
          return;
        }

        const leftType = services.getTypeAtLocation(
          node.id.typeAnnotation.typeAnnotation,
        );
        const rightType = services.getTypeAtLocation(node.init);

        compareTypes([leftType], [rightType], node.init, context, services);
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
      noExcessProperty: "Excess property '{{ excessPropertyName }}' found",
      noExcessProperties: "Excess properties '{{ excessPropertyNames }}' found",
    },
    schema: [],
    type: "suggestion",
  },
  name: "object-literal",
});

export default noExcessProperties;
