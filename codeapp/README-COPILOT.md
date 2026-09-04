# Build and Publish a Code App with GitHub Copilot

This guide is for a new developer who has opened Visual Studio Code, signed in with a GitHub account that includes GitHub Copilot, and wants Copilot to prepare the computer, configure Power Platform, and publish a Code App.

The sections below contain natural-language prompts, not terminal commands. Open GitHub Copilot Chat in **Agent** mode and paste one prompt at a time. Wait for Copilot to finish each stage before continuing.

## Before You Start

You need two separate identities:

- A licensed GitHub account for GitHub Copilot and repository access.
- A Microsoft work or school account with access to the target Power Platform environment.

You also need the following information from your Power Platform administrator:

- Your Power Platform environment ID.
- Confirmation that Power Apps Code Apps are enabled in that environment.
- Environment Maker or equivalent permissions.
- A Power Apps Premium license for users who will run the app.
- Permission to create and use the required connector connections.

Never paste a password, MFA code, access token, client secret, or connection secret into Copilot Chat. Enter sensitive values only in Microsoft or GitHub authentication windows.

## Prompt 1: Check the Computer

> I am new to Power Apps Code Apps. Audit this Windows computer for everything needed to develop a React and TypeScript Code App in Visual Studio Code. Do not install or change anything yet. Check that GitHub Copilot is signed in and Agent mode is available, then check Visual Studio Code, Git, Node.js LTS version 22 or newer, npm, and a supported browser. Report each item as ready, missing, or outdated, include detected versions, and explain which items are required versus optional. Do not require PowerShell 7, .NET, PAC CLI, or the Power Platform Tools extension for the basic Code App workflow.

Review Copilot's report before continuing.

## Prompt 2: Install Missing Essentials

> Install only the missing or outdated essentials identified in the previous audit: Git, Node.js LTS version 22 or newer, npm through Node.js, and the GitHub Copilot extension if it is not already available. Use official publishers and supported Windows installation methods. Before any machine-wide installation or elevation, tell me exactly what will change and ask for my confirmation. After installation, refresh the terminal environment, verify every version, and tell me whether Visual Studio Code must be restarted. Do not install similarly named third-party Power Apps packages.

Restart Visual Studio Code if Copilot recommends it, then reopen this guide.

## Prompt 3: Install All Eight Power Platform Skills Plugins

Microsoft publishes eight Power Platform Skills plugins. The marketplace calls them plugins because each plugin contains multiple Copilot skills and workflows.

> Install the official Microsoft Power Platform Skills marketplace from the microsoft/power-platform-skills GitHub repository using Microsoft's recommended installer. Before any global installation, explain what the installer will add and ask for my confirmation. Install and verify all eight plugins: power-pages, model-apps, mcp-apps, canvas-apps, code-apps-preview, mobile-app, power-apps-mobile-extension, and power-automate. Do not substitute packages with similar names. Allow the official installer to install PAC CLI if it needs it. When finished, report the installed version of each plugin, identify any failed installation, and tell me whether I need to restart Visual Studio Code or start a new Copilot session.

After restarting Copilot, verify the installation:

> Verify that all eight Microsoft Power Platform Skills plugins are available in this Copilot session: power-pages, model-apps, mcp-apps, canvas-apps, code-apps-preview, mobile-app, power-apps-mobile-extension, and power-automate. Do not modify the workspace. Return a simple pass or fail result for each plugin and explain how to repair any missing plugin.

Installing all eight plugins does not mean every optional SDK must be installed immediately. Java, Android tooling, Xcode, Azure CLI, and .NET should be installed only when a selected workflow specifically needs them.

## Prompt 4: Open the Repository

Replace `<repository-url>` with the GitHub URL supplied by your team.

> Clone the GitHub repository at `<repository-url>` into a local folder I choose, then open it as the active Visual Studio Code workspace. Locate the Code App project by finding its package manifest and Power Apps configuration. Do not change source files or deployment identifiers yet. Summarize the project structure, the package manager it uses, and any onboarding instructions in its README files.

If the repository is already cloned and open, use this prompt instead:

> Inspect the current workspace and locate the Power Apps Code App project. Do not edit anything. Read its package manifest, lockfile, Power Apps configuration, and onboarding README. Tell me the project folder, package manager, app display name, required connectors, and whether environment-specific identifiers are blank as expected.

## Prompt 5: Restore the Project Safely

> Prepare the existing Code App for local development. Use the lockfile to restore the exact project dependencies, including the project-local Power Apps CLI. Do not install a global package named pa or power-apps. Verify that Node.js satisfies the project's minimum version and that the local grouped Power Apps CLI is available. Do not publish anything. Report dependency warnings separately from errors, and do not apply forced dependency upgrades without asking me.

## Prompt 6: Check Power Platform Readiness

Replace the placeholders before submitting this prompt.

> I want to use Microsoft account `<power-platform-account>` and Power Platform environment `<environment-id>`. Check whether this account can access that environment and whether Power Apps Code Apps are enabled. Verify that I have sufficient maker permissions and explain any licensing or administrator action still required. Use browser-based Microsoft authentication when needed. Never ask me to provide a password, MFA code, token, or secret in chat. Do not edit the project and do not deploy.

If Copilot cannot verify an administrator setting, send this prompt:

> Give my Power Platform administrator a concise checklist to enable Code Apps in environment `<environment-id>`, grant the required maker access, and confirm Power Apps Premium licensing. Do not make environment changes yourself.

## Prompt 7: Configure This Repository for Your Environment

> Configure this existing Code App for Power Platform environment `<environment-id>`. First read the current Power Apps configuration. Set only the environment ID that I supplied. For a first deployment into this environment, ensure no app ID from another environment is present. Preserve the app display name, build settings, connector declarations, and source code. Validate the configuration as JSON and show me a concise summary of the resulting target without exposing unrelated tenant data. Do not publish yet.

Do not run a new-app initialization workflow for this repository because it already contains a Power Apps configuration file.

## Prompt 8: Sign In to the Correct Microsoft Tenant

> Sign the project-local Power Apps CLI in as `<power-platform-account>`. If another account is cached, explain that it will be signed out and ask before clearing it. Open Microsoft's browser authentication flow with my account preselected. I will enter the password and complete MFA only in the browser. After sign-in, verify the account identity and confirm that environment `<environment-id>` is accessible. Do not deploy.

## Prompt 9: Create and Bind Required Connections

Power Platform 360 requires Power Platform for Admins V2 and Office 365 Users.

> In environment `<environment-id>`, list the available connections using the project-local Power Apps CLI. Verify that connections exist for Power Platform for Admins V2 and Office 365 Users. If either connection is missing, explain that a browser consent flow will open, ask for my confirmation, and create it under `<power-platform-account>`. Then bind both environment-specific connections to this Code App using the official Code Apps data-source workflow. Regenerate connector metadata as needed so no placeholder or foreign-environment endpoint remains. Do not edit generated files manually and do not deploy.

The Microsoft account used by this inventory app also needs the administrative permissions required by the Power Platform for Admins V2 operations.

## Prompt 10: Validate the App Locally

> Validate the Code App without publishing it. Run the repository's lint checks, TypeScript compilation, and production build. Verify that the deployment output contains the entry HTML file and its assets. Treat errors as blockers and repair only issues caused by this setup. Report warnings, including bundle-size warnings, separately. Confirm that the configured environment and both required connector bindings are present, but do not expose full connection identifiers in the summary. Do not deploy.

If the build fails, stop here and ask Copilot to diagnose the exact error before continuing.

## Prompt 11: Review the Deployment

> Prepare a final predeployment review for this Code App. Do not deploy. Confirm the authenticated Microsoft account, target environment, app display name, app version, required connections, successful lint result, successful production build, and whether this is a first deployment or an update. Show the files changed during setup and flag any sensitive identifier that should not be committed. End by asking me for explicit confirmation before the live Power Apps publish operation.

Read the review carefully. Confirm only when the account, environment, and app are correct.

## Prompt 12: Publish the Code App

> I approve publishing the validated Code App to the target environment shown in the predeployment review. Run one fresh production build from the current files. If it succeeds, use the project-local Power Apps CLI to publish the app. Stop immediately if the build or publish operation fails, and do not retry a failed deployment silently. On success, capture the app ID and play URL, verify that the app appears in the target environment, and confirm that the local Power Apps configuration contains the resulting app ID. Do not commit or share environment IDs, app IDs, tenant IDs, or connection IDs.

## Prompt 13: Verify the Published App

> Verify the newly published Code App without changing it. Confirm that it appears in the target environment, that its play URL resolves to the correct Microsoft tenant sign-in flow, and that the local configuration points to the published app. Do not request or handle my credentials. Give me the play URL and a short manual test checklist for loading inventory, refreshing data, switching sections, filtering results, opening an asset, and exporting data.

## Prompt 14: Sanitize Before Sharing the Repository

> Prepare this repository for sharing with other developers. Search tracked source, documentation, configuration, and generated connector metadata for environment IDs, app IDs, tenant IDs, connection IDs, account names, and environment-specific service URLs. Replace deployment targets with blank values or clear placeholders, but preserve connector declarations and application source. Explain any generated metadata that future developers must regenerate by rebinding their own connections. Build the app after sanitizing it, scan tracked files again, and report whether any environment-specific identifier remains. Do not alter or delete the already published Power Apps app.

## Optional: Configure Hosted Dataverse MCP

The Microsoft-hosted Dataverse MCP server is separate from the Code App publishing CLI. It does not require a local .NET SDK or PAC CLI MCP server.

Replace `<dataverse-instance-url>` with the Dataverse instance URL from Power Apps session details, such as an organization URL ending in `crm.dynamics.com`.

> Help me configure the Microsoft-hosted Dataverse MCP server in this Visual Studio Code workspace for `<dataverse-instance-url>`. First verify that GitHub Copilot Agent mode and MCP support are available. Explain the administrator prerequisites: Dataverse MCP enabled for the environment and the Microsoft GitHub Copilot client allowed. Add the hosted Dataverse MCP HTTPS endpoint at the organization's `/api/mcp` path using workspace scope. Use Microsoft browser authentication and never request credentials in chat. Verify that the server starts and its tools are visible. Do not install .NET or configure the separate PAC CLI MCP server.

For Dataverse development that creates or changes solution components:

> Configure the available Dataverse development MCP tooling for `<dataverse-instance-url>`. Ask me to select a local project directory and an unmanaged solution; do not invent either value. Verify connectivity and permissions before making changes. Explain the solution boundary and do not create tables, columns, plug-ins, or other components until I approve a separate implementation plan.

## Optional: Create a Different Code App from Scratch

Use this prompt only when creating a separate project, not when onboarding to this repository.

> Use the installed Microsoft code-apps-preview skill to create a new React, TypeScript, and Vite Power Apps Code App. Ask me for the app's purpose, name, target users, required data, target environment ID, and preferred folder before creating files. Validate Node.js and Git, scaffold from Microsoft's official Code Apps Vite template, restore dependencies, initialize the app for my environment, and complete a baseline build. Use Power Platform connectors rather than direct external HTTP calls. Present an implementation plan and wait for my approval before building features. Require another explicit confirmation before the final live deployment.

## Troubleshooting Prompt

> Diagnose the current Code App setup or publishing failure. Read the exact terminal output and relevant project configuration before changing anything. Check Node.js compatibility, dependency restoration, the project-local Power Apps CLI, authenticated account and tenant, target environment access, Code Apps enablement, connector connections, generated data-source metadata, lint, TypeScript compilation, and deployment artifacts. State one likely root cause and the cheapest check that can disprove it, then make the smallest safe repair. Never deploy as part of troubleshooting unless I separately approve it.

## Completion Checklist

By the end of the workflow, Copilot should have confirmed:

- Visual Studio Code, Git, Node.js 22+, npm, and GitHub Copilot are ready.
- All eight Microsoft Power Platform Skills plugins are installed.
- The repository dependencies and project-local Power Apps CLI are restored.
- The developer is authenticated to the correct Microsoft tenant.
- The target environment has Code Apps enabled and the required permissions.
- Power Platform for Admins V2 and Office 365 Users are connected and bound.
- Lint and the production build pass.
- The developer explicitly approved the deployment.
- The published app appears in the intended environment.
- Sensitive environment-specific identifiers are removed before the repository is shared.
