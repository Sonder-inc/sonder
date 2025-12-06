import { useTheme } from '../../hooks/use-theme'

export const ShortcutsPanel = () => {
  const theme = useTheme()

  return (
    <box style={{ flexDirection: 'row', marginLeft: 1, gap: 2 }}>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>/ for commands</text>
        <text style={{ fg: theme.muted }}>@ for file paths</text>
        <text style={{ fg: theme.muted }}># to memorize</text>
        <text style={{ fg: theme.muted }}>* threads</text>
      </box>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>⇧tab switch models</text>
        <text style={{ fg: theme.muted }}>⇧m switch modes</text>
        <text style={{ fg: theme.muted }}>esc to cancel</text>
      </box>
      <box style={{ flexDirection: 'column' }}>
        <text style={{ fg: theme.muted }}>ctrl+c exit</text>
        <text style={{ fg: theme.muted }}>⇧↵ for newline</text>
        <text style={{ fg: theme.muted }}>ctrl+v paste</text>
      </box>
    </box>
  )
}
