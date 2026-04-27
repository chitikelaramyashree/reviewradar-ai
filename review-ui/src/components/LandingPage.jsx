const LandingPage = ({ onStart }) => (
  <div className="landing">
    <nav className="nav">
      <span className="nav-logo">ReviewRadar AI</span>
    </nav>

    <section className="hero">
      <div className="hero-badge">Powered by FAISS + LLaMA 3</div>
      <h1 className="hero-title">
        Understand Any Dataset of{" "}
        <span className="gradient-text">Customer Reviews</span>
      </h1>
      <p className="hero-subtitle">
        Upload your own CSV, ask questions in plain English, and get
        AI-powered sentiment analysis, key insights, and sales intelligence
        — in seconds.
      </p>
      <button className="cta-button" onClick={onStart}>
        Get Started →
      </button>
    </section>

    <section className="how-it-works">
      <h2 className="section-title">How It Works</h2>
      <div className="steps">
        <div className="step">
          <div className="step-number">1</div>
          <h3>Upload Your CSV</h3>
          <p>
            Drop in any review dataset. Column names are detected
            automatically — no manual formatting required.
          </p>
        </div>
        <div className="step">
          <div className="step-number">2</div>
          <h3>Ask a Question</h3>
          <p>
            Type a topic like "poor battery life" or "great packaging".
            FAISS finds the most semantically relevant reviews instantly.
          </p>
        </div>
        <div className="step">
          <div className="step-number">3</div>
          <h3>Get AI Insights</h3>
          <p>
            LLaMA 3 summarizes the top matches into clear bullet points
            with sentiment analytics and sales intelligence.
          </p>
        </div>
      </div>
    </section>

    <section className="features">
      <div className="feature-card">
        <div className="feature-icon">📂</div>
        <h3>Bring Your Own Data</h3>
        <p>
          Works with any CSV containing review text. Columns are detected
          automatically — review, text, content, and more.
        </p>
      </div>
      <div className="feature-card">
        <div className="feature-icon">💬</div>
        <h3>Sentiment Analysis</h3>
        <p>
          Every review is scored positive or negative. Analytics show
          the breakdown and a business insight at a glance.
        </p>
      </div>
      <div className="feature-card">
        <div className="feature-icon">🤖</div>
        <h3>LLM Summarization</h3>
        <p>
          LLaMA 3 reads the top matches and distills them into three
          focused bullet points — actionable and concise.
        </p>
      </div>
    </section>
  </div>
);

export default LandingPage;
