This provides syntax highlighting for Ripple files in editors that support TextMate grammars, such as WebStorm/IntelliJ and Sublime Text.

# Installation

1. Create a directory named `Ripple.tmbundle`.
2. Create a directory named `Syntaxes` inside the `Ripple.tmbundle` directory.
3. Save the [`ripple.tmLanguage`](./Syntaxes/ripple.tmLanguage) file into the `Syntaxes` directory.
4. Install it:
	* **WebStorm/IntelliJ**:
		1. Save the [`info.plist`](./info.plist) file into the `Ripple.tmbundle` directory.
		2. Go to `Settings` > `Editor` > `TextMate Bundles`, click the `+` icon, and select the `Ripple.tmbundle` directory.
		3. All `.ripple` files should now have syntax highlighting.
	* **Sublime Text**:
		1. Go to `Preferences` > `Browse Packages`, and move the `Ripple.tmbundle` directory into the opened folder.
		2. You should now be able to select `Ripple` in `View` > `Syntax`.
