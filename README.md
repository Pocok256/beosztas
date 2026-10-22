# Monthly Schedule Generator

A Node.js application for generating staff schedules in a web browser.

## Features

- Generates monthly schedules.
- Assigns 24-hour shifts on weekends and 16-hour shifts on weekdays.
- Automatically accounts for Hungarian public holidays, assigning 24-hour shifts on those days as well.
- Supports manual day overrides to treat a specific date as a working day or a day off.
- Assigns up to two people per day.
- When two people are assigned to a day, each receives the full 16 or 24 hours for that day.
- Accepts staff names and unavailable dates.
- The **Shuffle order** button (labeled **Sorrend keverése** in the UI) above the staff list randomly reorders staff with one click. Everyone moves to a different position, keeping their unavailable dates and other data. The next schedule generation uses the new order; existing schedules remain unchanged.
- Aims for consecutive blocks of shifts and an allocation close to the 168-hour target.
- Never allows anyone's monthly total to exceed 168 hours.
- Saves generated schedules as HTML and XLS files and provides download links.
- Lets you review previously generated schedules.
- Aims to distribute primary hours equally, while allowing some variation in secondary hours.

## Getting Started

```bash
npm install
npm start
```

Then open `http://localhost:3000` in your browser.

## Project Structure

The application's TypeScript source code is in the `src` directory.

- `src/features/scheduler`: scheduling logic, configuration, and exports.
- `src/features/server`: Express application and file-based history and export storage.
- `src/features/schedule-ui`: browser UI modules.
- `src/shared/types`: shared types.

Running `npm start` automatically builds the TypeScript code before starting the application. The compiled output is placed in the `dist` directory.

## Environment Variables

At startup, the application automatically loads the `.env` file from the project root using the `dotenv` package.
Use `.env.example` as a starting point.

```bash
cp .env.example .env
```

Supported settings:

- `HOST`: the server's listening address.
- `PORT`: the server port.
- `PUBLIC_DIR`: the directory containing static frontend files. Defaults to `./dist/public` after the TypeScript build.
- `EXPORT_DIR`: the directory for exported HTML and XLS files.
- `DATA_DIR`: the directory containing the history file.
- `SCHEDULER_*`: scoring weights and tolerances for tuning the scheduler. See `.env.example` for the full list.

## Scheduler Tuning

The schedule generator includes a configuration menu where you can adjust the same scoring weights and tolerances available through `.env`.

- The UI loads the server's current default values, resolved from `.env`.
- Use the **Restore environment defaults** button (labeled `Env alapok visszaallitasa` in the UI) to restore these values at any time.
- Each field includes a description of what its weight or tolerance affects.
- The frontend retrieves these documented settings through the `/api/config` endpoint, so the backend and UI share a single source of truth.

## Manual Day Overrides

Below the month selector, you can add day overrides that change the automatic weekend and public holiday rules.

- **Working day** (`Munkanap` in the UI): treats the date as a 16-hour working day.
- **Day off** (`Szunnap` in the UI): treats the date as a 24-hour non-working day.

This is useful for accounting for shifted working days or rest days.

## Testing

```bash
npm test
```

## Docker

You can also run the application in Docker, with the contents of the `data` and `exports` directories persisted on the host machine.

### Starting with Docker Compose

```bash
docker compose up --build -d
```

The application is then available at `http://localhost:3000` by default.

### Stopping

```bash
docker compose down
```

### Updating After Code Changes

```bash
docker compose up --build -d
```

### Changing the Port

To use a port other than 3000, set the `APP_PORT` environment variable when starting the application:

```bash
APP_PORT=8080 docker compose up --build -d
```

### Persistent Data

- Schedule generation history is stored in `data/history.json`.
- Exported HTML and XLS files are stored in the `exports` directory.
- `docker-compose.yml` bind-mounts these directories from the host machine, so their contents survive container restarts.

### Deploying to a Server

Copy the entire project to the server, then run the following command from the project root:

```bash
docker compose up --build -d
```

If port 3000 is open on the server, the application will be available at `http://server-ip:3000`.
