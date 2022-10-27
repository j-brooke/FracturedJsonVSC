import * as vscode from 'vscode';
import {CommentPolicy, Formatter, FracturedJsonError} from 'fracturedjsonjs';

// @ts-ignore
import * as eaw from 'eastasianwidth';

/**
 * Called by VSCode when the extension is first used.
 */
export function activate(context: vscode.ExtensionContext) {
    // Set up some regular commands.
    const fdReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.formatJsonDocument', formatJsonDocument);
    context.subscriptions.push(fdReg);

    const fsReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.formatJsonSelection', formatJsonSelection);
    context.subscriptions.push(fsReg);

    const minReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.minifyJsonDocument', minifyJsonDocument);
    context.subscriptions.push(minReg);

    const nearReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.nearMinifyJsonDocument', nearMinifyJsonDocument);
    context.subscriptions.push(nearReg);

    // Register with the official formatting API.
    vscode.languages.registerDocumentRangeFormattingEditProvider(['json', 'jsonc'], { provideDocumentRangeFormattingEdits: provideRangeEdits });
}

/**
 * Called by VSCode to shut down the extension.
 */
export function deactivate() { }


/**
 * Attempts to format the entire contents of the editor as JSON. (Called as a command.)
 * @param textEditor
 * @param edit
 */
function formatJsonDocument(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    try {
        const oldText = textEditor.document.getText();
        const formatter = formatterWithOptions(textEditor.options, textEditor.document.languageId);

        let newText = formatter.Reformat(oldText) ?? "";

        // Delete the whole old doc and then insert the new one.  This avoids weird selection issues.
        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        const [message, docOffset] = processError(err);
        if (message) {
            vscode.window.showErrorMessage('FracturedJson: ' + message);
        }
        if (docOffset !== undefined) {
            const editorPos = textEditor.document.positionAt(docOffset);
            textEditor.selection = new vscode.Selection(editorPos, editorPos);
        }
    }
}


/**
 * Attempts to format the selected text.  The selection should either be a complete JSON element - possibly with
 * comments - or a collection of elements such that adding [] or {} makes them complete.
 * (Called as a command.)
 * @param textEditor
 * @param edit
 */
function formatJsonSelection(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    const trimmedSelection = trimRange(textEditor.document, textEditor.selection);
    const trimmedContent = textEditor.document.getText(trimmedSelection);

    // Take note of the indentation on the first line of the selection.  This is from the start of the line to
    // the first character on the line, whether that's part of the selection or not.
    const originalIndents = getOriginalIndentation(textEditor.document, trimmedSelection);

    const formatter = formatterWithOptions(textEditor.options, textEditor.document.languageId);
    const newPartialText = formatPartialDocument(trimmedContent, originalIndents, formatter);
    if (newPartialText) {
        edit.replace(trimmedSelection, newPartialText);
    }
}

/**
 * Attempts to format the whole document as minified JSON.  (Called as a command.)
 * @param textEditor
 * @param edit
 */
function minifyJsonDocument(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    try {
        const oldText = textEditor.document.getText();
        const formatter = formatterWithOptions(textEditor.options, textEditor.document.languageId);

        const newText = formatter.Minify(oldText) ?? "";

        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        const [message, docOffset] = processError(err);
        if (message) {
            vscode.window.showErrorMessage('FracturedJson: ' + message);
        }
        if (docOffset !== undefined) {
            const editorPos = textEditor.document.positionAt(docOffset);
            textEditor.selection = new vscode.Selection(editorPos, editorPos);
        }
    }
}

/**
 * Attempts to format the whole document as nearly-minified JSON.  Children of the root element begin on their
 * line, but are themselves minified.  The gives you a still compact file, but the the user can easily select
 * a subelement and possibly expand it with Format Selection.  (Called as a command.)
 * @param textEditor
 * @param edit
 */
function nearMinifyJsonDocument(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    try {
        const oldText = textEditor.document.getText();
        const formatter = formatterWithOptions(textEditor.options, textEditor.document.languageId);
        formatter.Options.MaxInlineLength = Number.MAX_VALUE;
        formatter.Options.MaxTotalLineLength = Number.MAX_VALUE;
        formatter.Options.MaxInlineComplexity = Number.MAX_VALUE;
        formatter.Options.MaxCompactArrayComplexity = -1;
        formatter.Options.MaxTableRowComplexity = -1;
        formatter.Options.AlwaysExpandDepth = 0;
        formatter.Options.IndentSpaces = 0;
        formatter.Options.UseTabToIndent = false;
        formatter.Options.CommaPadding = false;
        formatter.Options.ColonPadding = false;
        formatter.Options.SimpleBracketPadding = false;
        formatter.Options.NestedBracketPadding = false;
        formatter.Options.CommentPadding = false;

        const newText = formatter.Reformat(oldText) ?? "";

        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        const [message, docOffset] = processError(err);
        if (message) {
            vscode.window.showErrorMessage('FracturedJson: ' + message);
        }
        if (docOffset !== undefined) {
            const editorPos = textEditor.document.positionAt(docOffset);
            textEditor.selection = new vscode.Selection(editorPos, editorPos);
        }
    }
}

/**
 * Attempts to format the selected text.  The selection should either be a complete JSON element - possibly with
 * comments - or a collection of elements such that adding [] or {} makes them complete.
 * (Called through the official formatting API - either to format a selection or the full doc.)
 */
function provideRangeEdits(document: vscode.TextDocument, range: vscode.Range,
    options: vscode.FormattingOptions, cancelToken: vscode.CancellationToken): vscode.TextEdit[] {
    const formatter = formatterWithOptions(options, document.languageId);

    // If the request is to format the whole doc, do it directly. There are too many edge cases if treated
    // the same as a selection format.
    const isWholeDoc = isWholeDocumentSelected(document, range);
    if (isWholeDoc) {
        const newWholeText = formatter.Reformat(document.getText());
        return (newWholeText)? [vscode.TextEdit.replace(range, newWholeText)] : [];
    }

    // Reduce the selection by getting rid of leading/trailing whitespace.  Otherwise it would throw our indentation
    // off.
    const trimmedRange = trimRange(document, range);
    const trimmedContent = document.getText(trimmedRange);

    // Take note of the indentation on the first line of the selection.  This is from the start of the line to
    // the first character on the line, whether that's part of the selection or not.
    const originalIndents = getOriginalIndentation(document, trimmedRange);

    const newPartialText = formatPartialDocument(trimmedContent, originalIndents, formatter);
    return (newPartialText)? [vscode.TextEdit.replace(trimmedRange, newPartialText)] : [];
}

function isWholeDocumentSelected(textDoc: vscode.TextDocument, range: vscode.Range): boolean {
    if (range.start.line !== 0 || range.start.character !== 0) {
        return false;
    }
    const endOfDoc = textDoc.positionAt(Number.MAX_VALUE);
    return range.end.isEqual(endOfDoc);
}

function formatPartialDocument(originalText: string, prefixWhitespace: string,
                               formatter: Formatter): string | undefined {
    formatter.Options.PrefixString = prefixWhitespace;

    // See if we can parse/reformat the selected text as a single top-level element (and possibly comments and blanks).
    try {
        return formatter.Reformat(originalText, 0)?.trim() ?? "";
    }
    catch (err1: any) {
        // Do nothing - fall through
    }

    formatter.Options.AllowTrailingCommas = true;
    formatter.Options.AlwaysExpandDepth = -2;

    // If we're trying to process some elements that aren't truly the last in their container, AND there's
    // a line comment at the end, give up.  It's just too complicated trying to figure out where to put the
    // comma back in.
    const replacementCommaMatch = originalText.match(/,\s*(\/\/.*)?$/);
    if (replacementCommaMatch && replacementCommaMatch[1]) {
        return undefined;
    }

    // But if there's no trailing comment, it's easy.  Just remember to deal with it later.
    const needsReplacementComma = Boolean(replacementCommaMatch);

    // Try wrapping the selected text in brackets to make it a dummy container.  (The \n before the close
    // is in case the selection ends in a line comment.)
    let fakeContainerOutput: string | undefined = undefined;
    try {
        const fakeArray = "[" + originalText + "\n]";
        fakeContainerOutput = formatter.Reformat(fakeArray, -1);
    }
    catch (err2: any) {
        // Do nothing - fall through
    }

    if (!fakeContainerOutput) {
        try {
            const fakeArray = "{" + originalText + "\n}";
            fakeContainerOutput = formatter.Reformat(fakeArray, -1);
        }
        catch (err3: any) {
            // Do nothing - fall through
        }
    }

    if (!fakeContainerOutput) {
        return undefined;
    }

    // Remove the fake container brackets (and the newline at the end).
    const outputWithoutContainer = fakeContainerOutput.substring(
        1+prefixWhitespace.length, fakeContainerOutput.length-2)
        .trim();

    // Remember to put the comma back, if necessary.
    return (needsReplacementComma)? outputWithoutContainer + "," : outputWithoutContainer;
}

function getOriginalIndentation(document: vscode.TextDocument, range: vscode.Range): string {
    const startingLine = document.lineAt(range.start);
    const leadingWsRange = new vscode.Range(startingLine.lineNumber, 0, startingLine.lineNumber,
        startingLine.firstNonWhitespaceCharacterIndex);
    return document.getText(leadingWsRange);
}

/**
 * Returns a new Range based on the given one, adjusted to skip any leading and trailing whitespace.
 * @param textDoc The document to which the range refers.
 * @param roughRange The range to be trimmed.
 * @returns A new range, the same size as the original or smaller.
 */
function trimRange(textDoc: vscode.TextDocument, roughRange: vscode.Range): vscode.Range {
    // Do some regex matches at the beginning and end of the selected text.  Note the lengths of the matches.
    const text = textDoc.getText(roughRange);
    const leadingJunkMatch = text.match(leadingJunkRegex);
    const leadingJunkAdjustment = (leadingJunkMatch) ? leadingJunkMatch[0].length : 0;
    const newStartPos = textDoc.positionAt(textDoc.offsetAt(roughRange.start) + leadingJunkAdjustment);
    const trailingJunkMatch = text.match(trailingJunkRegex);
    const trailingJunkAdjustment = (trailingJunkMatch) ? trailingJunkMatch[0].length : 0;
    const newEndPos = textDoc.positionAt(textDoc.offsetAt(roughRange.end) - trailingJunkAdjustment);

    // Return a range adjusted by the length of junk space from each end.
    return new vscode.Range(newStartPos, newEndPos);
}

// Leading stuff that we can safely ignore
const leadingJunkRegex = /^\s*/;

// Trailing stuff we can safely ignore
const trailingJunkRegex = /\s*$/;


/**
 * Returns a new FracturedJson instance with settings pulled from the workspace
 * configuration.
 * @returns A configured FracturedJson object
 */
function formatterWithOptions(options: vscode.TextEditorOptions, langId: string) {
    const formatter = new Formatter();

    // These settings come straight from our plugin's options.
    const config = vscode.workspace.getConfiguration('fracturedjsonvsc');

    formatter.Options.MaxInlineLength = config.v3.MaxInlineLength;
    formatter.Options.MaxTotalLineLength = config.v3.MaxTotalLineLength;
    formatter.Options.MaxInlineComplexity = config.v3.MaxInlineComplexity;
    formatter.Options.MaxCompactArrayComplexity = config.v3.MaxCompactArrayComplexity;
    formatter.Options.MaxTableRowComplexity = config.v3.MaxTableRowComplexity;
    formatter.Options.MinCompactArrayRowItems = config.v3.MinCompactArrayRowItems;
    formatter.Options.AlwaysExpandDepth = config.v3.AlwaysExpandDepth;

    formatter.Options.NestedBracketPadding = config.v3.NestedBracketPadding;
    formatter.Options.SimpleBracketPadding = config.v3.SimpleBracketPadding;
    formatter.Options.ColonPadding = config.v3.ColonPadding;
    formatter.Options.CommaPadding = config.v3.CommaPadding;
    formatter.Options.CommentPadding = config.v3.CommentPadding;

    formatter.Options.DontJustifyNumbers = config.v3.DontJustifyNumbers;
    formatter.Options.PreserveBlankLines = config.v3.PreserveBlankLines;
    formatter.Options.AllowTrailingCommas = config.v3.AllowTrailingCommas;

    switch (config.v3.StringWidthPolicy) {
        case "CharacterCount": {
            formatter.StringLengthFunc = Formatter.StringLengthByCharCount;
            break;
        }
        case "EastAsianFullWidth":
        default: {
            formatter.StringLengthFunc = wideCharStringLength;
            break;
        }
    }

    const relevantCommentSetting = (langId=="json")? config.v3.CommentPolicyForJSON : config.v3.CommentPolicyForJSONC;
    switch (relevantCommentSetting) {
        case "TreatAsError":
            formatter.Options.CommentPolicy = CommentPolicy.TreatAsError;
            break;
        case "Remove":
            formatter.Options.CommentPolicy = CommentPolicy.Remove;
            break;
        case "Preserve":
        default:
            formatter.Options.CommentPolicy = CommentPolicy.Preserve;
            break;
    }

    // Use the editor's built-in mechanisms for tabs/spaces.
    formatter.Options.IndentSpaces = Number(options.tabSize);
    formatter.Options.UseTabToIndent = !options.insertSpaces;

    return formatter;
}

function wideCharStringLength(str: string): number {
    return eaw.length(str);
}

function processError(err: any): readonly [message:string, docOffset?: number] {
    let messageToDisplay: string = err.message;
    let docOffset: number | undefined = undefined;
    if (err instanceof FracturedJsonError) {
        const errPos = (err as FracturedJsonError).InputPosition;
        const indexOfAt = err.message.indexOf(" at ");
        messageToDisplay = err.message.substring(0, indexOfAt);

        if (errPos) {
            messageToDisplay += ` at row=${errPos.Row+1}, col=${errPos.Column+1}`;
            docOffset = errPos.Index;
        }
    }
    return [messageToDisplay, docOffset];
}
