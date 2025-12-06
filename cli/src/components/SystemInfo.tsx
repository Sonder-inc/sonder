import { useState, useEffect } from 'react'
import { hostname, userInfo } from 'os'

export const SystemInfo = () => {
  const [publicIp, setPublicIp] = useState<string>('...')

  useEffect(() => {
    fetch('https://api.ipify.org?format=text')
      .then((res) => res.text())
      .then((ip) => setPublicIp(ip.trim()))
      .catch(() => setPublicIp('unknown'))
  }, [])

  const host = hostname().slice(0, 8)
  const user = userInfo().username.slice(0, 4)
  const tz = new Date().toLocaleTimeString('en-US', { timeZoneName: 'short' }).split(' ').pop()
  const plat = process.platform.slice(0, 3)

  const faintRed = '#7f1d1d'
  const info = `${publicIp} · ${user}@${host} · ${plat} · ${tz}`

  return (
    <box style={{ paddingLeft: 1 }}>
      <text style={{ fg: faintRed }}>{info}</text>
    </box>
  )
}
