import { useEffect, useState } from 'react'

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: true,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
  year: 'numeric',
})

function MarketClock({ label = 'Live Market Time' }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date())
    }, 1000)

    return () => window.clearInterval(timer)
  }, [])

  return (
    <div className="clock-area text-center mb-4 mb-lg-5">
      <p className="eyebrow mb-2">{label}</p>
      <h1 className="clock-display mb-2">{timeFormatter.format(now)}</h1>
      <p className="clock-date mb-0">{dateFormatter.format(now)}</p>
    </div>
  )
}

export default MarketClock
