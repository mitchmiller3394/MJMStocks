import { HashRouter, Navigate, Route, Routes } from 'react-router'
import './App.css'
import './styles/StockSearchBar.css'
import './styles/PortfolioPage.css'
import './styles/AccountPage.css'

import AppLayout from './components/AppLayout.jsx'
import AccountPage from './pages/AccountPage.jsx'
import HomePage from './pages/HomePage.jsx'
import PortfolioPage from './pages/PortfolioPage.jsx'
import TransactionsPage from './pages/TransactionsPage.jsx'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/portfolio" element={<PortfolioPage />} />
          <Route path="/account" element={<AccountPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}

export default App
