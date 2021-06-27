"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deactivate = exports.activate = void 0;
const vscode = require("vscode");
const FracturedJson = require('fracturedjsonjs');
/**
 * Called by VSCode when the extension is first used.
 */
function activate(context) {
    const fdReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.formatJsonDocument', formatJsonDocument);
    context.subscriptions.push(fdReg);
    const fsReg = vscode.commands.registerTextEditorCommand('fracturedjsonvsc.formatJsonSelection', formatJsonSelection);
    context.subscriptions.push(fsReg);
}
exports.activate = activate;
/**
 * Called by VSCode to shut down the extension.
 */
function deactivate() { }
exports.deactivate = deactivate;
/**
 * Attempts to format the entire contents of the editor as JSON.
 * @param textEditor
 * @param edit
 */
function formatJsonDocument(textEditor, edit) {
    try {
        const oldText = textEditor.document.getText();
        const obj = JSON.parse(oldText);
        const formatter = formatterWithOptions(textEditor);
        const newText = formatter.Serialize(obj);
        edit.replace(new vscode.Range(0, 0, textEditor.document.lineCount + 1, 0), newText);
    }
    catch (err) {
        console.log(err);
        vscode.window.showErrorMessage(err.message);
    }
}
/**
 * Attempts to format the selected text a well-formed JSON.  Leading and trailing whitespace and commas are ignored.
 * The remainder is expected to be a complete JSON list, object, string, etc.
 * @param textEditor
 * @param edit
 */
function formatJsonSelection(textEditor, edit) {
    try {
        // Restrict the text range to exclude leading and trailing whitespace, as well as commas.
        // The comma thing is just a convenience so the user doesn't have to be super-careful when
        // selecting a piece from a list or object.
        const trimmedSel = trimRange(textEditor, textEditor.selection);
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
        const leadingWsRange = new vscode.Range(startingLine.lineNumber, 0, startingLine.lineNumber, startingLine.firstNonWhitespaceCharacterIndex);
        const leadingWs = textEditor.document.getText(leadingWsRange);
        const formatter = formatterWithOptions(textEditor);
        formatter.PrefixString = leadingWs;
        // The formatted text includes the prefix string on all lines, but we don't want it on the first.
        const newText = formatter.Serialize(obj).substring(leadingWs.length);
        edit.replace(trimmedSel, newText);
    }
    catch (err) {
        console.log(err);
        vscode.window.showErrorMessage(err.message);
    }
}
/**
 * Returns a new Range based on the given one, adjusted to skip any leading and trailing
 * whitespace and commas.
 * @param textEditor The editor to which the range refers.
 * @param roughRange The range to be trimmed.
 * @returns A new range, the same size as the original or smaller.
 */
function trimRange(textEditor, roughRange) {
    let startPos = roughRange.start;
    let endPos = roughRange.end;
    while (true) {
        const afterStartPos = positionAfter(textEditor, startPos);
        const charAtStart = textEditor.document.getText(new vscode.Range(startPos, afterStartPos));
        const isCharWhitespace = isWhitespaceOrComma(charAtStart);
        const isPastEnd = startPos.isAfterOrEqual(endPos);
        if (isPastEnd || !isCharWhitespace) {
            break;
        }
        startPos = afterStartPos;
    }
    while (true) {
        const beforeEndPos = positionBefore(textEditor, endPos);
        const charAtEnd = textEditor.document.getText(new vscode.Range(beforeEndPos, endPos));
        const isCharWhitespace = isWhitespaceOrComma(charAtEnd);
        const isPastEnd = startPos.isAfterOrEqual(endPos);
        if (isPastEnd || !isCharWhitespace) {
            break;
        }
        endPos = beforeEndPos;
    }
    return new vscode.Range(startPos, endPos);
}
/**
 * Returns true if the given string is a single character of whitespace or the comma character.
 * @param val A one-character string
 * @returns True if it's whitespace or comma.
 */
function isWhitespaceOrComma(val) {
    return (val.search(nonWhitespaceRegex) >= 0);
}
const nonWhitespaceRegex = /[\s,]/;
/**
 * Returns the Position before the given one, wrapping to the end of the previous
 * line if already at the start of a line.
 */
function positionBefore(textEditor, position) {
    if (position.character > 0) {
        return position.translate(0, -1);
    }
    if (position.line === 0) {
        return position;
    }
    const lineAbove = textEditor.document.lineAt(position.line - 1);
    return lineAbove.range.end;
}
/**
 * Returns the Position after the given one, wrapping to the next line if already
 * at the end.
 */
function positionAfter(textEditor, position) {
    const line = textEditor.document.lineAt(position.line);
    if (position.isAfterOrEqual(line.range.end)) {
        return new vscode.Position(position.line + 1, 0);
    }
    return position.translate(0, 1);
}
/**
 * Returns a new FracturedJson instance with settings pulled from the workspace
 * configuration.
 * @returns A configured FracturedJson object
 */
function formatterWithOptions(textEditor) {
    const formatter = new FracturedJson();
    // These settings come straight from our plugin's options.
    const config = vscode.workspace.getConfiguration('fracturedjsonvsc');
    formatter.MaxInlineComplexity = config.MaxInlineComplexity;
    formatter.MaxInlineLength = config.MaxInlineLength;
    formatter.MaxCompactArrayComplexity = config.MaxCompactArrayComplexity;
    formatter.NestedBracketPadding = config.NestedBracketPadding;
    formatter.ColonPadding = config.ColonPadding;
    formatter.CommaPadding = config.CommaPadding;
    formatter.JustifyNumberLists = config.JustifyNumberLists;
    formatter.AlwaysExpandDepth = config.AlwaysExpandDepth;
    // Use the editor's built-in mechanisms for tabs/spaces.
    formatter.IndentString = textEditor.options.insertSpaces ?
        ' '.repeat(Number(textEditor.options.tabSize))
        : '\t';
    return formatter;
}
//# sourceMappingURL=extension.js.map