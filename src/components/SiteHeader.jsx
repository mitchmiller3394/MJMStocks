import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink, useNavigate } from 'react-router'
import AccountBalanceBadge from './AccountBalanceBadge.jsx'

function SiteHeader() {
  const navigate = useNavigate()

  return (
    <Navbar expand="sm" variant="dark" className="site-header py-3">
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="fw-semibold">
          MJM Stocks
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto gap-2 align-items-center">
            <Nav.Link
              as="button"
              type="button"
              onClick={() => navigate('/portfolio')}
            >
              Portfolio
            </Nav.Link>
            <AccountBalanceBadge />
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default SiteHeader
