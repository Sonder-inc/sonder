import { useTheme } from '../../hooks/use-theme'
import { SidebarSection, SidebarRow } from './SidebarSection'
import { useHackingStore } from '../../state/hacking-store'
import type { ReconType } from '../../state/hacking-store'

interface ReconSectionProps {
  isActive: boolean
  width: number
}

export const ReconSection = ({ isActive, width }: ReconSectionProps) => {
  const theme = useTheme()
  const { findings, getFindingsByType } = useHackingStore()

  const contentWidth = width - 4 // Account for borders and padding

  const truncate = (text: string, maxLen: number) => {
    if (text.length <= maxLen) return text
    return text.slice(0, maxLen - 1) + '…'
  }

  // Group findings by type
  const groupedFindings: Array<{ type: ReconType; label: string; findings: typeof findings }> = [
    { type: 'port', label: 'Ports', findings: getFindingsByType('port') },
    { type: 'service', label: 'Services', findings: getFindingsByType('service') },
    { type: 'os', label: 'OS', findings: getFindingsByType('os') },
    { type: 'tech', label: 'Tech', findings: getFindingsByType('tech') },
    { type: 'subdomain', label: 'Subdomains', findings: getFindingsByType('subdomain') },
    { type: 'directory', label: 'Directories', findings: getFindingsByType('directory') },
    { type: 'vulnerability', label: 'Vulns', findings: getFindingsByType('vulnerability') },
  ]

  // Filter out empty groups
  const nonEmptyGroups = groupedFindings.filter((g) => g.findings.length > 0)

  return (
    <SidebarSection
      number={2}
      title="Recon"
      isActive={isActive}
      width={width}
      flexGrow={1}
    >
      {findings.length === 0 ? (
        <SidebarRow width={width} isActive={isActive}>
          <text fg={theme.muted}>No findings yet</text>
        </SidebarRow>
      ) : (
        <>
          {nonEmptyGroups.map((group, groupIndex) => (
            <box key={group.type} style={{ flexDirection: 'column' }}>
              {/* Group header */}
              <SidebarRow width={width} isActive={isActive}>
                <text fg={theme.muted}>
                  {group.label} ({group.findings.length})
                </text>
              </SidebarRow>

              {/* Show first 2 findings per group */}
              {group.findings.slice(0, 2).map((finding) => (
                <SidebarRow key={finding.id} width={width} isActive={isActive}>
                  <text fg={theme.muted}>•</text>
                  <text fg={theme.foreground}>
                    {truncate(
                      finding.details ? `${finding.value} ${finding.details}` : finding.value,
                      contentWidth - 2
                    )}
                  </text>
                </SidebarRow>
              ))}

              {/* Show "..." if more than 2 */}
              {group.findings.length > 2 && (
                <SidebarRow width={width} isActive={isActive}>
                  <text fg={theme.muted}>  +{group.findings.length - 2} more</text>
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
