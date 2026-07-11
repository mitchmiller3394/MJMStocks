import { Card, Container } from 'react-bootstrap'

function AboutPage() {
  return (
    <main className="page-shell py-4 py-md-5">
      <Container className="px-3 px-md-4">
        <Card className="glass-panel mx-auto border-0 p-3 p-sm-4 p-lg-5">
          <p className="eyebrow mb-2">About this mockup</p>
          <h1 className="about-title mb-3">Built for expansion</h1>
          <p className="about-copy mb-4">
            This demo uses a small route structure so the dashboard can grow cleanly
            before any real API integration is added.
          </p>

          <div className="about-grid">
            <div className="about-item">
              <h2 className="about-item-title">Hash routing</h2>
              <p className="about-item-copy mb-0">
                Works cleanly for static hosting and GitHub Pages.
              </p>
            </div>
            <div className="about-item">
              <h2 className="about-item-title">Reusable components</h2>
              <p className="about-item-copy mb-0">
                Clock, chart, and layout pieces are separated for future reuse.
              </p>
            </div>
            <div className="about-item">
              <h2 className="about-item-title">Bootstrap UI</h2>
              <p className="about-item-copy mb-0">
                React-Bootstrap keeps the styling and responsive behavior consistent.
              </p>
            </div>
          </div>
        </Card>
      </Container>
    </main>
  )
}

export default AboutPage
