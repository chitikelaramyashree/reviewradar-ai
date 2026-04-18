export const parseAIResponse = (text) => {
  if (!text) return null;

  // Extract query
  const queryMatch = text.match(/🔍 Query:\s*(.*?)(?=\n|$)/i);
  const query = queryMatch ? queryMatch[1].trim() : "";

  // Extract Top Results
  const topResultsRegex = /Top Results:([\s\S]*?)(?:Summary:|$)/i;
  const topResultsMatch = text.match(topResultsRegex);
  const results = [];

  if (topResultsMatch) {
    const lines = topResultsMatch[1].trim().split('\n');
    lines.forEach(line => {
      let cleanLine = line.trim();
      if (!cleanLine) return;
      
      let sentiment = 'neutral';
      if (cleanLine.toUpperCase().includes('[NEGATIVE]')) sentiment = 'negative';
      else if (cleanLine.toUpperCase().includes('[POSITIVE]')) sentiment = 'positive';
      
      // Remove tags
      let textContent = cleanLine
        .replace(/\[(NEGATIVE|POSITIVE|NEUTRAL)\]/gi, '')
        .trim();
        
      if (textContent) {
        results.push({ sentiment, text: textContent });
      }
    });
  }

  // Extract Summary
  const summaryRegex = /Summary:([\s\S]*?)$/i;
  const summaryMatch = text.match(summaryRegex);
  const summary = [];

  if (summaryMatch) {
    const lines = summaryMatch[1].trim().split('\n');
    lines.forEach(line => {
      let cleanLine = line.trim();
      if (!cleanLine) return;
      
      // Remove leading bullet
      cleanLine = cleanLine.replace(/^[\*\-]\s*/, '').trim();
      
      // Extract title and description
      const titleMatch = cleanLine.match(/^\*\*(.*?)\*\*(?:\s*:|\s*-)?\s*(.*)$/);
      
      if (titleMatch) {
        summary.push({ title: titleMatch[1].trim(), description: titleMatch[2].replace(/\*\*/g, '').trim() });
      } else {
        if (cleanLine) {
           summary.push({ title: "", description: cleanLine.replace(/\*\*/g, '').trim() });
        }
      }
    });
  }

  return { query, results, summary };
};
