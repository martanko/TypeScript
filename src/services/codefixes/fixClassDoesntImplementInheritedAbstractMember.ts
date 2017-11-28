/* @internal */
namespace ts.codefix {
    //todo: group
    registerCodeFix({
        errorCodes: [
            Diagnostics.Non_abstract_class_0_does_not_implement_inherited_abstract_member_1_from_class_2.code,
            Diagnostics.Non_abstract_class_expression_does_not_implement_inherited_abstract_member_0_from_class_1.code,
        ],
        getCodeActions: getActionForClassLikeMissingAbstractMember
    });

    function getActionForClassLikeMissingAbstractMember(context: CodeFixContext): CodeAction[] | undefined {
        const sourceFile = context.sourceFile;
        const start = context.span.start;
        // This is the identifier in the case of a class declaration
        // or the class keyword token in the case of a class expression.
        const token = getTokenAtPosition(sourceFile, start, /*includeJsDocComment*/ false);
        const classDeclaration = token.parent;
        if (!isClassLike(classDeclaration)) {
            return undefined;
        }

        const checker = context.program.getTypeChecker();
        const extendsNode = getClassExtendsHeritageClauseElement(classDeclaration);
        const instantiatedExtendsType = checker.getTypeAtLocation(extendsNode);

        // Note that this is ultimately derived from a map indexed by symbol names,
        // so duplicates cannot occur.
        const extendsSymbols = checker.getPropertiesOfType(instantiatedExtendsType);
        const abstractAndNonPrivateExtendsSymbols = extendsSymbols.filter(symbolPointsToNonPrivateAndAbstractMember);

        const newNodes = createMissingMemberNodes(classDeclaration, abstractAndNonPrivateExtendsSymbols, checker);
        if (newNodes.length === 0) {
            return undefined;
        }

        const changes = textChanges.ChangeTracker.with(context, t => newNodesToChanges(sourceFile, newNodes, getOpenBraceOfClassLike(classDeclaration, sourceFile), t, context.newLineCharacter));
        return [{ description: getLocaleSpecificMessage(Diagnostics.Implement_inherited_abstract_class), changes }];
    }

    function symbolPointsToNonPrivateAndAbstractMember(symbol: Symbol): boolean {
        // See `codeFixClassExtendAbstractProtectedProperty.ts` in https://github.com/Microsoft/TypeScript/pull/11547/files
        // (now named `codeFixClassExtendAbstractPrivateProperty.ts`)
        const flags = getModifierFlags(first(symbol.getDeclarations()));
        return !(flags & ModifierFlags.Private) && !!(flags & ModifierFlags.Abstract);
    }
}
