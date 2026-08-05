import { Outlet, useLocation } from 'react-router'

import SiteHeader from './SiteHeader.jsx'

function AppLayout() {
  const location = useLocation()

  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <SiteHeader />
      <Outlet key={`${location.pathname}${location.search}`} />
    </div>
  )
}

export default AppLayout
