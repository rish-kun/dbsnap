# CLI Refactor Plan

## Goal
Convert the `dbsnap` project into a fully functional CLI tool that allows users to:
1.  Interactively set up configuration (Appwrite credentials, Bucket ID, SendGrid, Docker container).
2.  Select a specific Docker container for backups.
3.  Set up Cron jobs automatically.
4.  Run backups manually or via cron using the saved configuration.

## Proposed Changes

### 1. New File: `dbsnap/config.ts`
- **Purpose**: helper to read and write `.env` files safely.
- **Functionality**:
    - `loadConfig()`: Reads `.env` from the script's directory.
    - `saveConfig(newConfig)`: Merges and saves key-value pairs to `.env`.

### 2. New File: `dbsnap/setup.ts`
- **Purpose**: The interactive configuration wizard.
- **Flow**:
    - Prompt for **Appwrite Configuration** (Endpoint, Project ID, API Key, **Bucket ID**).
    - Prompt for **Email Configuration** (SendGrid Key, From/To Emails).
    - **Docker Selection**: List running containers using `docker ps`, allow user to select one.
    - **System Config**: Ask if sudo is needed and optional password storage.
    - **Cron Setup**: Ask to create a cron job, offer intervals (Minute, Hour, Day, Custom), and update `crontab`.

### 3. Modify: `dbsnap/index.ts`
- **Purpose**: Main entry point.
- **Logic**:
    - Load configuration using `config.ts`.
    - Check CLI arguments (`--run`, `--setup`).
    - If `--setup` or missing config: Run `setup.ts`.
    - If `--run`: Execute the backup routine.
    - If no args: Show an interactive menu (Run, Setup, Exit).

### 4. Modify: `dbsnap/backup.ts`
- **Change**: Remove hardcoded `.env` loading.
- **Change**: Accept `containerName` as a function argument instead of hardcoded value.
- **Change**: Use `sudo` logic based on configuration/arguments.

### 5. Modify: `dbsnap/upload.ts`
- **Change**: Remove hardcoded `.env` loading.
- **Change**: Ensure it uses the `process.env` values populated by `index.ts`.

### 6. Modify: `dbsnap/email.ts`
- **Change**: Add checks for missing API keys to prevent crashes.
- **Change**: Use configured From/To emails.

## Execution Steps
1.  Create `dbsnap/config.ts`.
2.  Create `dbsnap/setup.ts`.
3.  Refactor `dbsnap/backup.ts`, `dbsnap/upload.ts`, `dbsnap/email.ts`.
4.  Refactor `dbsnap/index.ts`.
5.  Verify by running `bun dbsnap/index.ts`.
