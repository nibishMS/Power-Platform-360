# Power Platform 360

Power Platform 360 is a React and TypeScript Power Apps Code App for exploring tenant-wide inventory across apps, flows, agents, environments, connectors, makers, and governance signals.

## Project Configuration

| Setting        | Value                                                             |
| -------------- | ----------------------------------------------------------------- |
| App version    | `1.0.1`                                                           |
| Environment ID | Intentionally blank; set it in `power.config.json`                |
| App ID         | Created by the first successful `pa app push`                     |
| App URL        | `https://apps.powerapps.com/play/e/<environment-id>/app/<app-id>` |

Do not copy environment IDs, app IDs, tenant IDs, or connection IDs between environments. Each developer must initialize the app with their own environment ID and create or select connections in that environment.

## Developer Prerequisites

A GitHub account and a Power Platform account serve different purposes:

- GitHub provides repository access.
- A GitHub Copilot entitlement provides AI agent and MCP support in VS Code.
- A Microsoft work or school account provides access to Power Platform environments and connectors.

### Required Workstation Software

| Component          | Requirement               | Purpose                                        |
| ------------------ | ------------------------- | ---------------------------------------------- |
| Visual Studio Code | Current stable release    | Editor and optional Copilot MCP client         |
| Git                | Current supported release | Clone and manage the repository                |
| Node.js            | LTS v22 or newer          | Run npm, Vite, and the Power Apps CLI          |
| npm                | Installed with Node.js    | Restore dependencies and run scripts           |
| Browser            | Current supported browser | Microsoft authentication and connector consent |

Windows installation example:

```powershell
winget install --id Microsoft.VisualStudioCode --exact
winget install --id Git.Git --exact
winget install --id OpenJS.NodeJS.LTS --exact
```

Restart VS Code after installing Node.js so new terminals receive the updated `PATH`.

### Required Power Platform Access

The developer needs:

- A Power Platform environment with **Power Apps code apps** enabled.
- Environment Maker or equivalent permissions.
- A Power Apps Premium license for running code apps.
- The environment ID from the Power Apps maker portal URL.
- Permission to create or use every connector required by the app.

An administrator enables Code Apps in **Power Platform admin center > Environments > Settings > Product > Features > Power Apps code apps**.

## Optional Developer Tooling

| Component                        | When it is useful                                    | Required for this app?            |
| -------------------------------- | ---------------------------------------------------- | --------------------------------- |
| GitHub Copilot extension         | AI-assisted development and Dataverse MCP in VS Code | Only for Copilot or MCP workflows |
| Power Platform Skills            | Guided Code App, connector, and deployment workflows | No                                |
| Power Platform Tools for VS Code | PAC CLI and broader Power Platform development       | No                                |
| PowerShell 7                     | Convenient Windows terminal                          | No                                |
| .NET SDK                         | PAC CLI MCP, PCF, plug-in, or other .NET workflows   | No                                |
| PAC CLI                          | Solution, PCF, and environment administration        | No                                |

The Code App build uses the project-local `pa` CLI. Do not install an unrelated global `pa` package.

### Power Platform Skills

Power Platform Skills are optional. Install them to use the same Copilot-guided Code App workflow used for this project.

```powershell
Invoke-WebRequest `
  https://raw.githubusercontent.com/microsoft/power-platform-skills/main/scripts/install.js `
  -OutFile install.js
node .\install.js
Remove-Item .\install.js
```

The installer registers the Microsoft Power Platform Skills marketplace, installs its plugins, and installs PAC CLI when needed. Restart the Copilot session after installation.

## Start With This Repository

Clone the repository, enter the Code App folder, and restore the exact dependency versions from the lockfile:

```powershell
git clone <repository-url>
cd PowerPlatform360\codeapp
npm ci
```

Before running a Power Apps CLI command, open `power.config.json` and set `environmentId` to the target environment GUID. Leave `appId` absent for a first deployment. To update an existing app, add that environment's app ID instead.

This repository already contains `power.config.json`, so do not run `pa app init` when onboarding to this project.

The npm restore installs the project toolchain, including:

- React and React DOM
- TypeScript and Vite
- Fluent UI and Recharts
- `@microsoft/power-apps`
- `@microsoft/power-apps-vite`
- `@microsoft/power-apps-cli`

Verify the project:

```powershell
node --version
npx --no-install pa --version
npm run lint
npm run build
```

Run locally with Power Apps integration:

```powershell
npx --no-install pa app run
```

## Power Platform Authentication

Sign in with the Microsoft account that has access to the target environment:

```powershell
npx --no-install pa auth login --account <power-platform-account>
npx --no-install pa auth status
```

If the CLI uses the wrong tenant or cached account:

```powershell
npx --no-install pa auth logout
npx --no-install pa auth login --account <power-platform-account>
```

Never place passwords, MFA codes, tokens, or connection secrets in source files or chat prompts. Complete those steps only in Microsoft's authentication window.

## Required Connections

This app uses:

- Power Platform for Admins V2: `shared_powerplatformadminv2`
- Office 365 Users: `shared_office365users`

List the connections available in the environment:

```powershell
npx --no-install pa connection list
```

Create missing connections:

```powershell
npx --no-install pa connection create `
  --connector shared_powerplatformadminv2 `
  --display-name "Power Platform for Admins V2"

npx --no-install pa connection create `
  --connector shared_office365users `
  --display-name "Office 365 Users"
```

Bind each environment-specific connection to the app:

```powershell
npx --no-install pa app add data-source `
  --connector shared_powerplatformadminv2 `
  --connection-id <admin-v2-connection-id>

npx --no-install pa app add data-source `
  --connector shared_office365users `
  --connection-id <office-365-users-connection-id>
```

The account reading tenant-wide inventory needs the corresponding Power Platform administrative permissions.

## Publish This App

Before publishing, verify `power.config.json`:

- For a first deployment, set `environmentId` and leave `appId` absent.
- To update an existing deployment, set both its `environmentId` and `appId`.

These values determine which environment and live app receive the package.

```powershell
npm run lint
npm run build
npx --no-install pa app push
```

Always run a successful production build before `pa app push`.

## Create A New Code App

To create a separate Code App from the Microsoft Vite template:

```powershell
npx degit github:microsoft/PowerAppsCodeApps/templates/vite my-code-app
cd my-code-app
npm install

npx --no-install pa app init `
  --display-name "My Code App" `
  --environment-id <environment-id>

npx --no-install pa app run
```

Add the required data sources, implement the app, and then publish:

```powershell
npm run build
npx --no-install pa app push
```

The first successful push creates the Power Apps record and writes its `appId` to `power.config.json`. Later pushes update that app.

## Dataverse MCP In VS Code

The recommended Microsoft-hosted Dataverse MCP server does not require a local server package, PAC CLI, PowerShell 7, or the .NET SDK.

### Administrator Setup

A Power Platform administrator must:

1. Open **Power Platform admin center > Manage > Environments**.
2. Select the environment and open **Settings > Product > Features**.
3. Enable **Allow MCP clients to interact with Dataverse MCP server**.
4. Open the advanced Dataverse MCP settings.
5. Enable the **Microsoft GitHub Copilot** client.

A Managed Environment is required only when MCP access is governed through Advanced Connector Policies.

### Developer Setup

The developer needs:

- VS Code with the GitHub Copilot extension.
- An active GitHub Copilot entitlement.
- The Dataverse instance URL, not only the Power Platform environment ID.
- A Microsoft account with the required Dataverse security roles.

Find the instance URL in **make.powerapps.com > Settings > Session details > Instance URL**.

In VS Code:

1. Open the Command Palette with `Ctrl+Shift+P`.
2. Run **MCP: Add Server**.
3. Select **HTTP or Server Sent Events**.
4. Enter the Dataverse MCP endpoint:

   ```text
   https://<organization>.crm.dynamics.com/api/mcp
   ```

5. Choose workspace or global scope.
6. Open Copilot Chat in Agent mode and authenticate with the Microsoft account.

For Dataverse solution development, also select a local project directory. Use an unmanaged solution when the MCP agent needs to create or modify tables, columns, forms, plug-ins, or other solution components.

This repository does not currently contain a workspace-level MCP configuration, so each developer must configure their own Dataverse endpoint.

## Optional PAC CLI MCP Server

The PAC CLI MCP server is a separate local option. Use it when you specifically want natural-language access to PAC CLI commands rather than the hosted Dataverse MCP service.

It requires:

- .NET 10 or newer
- PAC CLI, or the `dnx` package runner
- An MCP-compatible client

Example VS Code MCP configuration:

```json
{
  "servers": {
    "pac-mcp": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "Microsoft.PowerApps.CLI.Tool",
        "--yes",
        "copilot",
        "mcp",
        "--run"
      ]
    }
  }
}
```

Do not install .NET solely for this Code App. It is needed only if this local PAC MCP option or another .NET-based development workflow is required.

## References

- [Power Apps Code Apps overview](https://learn.microsoft.com/power-apps/developer/code-apps/overview)
- [Create a Code App using the Power Apps CLI](https://learn.microsoft.com/power-apps/developer/code-apps/how-to/create-an-app-from-scratch)
- [Power Platform Skills](https://github.com/microsoft/power-platform-skills)
- [Connect Dataverse MCP to GitHub Copilot](https://learn.microsoft.com/power-apps/maker/data-platform/data-platform-mcp-vscode)
- [Configure Dataverse MCP for an environment](https://learn.microsoft.com/power-apps/maker/data-platform/data-platform-mcp-disable)
- [Use the PAC CLI MCP server](https://learn.microsoft.com/power-platform/developer/howto/use-mcp)
