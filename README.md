
# Gas Lifting Logbook

This project is a Google Apps Script (GAS) application for managing and automating a strength training logbook in Google Sheets. It supports advanced features for tracking cycles, updating training maxes, and automating sheet management for RPT and 5/3/1 workout programs.

## Features

- Automated handling of completed workout sheets (RPT and 5/3/1)
- Dynamic updating of training maxes and workout cycles
- Sheet formatting, cropping, and data validation
- Named ranges and view management
- Error handling and logging

## Project Structure

- GAS source files: `.gs` files (legacy, root)
- TypeScript source files: `src/*.ts` (modern, for clasp workflow)
- Configuration: `appsscript.json`, `jsconfig.json`, `.vscode/settings.json`
- Node.js tooling: `package.json`, `tsconfig.json`, etc.

## TypeScript & CLASP Workflow

This repo uses [clasp](https://github.com/google/clasp) and TypeScript for modern Apps Script development:

1. **Write code in TypeScript** in the `src/` directory.
2. **Transpile to JavaScript** (if needed) for Apps Script compatibility.
3. **Push to Google Apps Script** using clasp:

- `npm run push` — Pushes local code to your Apps Script project
- `npm run pull` — Pulls remote code to local
- `npm run watch` — Watches for changes and pushes automatically

1. **Type definitions** for Apps Script are provided by `@types/google-apps-script` for full IntelliSense and type checking.

## Key Scripts

- `processCompletedSheetRpt(currSheet)` — Handles completion of an RPT workout sheet, updates history, training maxes, and prepares the next cycle.
- `processCompletedSheet531(currSheet, currSpreadsheet)` — Handles completion of a 5/3/1 workout sheet, clears dates, updates names, and manages view.
- `onEditHandler(e)` — Main trigger for responding to sheet edits, routing logic based on sheet type and change type.

## Getting Started

1. **Install dependencies:**

 ```sh
 npm install
 ```

1. **Login to clasp:**

 ```sh
 npx clasp login
 npx clasp create --type sheets --title "Gas Lifting Logbook"
 ```

1. **Push code to Apps Script:**

 ```sh
 npm run push
 ```

1. **Set up triggers:**

- Run `createEditTrigger()` in the Apps Script UI to enable edit triggers.

## Development Notes

- All `.gs` files are treated as JavaScript in VS Code for syntax highlighting and navigation.
- TypeScript files in `src/` are the source of truth for new development.
- Use `clasp` to sync code between local and Apps Script.
- See `package.json` for available scripts.

## License

ISC