---
title: Quick Start
---

# Quick Start

## Try Ripple Online
You can try Ripple directly in your browser on [StackBlitz](https://stackblitz.com/github/trueadm/ripple/tree/main/templates/basic).

## Installation

### Using The <Badge type="warning" text="Experimental" /> `create-ripple` CLI

```sh
npm create ripple // [!=npm auto]
```

### Clone the Vite-based Basic Template:
```sh
npx degit trueadm/ripple/templates/basic ripple-app // [!=npm auto]

cd ripple-app
npm i // [!=npm auto]
npm run dev // [!=npm auto]
```

## Editor Integration

### VSCode Extension
Ripple maintains a Volar-based [VSCode extension](https://marketplace.visualstudio.com/items?itemName=ripplejs.ripple-vscode-plugin).

It provides syntax highlighting for `.ripple` files, real-time diagnostics for
compilation errors, typescript integration for type checking and autocompletion.

If you're using a fork of VSCode, the extension is also available on [OpenVSX](https://open-vsx.org/extension/ripplejs/ripple-vscode-plugin).

::: info Are you a Zed, NeoVim, or IntelliJ/WebStorm user?
Help us port the Ripple extension to your platforms!
:::

### TextMate bundle
Ripple also maintains a TextMate bundle that provides syntax highlighting for
Ripple files in editors that support TextMate grammars, such as WebStorm/IntelliJ
and Sublime Text.

1. Create a directory named `Ripple.tmbundle`.
2. Create a directory named `Syntaxes` inside the `Ripple.tmbundle` directory.
3. Save the
		[`ripple.tmLanguage`](https://github.com/trueadm/ripple/blob/main/assets/Ripple.tmbundle/Syntaxes/ripple.tmLanguage)
		file into the `Syntaxes` directory.
4. Install it:
	* **WebStorm/IntelliJ**:
		1. Save the
				[`info.plist`](https://github.com/trueadm/ripple/blob/main/assets/Ripple.tmbundle/info.plist)
				file into the `Ripple.tmbundle` directory.
		2. Go to `Settings` > `Editor` > `TextMate Bundles`, click the `+` icon, and select the `Ripple.tmbundle` directory.
		3. All `.ripple` files should now have syntax highlighting.
	* **Sublime Text**:
		1. Go to `Preferences` > `Browse Packages`, and move the `Ripple.tmbundle` directory into the opened folder.
		2. You should now be able to select `Ripple` in `View` > `Syntax`.

## Getting Help

Try joining the [Discord server](https://discord.gg/JBF2ySrh2W), or asking for
help on our [discussions board](https://github.com/trueadm/ripple/discussions).

## Next Steps

- Learn about reactivity/state management and caveats.
