import { Outlet } from 'react-router'

import SiteHeader from './SiteHeader.jsx'

function AppLayout() {
  return (
    <div className="app-shell d-flex flex-column min-vh-100">
      <SiteHeader />
      <Outlet />
    </div>
  )
}

export default AppLayout
