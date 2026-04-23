import { useState } from "react";
import { parseAIResponse } from "../utils/parser";
import ResultCard from "./ResultCard";
import SummaryCard from "./SummaryCard";

function AnalyzerPage({ onBack }) {
  const [queryInput, setQueryInput] = useState("");
  const [parsedData, setParsedData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const apiBase = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000";

  const sendQuery = async () => {
    if (!queryInput.trim()) return;

    setIsLoading(true);
    setParsedData(null);
    setError("");

    try {
      const res = await fetch(`${apiBase}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queryInput.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "An error occurred. Please try again.");
        return;
      }

      if (data.response) {
        setParsedData(parseAIResponse(data.response));
      } else {
        setError("Invalid response from server.");
      }
    } catch {
      setError("Failed to connect to the backend. Is the server running?");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") sendQuery();
  };

  const handleReset = () => {
    setQueryInput("");
    setParsedData(null);
    setError("");
  };

  return (
    <div className="app-container">
      <header className="header">
        <button className="back-button" onClick={onBack}>
          ← Home
        </button>
        <div className="header-titles">
          <h1>ReviewRadar AI</h1>
          <p className="subtitle">AI-Powered Amazon Review Analyzer</p>
        </div>
      </header>

      <main className="main-content">
        <div className="search-section">
          <input
            className="search-input"
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. poor delivery, great quality, bad packaging..."
          />
          <button
            className="search-button"
            onClick={sendQuery}
            disabled={isLoading || !queryInput.trim()}
          >
            {isLoading ? "Analyzing..." : "Analyze Reviews"}
          </button>
          {(parsedData || error) && (
            <button className="clear-button" onClick={handleReset}>
              Clear
            </button>
          )}
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
                      <SummaryCard
                        key={i}
                        title={item.title}
                        description={item.description}
                      />
                    ))}
                  </div>
                </section>
              )}

              {parsedData.results.length > 0 && (
                <section className="dashboard-section results-section">
                  <h2>Top Reviews</h2>
                  <div className="results-cards-container">
                    {parsedData.results.map((res, i) => (
                      <ResultCard
                        key={i}
                        sentiment={res.sentiment}
                        text={res.text}
                      />
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

export default AnalyzerPage;
