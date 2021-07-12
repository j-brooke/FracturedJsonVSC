# FracturedJson for Visual Studio Code

A JSON formatter that produces human-readable but fairly compact output.

* Arrays and objects are written on single lines, if their contents aren't too complex and the resulting line wouldn't be too long.
* Arrays can be written on multiple lines, with multiple items per line, as long as those items aren't too complex.
* Otherwise, each object property or array item is written begining on its own line, indented one step deeper than its parent.
* If several successive inline arrays or objects are similar enough, they will be formatted as a table.

This VSCode extension is part of a family of FracturedJson tools.  Check out the [browser-based formatter](https://j-brooke.github.io/FracturedJson/) to see related projects and to play around with the various formatting options.


---
## Features

This extension provides the following 4 commands.  You can access these from the Command Palette (shift-command-P or select it from the View menu).  You can set keybindings by clicking on the gear symbol in command palette.

### Format JSON Document

The **Format JSON Document** command reformats the entire document, inlining arrays and objects up to a certain degree of complexity and length, and then expanding the rest of the rest.  You can adjust the behavior with the extension's settings.

![Format JSON Document](images/Format-JSON-Document.gif)

![Format JSON Document 2](images/Format-JSON-Document-2.gif)


### Format JSON Selection

You can use the **Format JSON Selection** command to reformat just a piece of the document, if desired.  The selection must be a well-formed JSON element on its own (although leading and trailing whitespace and commas are skipped).


### Minify JSON Document

**Minify JSON Document** reformats the document as small as possible, just like every other minification tool out there.  (It's the same as JavaScript's `JSON.stringify` with no extra options.)


### Near-minify JSON Document

If your document's root element is an array with many children, it might be useful to use **Near-minify JSON Document**.  This will produce a document where each of the root element's children are separated by newlines, but otherwise minified.  This saves space but still allows you to pick out individual items (which you might then choose to expand with **Format JSON Selection** for instance).

![Near-minify JSON Document](images/Near-minify-JSON-Document.gif)


---
## Extension Settings

You can tune the formatting behavior with the properties in Settings -> Extensions -> FracturedJson.  The most important settings are:

* `Max Inline Length`: Maximum length (not counting indentation) of a complex element on a single line.
* `Max Inline Complexity`: Maximum nesting level that can be displayed on a single line.
* `Max Compact Array Complexity`: Maximum nesting level that can be arranged spanning multiple lines, with multiple items per line.

Indentation is controlled by the editor's standard settings (`editor.insertSpaces`, `editor.tabSize`, `editor.detectIndentation`, etc.).

Examples of all of the settings can be found on the [Options wiki page](https://github.com/j-brooke/FracturedJson/wiki/Options).  You can also experiment with the same functionality on the [browser-based formatter](https://j-brooke.github.io/FracturedJson/) page.


---
## Release Notes

### 2.0.0

FracturedJson now tries to format collections of inline arrays/objects in a tabular arrangement if it seems to make sense.  Two new settings - `Table Object Minimum Similarity` and `Table Array Minimum Similarity` - control how similar the inlined elements need to be to their siblings to qualify.  (Other settings, like `Max Inline Length` also factor in.)

In tables, and in arrays of just numbers, numbers are usually written right-aligned and with the same precision.  You can disable this behavior with the setting `Don't Justify Numbers`.

### 1.0.0

Initial release