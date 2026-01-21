# Gas Lifting Logbook

This project is a Google Apps Script (GAS) application for managing and automating a strength training logbook in Google Sheets. It supports advanced features for tracking cycles, updating training maxes, and automating sheet management for RPT ~~and 5/3/1~~ workout programs.

## Features

- Automated menu and triggers for Google Sheets
- Modular repositories for all sheet data (workouts, training maxes, lift records, program specs, dashboard)
- Core services for business logic (mapping, parsing, row hiding, conditional formatting, etc.)
- Conditional formatting for highlighting today's workout
- Automatic hiding of rows after working set completion
- Robust error handling and user feedback
- Comprehensive unit tests

## Project Structure

```
src/
  api/
    controllers/         # Google Sheets triggers and menu logic
    repositories/        # Data access for each sheet
    ui/                  # UI utilities (alerts, error handling)
    utils/               # Shared utilities (e.g., cropSheet)
  core/
    services/
      workout/           # Core workout logic (row hiding, header finding, etc.)
    ...                  # Core mapping/parsing logic
tests/
  api/
    controllers/
    repositories/
    ui/
  core/
    services/
      workout/
```

## Development

### Prerequisites

- [Node.js](https://nodejs.org/)
- [clasp](https://github.com/google/clasp) (Google Apps Script CLI)
- [npm](https://www.npmjs.com/)
- [TypeScript](https://www.typescriptlang.org/)

### Setup

1. Clone the repository:

   ```sh
   git clone https://github.com/brownm09/gas-lifting-logbook.git
   cd gas-lifting-logbook
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Log in to clasp and set up your Apps Script project:

   ```sh
   clasp login
   clasp create --type sheets --title "Gas Lifting Logbook"
   ```

4. Push code to Apps Script:
   ```sh
   npm run build
   clasp push
   ```

### Testing

Run all tests with:

```sh
npm test
```

Tests are written with Jest and cover both API and core logic.

### Deployment

After pushing code with `clasp push`, open the associated Google Sheet and reload to activate new triggers and menu items.

## Usage

- Open your Google Sheet.
- The custom menu will appear on open.
- Use the menu to start new cycles, format sheets, and more.
- Edits to the workout sheet will automatically hide completed working sets and warm-ups.

## TODOs

1. Add a menu option for performing annual cutover.
1. Add a menu option for pinning and sorting sheets.
1. Add a menu option for reprinting a worksheet (perhaps automatically when updating training maxes or a program spec).

## Contributing

Pull requests are welcome! Please ensure all tests pass and follow the existing code style.

## License

MIT
l requests are welcome! Please ensure all tests pass and follow the existing code style.

## License

MIT
