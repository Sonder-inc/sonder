import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useHackingStore } from '../../state/hacking-store'
import type { CredentialType } from '../../state/hacking-store'

interface CredentialsSectionProps {
  isActive: boolean
  width: number
}

export const CredentialsSection = ({ isActive, width }: CredentialsSectionProps) => {
  const theme = useTheme()
  const { credentials, getCredentialsByType } = useHackingStore()

  const contentWidth = width - 4 // Account for borders and padding

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  // Group credentials by type
  const groupedCreds: Array<{ type: CredentialType; label: string; creds: typeof credentials }> = [
    { type: 'username', label: 'Users', creds: getCredentialsByType('username') },
    { type: 'password', label: 'Passwords', creds: getCredentialsByType('password') },
    { type: 'hash', label: 'Hashes', creds: getCredentialsByType('hash') },
    { type: 'api_key', label: 'API Keys', creds: getCredentialsByType('api_key') },
    { type: 'token', label: 'Tokens', creds: getCredentialsByType('token') },
    { type: 'ssh_key', label: 'SSH Keys', creds: getCredentialsByType('ssh_key') },
    { type: 'certificate', label: 'Certs', creds: getCredentialsByType('certificate') },
  ]

  // Filter out empty groups
  const nonEmptyGroups = groupedCreds.filter((g) => g.creds.length > 0)

  const formatCredential = (cred: typeof credentials[0]): string => {
    switch (cred.type) {
      case 'username':
        return cred.value
      case 'password':
        if (cred.user) {
          return `${cred.user}:${cred.value}`
        }
        return cred.value
      case 'hash':
        if (cred.user) {
          const status = cred.cracked ? '✓' : '✗'
          return `${cred.user}:[HASH] ${status}`
        }
        const status = cred.cracked ? '✓' : '✗'
        return `[HASH] ${status}`
      case 'api_key':
      case 'token':
        // Truncate long keys/tokens
        if (cred.value.length > 20) {
          return `${cred.value.slice(0, 15)}...`
        }
        return cred.value
      case 'ssh_key':
        return cred.user ? `${cred.user}@[SSH_KEY]` : '[SSH_KEY]'
      case 'certificate':
        return '[CERT]'
      default:
        return cred.value
    }
  }

  return (
    <SidebarSection
      number={3}
      title="Credentials"
      isActive={isActive}
      width={width}
      flexGrow={1}
    >
      {credentials.length === 0 ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>No credentials found</text>
        </SidebarRow>
      ) : (
        <>
          {nonEmptyGroups.map((group, groupIndex) => (
            <box key={group.type} style={{ flexDirection: 'column' }}>
              {/* Group header */}
              <SidebarRow width={width} isActive={isActive}>
                <text fg={theme.muted}>
                  {group.label} ({group.creds.length})
                </text>
              </SidebarRow>

              {/* Show first 2 credentials per group */}
              {group.creds.slice(0, 2).map((cred) => (
                <SidebarRow key={cred.id} width={width} isActive={isActive}>
                  <text fg={theme.muted}>•</text>
                  <text
                    fg={
                      cred.type === 'hash' && cred.cracked
                        ? theme.success
                        : cred.type === 'hash' && !cred.cracked
                          ? theme.warning
                          : theme.foreground
                    }
                  >
                    {truncate(formatCredential(cred), contentWidth - 2)}
                  </text>
                </SidebarRow>
              ))}

              {/* Show "..." if more than 2 */}
              {group.creds.length > 2 && (
                <SidebarRow width={width} isActive={isActive}>
                  <text fg={theme.muted}>  +{group.creds.length - 2} more</text>
                </SidebarRow>
              )}

              {/* Add spacing between groups except last */}
              {groupIndex < nonEmptyGroups.length - 1 && (
                <SidebarRow width={width} isActive={isActive}>
                  <text>{' '}</text>
                </SidebarRow>
              )}
            </box>
          ))}
        </>
      )}
    </SidebarSection>
  )
}
