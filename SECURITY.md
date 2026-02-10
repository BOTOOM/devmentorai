# Security Policy

## Supported Versions

| Version | Supported          |
|---------|--------------------|
| latest  | :white_check_mark: |
| < 0.1.0 | :x:               |

Only the latest release is actively supported with security updates.

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in DevMentorAI, please report it responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Instead, create a **GitHub Security Advisory** at:
   [https://github.com/BOTOOM/devmentorai/security/advisories/new](https://github.com/BOTOOM/devmentorai/security/advisories/new)

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

### What to Expect

- **Acknowledgment** within 48 hours
- **Initial assessment** within 5 business days
- **Resolution timeline** communicated after assessment
- **Credit** in the release notes (unless you prefer to remain anonymous)

## Scope

### In Scope

- Authentication or authorization bypasses
- Data exposure or leakage
- Cross-site scripting (XSS) in the extension
- Injection vulnerabilities in the backend
- Insecure data storage
- Vulnerabilities in dependencies

### Out of Scope

- Issues in third-party services (GitHub Copilot, Chrome Web Store)
- Social engineering attacks
- Denial of service attacks
- Issues requiring physical access to a device

## Security Best Practices for Contributors

- Never commit secrets, API keys, or credentials
- Keep dependencies up to date
- Follow the principle of least privilege
- Validate and sanitize all user inputs
