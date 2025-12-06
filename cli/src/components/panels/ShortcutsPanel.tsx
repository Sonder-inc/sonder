import { useTheme } from '../../hooks/use-theme'

export const ShortcutsPanel = () => {
  const theme = useTheme()

  return (
    <box style={{ flexDirection: 'row', marginLeft: 1, gap: 2 }}>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>/ cmds</text>
        <text style={{ fg: theme.muted }}>@ files</text>
        <text style={{ fg: theme.muted }}># memorize</text>
        <text style={{ fg: theme.muted }}>* context</text>
      </box>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>⇧tab models</text>
        <text style={{ fg: theme.muted }}>⇧m modes</text>
        <text style={{ fg: theme.muted }}>⇧t thinking</text>
        <text style={{ fg: theme.muted }}>⇧↵ newline</text>
      </box>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>esc cancel</text>
        <text style={{ fg: theme.muted }}>^c exit</text>
        <text style={{ fg: theme.muted }}>^v paste</text>
      </box>
    </box>
  )
}
