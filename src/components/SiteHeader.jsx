import { Container, Nav, Navbar } from 'react-bootstrap'
import { NavLink } from 'react-router'

function SiteHeader() {
  return (
    <Navbar expand="sm" variant="dark" className="site-header py-3">
      <Container>
        <Navbar.Brand as={NavLink} to="/" className="fw-semibold">
          QuickTest
        </Navbar.Brand>

        <Navbar.Toggle aria-controls="main-nav" />
        <Navbar.Collapse id="main-nav">
          <Nav className="ms-auto gap-2">
            <Nav.Link as={NavLink} to="/" end>
              Dashboard
            </Nav.Link>
            <Nav.Link as={NavLink} to="/about">
              About
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}

export default SiteHeader
