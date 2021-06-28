# FracturedJson for Visual Studio Code

A JSON formatter that produces human-readable but fairly compact output.

* Arrays and objects are written on single lines, if their contents aren't too complex and the resulting line wouldn't be too long.
* Arrays can be written on multiple lines, with multiple items per line, as long as those items aren't too complex.
* Otherwise, each object property or array item is written begining on its own line, indented one step deeper than its parent.

This VSCode extension is part of a family of FracturedJson tools.  Check out the [browser-based formatter](https://j-brooke.github.io/FracturedJson/) to see other options and to play around with the various options.

There are lots of options, but this is an example of what you get:

```
{
    "AttackPlans": [
        {
            "TeamId": 1,
            "Spawns": [
                {"Time": 0.0, "UnitType": "Grunt", "SpawnPointIndex": 0},
                {"Time": 0.0, "UnitType": "Grunt", "SpawnPointIndex": 0},
                {"Time": 0.0, "UnitType": "Grunt", "SpawnPointIndex": 0}
            ]
        }
    ],
    "DefensePlans": [
        {
            "TeamId": 2,
            "Placements": [
                { "UnitType": "Archer", "Position": [41, 7] },
                { "UnitType": "Pikeman", "Position": [40, 7] },
                { "UnitType": "Barricade", "Position": [39, 7] }
            ]
        }
    ]
}
```

## Features

This extension provides 4 commands:

* **Format JSON Document** - The whole document is reformatted according to the settings.
* **Format JSON Selection** - Just the current selection is reformatted in-place.  The selection must be a single JSON element.
* **Minify JSON Document** - Reformats the whole document as small as possible (just like JavaScript's `JSON.stringify`).
* **Near-minify JSON Document** - Formats the document with each child of the root element minified, but on its own line.  (For documents whose roots are arrays with many elements, this provides compact storage but allows a user to easily select a single child of the root.)

You can access these from the Command Palette (shift-command-P or select it from the View menu).  You can set keybindings by clicking on the gear symbol in command palette.

## Extension Settings

You can tune the formatting behavior with the properties in Settings -> Extensions -> FracturedJson.  The most important settings are:

* **Max Inline Length:** Maximum length (not counting indentation) of a complex element on a single line.
* **Max Inline Complexity:** Maximum nesting level that can be displayed on a single line.
* **Max Compact Array Complexity:** Maximum nesting level that can be arranged spanning multiple lines, with multiple items per line.

Examples of all of the settings can be found on the [Options wiki page](https://github.com/j-brooke/FracturedJson/wiki/Options).  You can also experiment with the same functionality on the [browser-based formatter](https://j-brooke.github.io/FracturedJson/) page.

## Release Notes

### 1.0.0

Initial release