import * as vscode from 'vscode';
import {CommentPolicy, Formatter} from 'fracturedjsonjs';

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
    vscode.languages.registerDocumentRangeFormattingEditProvider('json', { provideDocumentRangeFormattingEdits: provideRangeEdits });
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
        const obj = JSON.parse(oldText);
        const formatter = formatterWithOptions(textEditor.options);

        const newText = formatter.Serialize(obj) ?? "";

        // Delete the whole old doc and then insert the new one.  This avoids weird selection issues.
        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        vscode.window.showErrorMessage('FracturedJson: ' + err.message);
        const pos = getPostionFromError(err, textEditor.document);
        if (pos) {
            textEditor.selection = new vscode.Selection(pos, pos);
        }
    }
}

/**
 * Attempts to format the selected text as well-formed JSON.  Leading and trailing whitespace and commas are ignored,
 * as well as a leading property name and colon.  The remainder is expected to be a complete JSON list, object, string,
 * etc. (Called as a command.)
 * @param textEditor
 * @param edit
 */
function formatJsonSelection(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    try {
        // Restrict the text range to exclude leading and trailing junk.  This is just a convenience so the
        // user doesn't have to be super-careful when selecting a piece from a list or object.
        const trimmedSel = trimRange(textEditor.document, textEditor.selection);
        const oldText = textEditor.document.getText(trimmedSel);
        const obj = JSON.parse(oldText);

        // Figure out the leading whitespace for the initial line.  This might lead all the way up to the
        // trimmed selection, or it might precede, say, a property name that isn't part of the text being
        // formatted.
        //
        // Whatever that leading whitespace is, we'll use it as a prefix on every line of the formatted
        // JSON.  Otherwise, lines after the first wouldn't be indented enough when formatting a selection
        // in the middle of a doc.
        const startingLine = textEditor.document.lineAt(trimmedSel.start);
        const leadingWsRange = new vscode.Range(startingLine.lineNumber, 0, startingLine.lineNumber,
            startingLine.firstNonWhitespaceCharacterIndex);
        const leadingWs = textEditor.document.getText(leadingWsRange);

        const formatter = formatterWithOptions(textEditor.options);
        formatter.Options.PrefixString = leadingWs;

        // The formatted text includes the prefix string on all lines, but we don't want it on the first.
        const formattedText = formatter.Serialize(obj) ?? "";
        const newText = formattedText.substring(leadingWs.length);

        edit.replace(trimmedSel, newText);
    }
    catch (err: any) {
        vscode.window.showErrorMessage('FracturedJson: ' + err.message);
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
        const obj = JSON.parse(oldText);

        const newText = JSON.stringify(obj);

        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        vscode.window.showErrorMessage('FracturedJson: ' + err.message);
        const pos = getPostionFromError(err, textEditor.document);
        if (pos) {
            textEditor.selection = new vscode.Selection(pos, pos);
        }
    }
}

/**
 * Attempts to format the whole doument as nearly-minified JSON.  Children of the root element begin on their
 * line, but are themselves minified.  The gives you a still compact file, but the the user can easily select
 * a subelement and possibly expand it with Format Selection.  (Called as a command.)
 * @param textEditor
 * @param edit
 */
function nearMinifyJsonDocument(textEditor: vscode.TextEditor, edit: vscode.TextEditorEdit) {
    try {
        const oldText = textEditor.document.getText();
        const obj = JSON.parse(oldText);
        const formatter = formatterWithOptions(textEditor.options);
        formatter.Options.MaxInlineLength = Number.MAX_VALUE;
        formatter.Options.MaxTotalLineLength = Number.MAX_VALUE;
        formatter.Options.MaxInlineComplexity = Number.MAX_VALUE;
        formatter.Options.AlwaysExpandDepth = 0;
        formatter.Options.IndentSpaces = 0;
        formatter.Options.UseTabToIndent = false;
        formatter.Options.CommaPadding = false;
        formatter.Options.ColonPadding = false;
        formatter.Options.SimpleBracketPadding = false;
        formatter.Options.NestedBracketPadding = false;
        formatter.Options.CommentPadding = false;

        const newText = formatter.Serialize(obj) ?? "";

        edit.delete(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0));
        edit.insert(new vscode.Position(0, 0), newText);
    }
    catch (err: any) {
        vscode.window.showErrorMessage('FracturedJson: ' + err.message);
        const pos = getPostionFromError(err, textEditor.document);
        if (pos) {
            textEditor.selection = new vscode.Selection(pos, pos);
        }
    }
}

/**
 * Attempts to format the selected text as well-formed JSON.  Leading and trailing whitespace and commas are ignored,
 * as well as a leading property name and colon.  The remainder is expected to be a complete JSON list, object, string,
 * etc. (Called through the official formatting API - either to format a selection or the full doc.)
 */
function provideRangeEdits(document: vscode.TextDocument, range: vscode.Range,
    options: vscode.FormattingOptions, cancelToken: vscode.CancellationToken): vscode.TextEdit[] {
    // Restrict the text range to exclude leading and trailing junk.  This is just a convenience so the
    // user doesn't have to be super-careful when selecting a piece from a list or object.
    const trimmedSel = trimRange(document, range);
    const oldText = document.getText(trimmedSel);
    const obj = JSON.parse(oldText);

    // Figure out the leading whitespace for the initial line.  This might lead all the way up to the
    // trimmed selection, or it might precede, say, a property name that isn't part of the text being
    // formatted.
    //
    // Whatever that leading whitespace is, we'll use it as a prefix on every line of the formatted
    // JSON.  Otherwise, lines after the first wouldn't be indented enough when formatting a selection
    // in the middle of a doc.
    const startingLine = document.lineAt(trimmedSel.start);
    const leadingWsRange = new vscode.Range(startingLine.lineNumber, 0, startingLine.lineNumber,
        startingLine.firstNonWhitespaceCharacterIndex);
    const leadingWs = document.getText(leadingWsRange);

    const formatter = formatterWithOptions(options);
    formatter.Options.PrefixString = leadingWs;

    // The formatted text includes the prefix string on all lines, but we don't want it on the first.
    const formattedText = formatter.Serialize(obj) ?? "";
    const newText = formattedText.substring(leadingWs.length);

    return [vscode.TextEdit.replace(trimmedSel, newText)];
}


/**
 * Returns a new Range based on the given one, adjusted to skip any leading and trailing
 * whitespace and commas, and possibly a leading property name and colon.
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

// Leading stuff that we can safely ignore:
// * start-of-line
// * whitespace-or-commas
// * open-quote, then lots of either non-quote, escaped-quote, or escaped-slash, then close-quote
// * whitespace
// * colon
// * whitespace
const leadingJunkRegex = /^[\s,]*("([^"]|\\"|\\\\)*"\s*:)?\s*/;

// Trailing stuff we can safely ignore:
// * whitespace-or-comma
// * end-of-line
const trailingJunkRegex = /[\s,]*$/;


/**
 * Returns a new FracturedJson instance with settings pulled from the workspace
 * configuration.
 * @returns A configured FracturedJson object
 */
function formatterWithOptions(options: vscode.TextEditorOptions) {
    const formatter = new Formatter();

    // These settings come straight from our plugin's options.
    const config = vscode.workspace.getConfiguration('fracturedjsonvsc');
    formatter.Options.MaxInlineComplexity = config.MaxInlineComplexity;
    formatter.Options.MaxInlineLength = config.MaxInlineLength;
    formatter.Options.MaxCompactArrayComplexity = config.MaxCompactArrayComplexity;
    formatter.Options.NestedBracketPadding = config.NestedBracketPadding;
    formatter.Options.SimpleBracketPadding = config.SimpleBracketPadding;
    formatter.Options.ColonPadding = config.ColonPadding;
    formatter.Options.CommaPadding = config.CommaPadding;
    formatter.Options.AlwaysExpandDepth = config.AlwaysExpandDepth;
    formatter.Options.DontJustifyNumbers = config.DontJustifyNumbers;

    // FIXME
    formatter.Options.CommentPolicy = CommentPolicy.Preserve;

    switch (config.StringWidthPolicy) {
        case "CharacterCount": {
            formatter.StringLengthFunc = Formatter.StringLengthByCharCount;
            break;
        }
        case "EastAsianFullWidth":
        default: {
            formatter.StringLengthFunc = WideCharStringLength;
            break;
        }
    }

    // Use the editor's built-in mechanisms for tabs/spaces.
    formatter.Options.IndentSpaces = Number(options.tabSize);
    formatter.Options.UseTabToIndent = !options.insertSpaces;

    return formatter;
}

/**
 * Returns the Position mentioned in the error message, if possible.
 * @param err
 * @param document
 * @returns
 */
function getPostionFromError(err: Error, document: vscode.TextDocument): vscode.Position | null {
    if (!err) {
        return null;
    }

    const errMatch = err.message.match(errorRegex);
    if (!errMatch) {
        return null;
    }

    const offset = Number(errMatch[1]);
    return document.positionAt(offset);
}

function WideCharStringLength(str: string): number {
    return eaw.length(str);
}

const errorRegex = /at position (\d*)/;