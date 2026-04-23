const ResultCard = ({ sentiment, text }) => (
  <div className={`result-card ${sentiment}`}>
    <div className={`sentiment-badge ${sentiment}`}>
      {sentiment === "negative" && "🔴 Negative"}
      {sentiment === "positive" && "🟢 Positive"}
      {sentiment === "neutral" && "⚪ Neutral"}
    </div>
    <p>{text}</p>
  </div>
);

export default ResultCard;
