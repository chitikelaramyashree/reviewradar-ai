const SummaryCard = ({ title, description }) => (
  <div className="summary-card">
    {title && <h4>{title}</h4>}
    <p>{description}</p>
  </div>
);

export default SummaryCard;
