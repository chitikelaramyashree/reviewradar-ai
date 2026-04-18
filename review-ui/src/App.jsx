import { useState } from "react";
import { parseAIResponse } from "./utils/parser";
import "./App.css";

const ResultCard = ({ sentiment, text }) => {
  return (
    <div className={`result-card ${sentiment}`}>
      <div className={`sentiment-badge ${sentiment}`}>
        {sentiment === 'negative' && '🔴 Negative'}
        {sentiment === 'positive' && '🟢 Positive'}
        {sentiment === 'neutral' && '⚪ Neutral'}
      </div>
      <p>{text}</p>
    </div>
  );
};

const SummaryCard = ({ title, description }) => {
  return (
    <div className="summary-card">
      {title && <h4>{title}</h4>}
      <p>{description}</p>
    </div>
  );
};

function App() {
  const [queryInput, setQueryInput] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const sendQuery = async () => {
    if (!queryInput.trim()) return;

    setIsLoading(true);
    setParsedData(null);
    setError("");

    try {
      const res = await fetch("http://127.0.0.1:5000/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryInput.trim() })
      });

      const data = await res.json();
      if (data.response) {
        setParsedData(parseAIResponse(data.response));
      } else {
        setError("Invalid response from server.");
      }
    } catch (err) {
      setError("Failed to connect to the backend.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      sendQuery();
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>ReviewRadar AI</h1>
        <p className="subtitle">AI-Powered Amazon Review Analyzer</p>
      </header>

      <main className="main-content">
        <div className="search-section">
          <input
            className="search-input"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search for reviews or products..."
          />
          <button 
            className="search-button" 
            onClick={sendQuery} 
            disabled={isLoading || !queryInput.trim()}
          >
            {isLoading ? "Searching..." : "Analyze Reviews"}
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {parsedData && !isLoading && (
          <div className="dashboard">
            {parsedData.query && (
              <div className="query-display">
                <span className="query-label">Results for:</span>
                <span className="query-text">"{parsedData.query}"</span>
              </div>
            )}

            <div className="dashboard-grid">
              {parsedData.summary.length > 0 && (
                <section className="dashboard-section summary-section">
                  <h2>Key Insights</h2>
                  <div className="summary-cards-container">
                    {parsedData.summary.map((item, i) => (
                      <SummaryCard key={i} title={item.title} description={item.description} />
                    ))}
                  </div>
                </section>
              )}

              {parsedData.results.length > 0 && (
                <section className="dashboard-section results-section">
                  <h2>Top Reviews</h2>
                  <div className="results-cards-container">
                    {parsedData.results.map((res, i) => (
                      <ResultCard key={i} sentiment={res.sentiment} text={res.text} />
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;