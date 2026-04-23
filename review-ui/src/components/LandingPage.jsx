const LandingPage = ({ onStart }) => (
  <div className="landing">
    <nav className="nav">
      <span className="nav-logo">ReviewRadar AI</span>
    </nav>

    <section className="hero">
      <div className="hero-badge">Powered by FAISS + LLaMA 3</div>
      <h1 className="hero-title">
        Discover What Customers{" "}
        <span className="gradient-text">Really Think</span>
      </h1>
      <p className="hero-subtitle">
        Search 21,000+ Amazon reviews instantly. Get AI-powered insights,
        sentiment breakdowns, and plain-English summaries — in seconds.
      </p>
      <button className="cta-button" onClick={onStart}>
        Analyze Reviews →
      </button>
    </section>

    <section className="how-it-works">
      <h2 className="section-title">How It Works</h2>
      <div className="steps">
        <div className="step">
          <div className="step-number">1</div>
          <h3>Type a Query</h3>
          <p>
            Describe a concern or topic like "poor battery life" or "great
            packaging". No keywords required.
          </p>
        </div>
        <div className="step">
          <div className="step-number">2</div>
          <h3>Semantic Search</h3>
          <p>
            FAISS finds the most relevant reviews using AI embeddings — it
            understands meaning, not just matching words.
          </p>
        </div>
        <div className="step">
          <div className="step-number">3</div>
          <h3>AI Summary</h3>
          <p>
            LLaMA 3 reads the top reviews and distills them into 3 clear
            bullet-point insights.
          </p>
        </div>
      </div>
    </section>

    <section className="features">
      <div className="feature-card">
        <div className="feature-icon">🔍</div>
        <h3>Semantic Search</h3>
        <p>
          Understands the intent behind your query and finds reviews that match
          its meaning, even when phrased differently.
        </p>
      </div>
      <div className="feature-card">
        <div className="feature-icon">💬</div>
        <h3>Sentiment Filtering</h3>
        <p>
          Automatically detects whether your query is about a positive or
          negative experience and surfaces matching reviews.
        </p>
      </div>
      <div className="feature-card">
        <div className="feature-icon">🤖</div>
        <h3>LLM Summarization</h3>
        <p>
          LLaMA 3 synthesizes the top matches into focused bullet points so you
          get actionable insights without reading everything.
        </p>
      </div>
    </section>
  </div>
);

export default LandingPage;
