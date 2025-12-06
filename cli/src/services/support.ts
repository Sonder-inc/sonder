import { execSync } from 'child_process'
import { collectFingerprint, formatFingerprint } from './fingerprint'

const GITHUB_REPO = 'sonder-cli/sonder' // Update to your actual repo

export interface SupportTicket {
  title: string
  description: string
  sonderVersion: string
}

export interface SupportResult {
  success: boolean
  issueUrl?: string
  error?: string
}

function checkGhInstalled(): boolean {
  try {
    execSync('gh --version', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function checkGhAuth(): boolean {
  try {
    execSync('gh auth status', { encoding: 'utf-8', stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

export async function createSupportTicket(ticket: SupportTicket): Promise<SupportResult> {
  // Check if gh CLI is installed
  if (!checkGhInstalled()) {
    return {
      success: false,
      error: 'GitHub CLI (gh) is not installed. Install it with: brew install gh',
    }
  }

  // Check if user is authenticated
  if (!checkGhAuth()) {
    return {
      success: false,
      error: 'Not logged in to GitHub CLI. Run: gh auth login',
    }
  }

  try {
    // Collect system fingerprint
    const fingerprint = collectFingerprint(ticket.sonderVersion)
    const fingerprintMarkdown = formatFingerprint(fingerprint)

    // Build issue body
    const issueBody = `## Description

${ticket.description}

---

${fingerprintMarkdown}

---

*This issue was automatically created via \`/support\` command in Sonder CLI.*
`

    // Create issue title with timestamp for uniqueness
    const timestamp = new Date().toISOString().split('T')[0]
    const issueTitle = `[Support] ${ticket.title.slice(0, 80)} (${timestamp})`

    // Create the issue using gh CLI
    const result = execSync(
      `gh issue create --repo "${GITHUB_REPO}" --title "${issueTitle.replace(/"/g, '\\"')}" --body "${issueBody.replace(/"/g, '\\"').replace(/\n/g, '\\n')}" --label "support,user-reported"`,
      { encoding: 'utf-8', timeout: 30000 }
    )

    // Extract issue URL from output
    const urlMatch = result.match(/https:\/\/github\.com\/[^\s]+/)
    const issueUrl = urlMatch ? urlMatch[0] : undefined

    return {
      success: true,
      issueUrl,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to create issue: ${errorMsg}`,
    }
  }
}

// Alternative: create issue via GitHub API directly (doesn't require gh CLI)
export async function createSupportTicketApi(ticket: SupportTicket, githubToken: string): Promise<SupportResult> {
  try {
    const fingerprint = collectFingerprint(ticket.sonderVersion)
    const fingerprintMarkdown = formatFingerprint(fingerprint)

    const issueBody = `## Description

${ticket.description}

---

${fingerprintMarkdown}

---

*This issue was automatically created via \`/support\` command in Sonder CLI.*
`

    const timestamp = new Date().toISOString().split('T')[0]
    const issueTitle = `[Support] ${ticket.title.slice(0, 80)} (${timestamp})`

    const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${githubToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: ['support', 'user-reported'],
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      return {
        success: false,
        error: `GitHub API error: ${response.status} - ${error}`,
      }
    }

    const data = (await response.json()) as { html_url: string }
    return {
      success: true,
      issueUrl: data.html_url,
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      error: `Failed to create issue: ${errorMsg}`,
    }
  }
}
