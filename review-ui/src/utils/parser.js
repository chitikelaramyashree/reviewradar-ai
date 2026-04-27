/**
 * Parse the LLM summary markdown string into [{title, description}] objects.
 * Handles formats like "* **Title**: description" or "- plain sentence".
 */
export const parseSummary = (text) => {
  if (!text) return [];
  const summary = [];

  text.trim().split("\n").forEach((line) => {
    let clean = line.trim();
    if (!clean) return;

    clean = clean.replace(/^[\*\-\d\.]+\s*/, "").trim();

    const boldMatch = clean.match(/^\*\*(.*?)\*\*(?:\s*:|\s*-)?\s*(.*)$/);
    if (boldMatch) {
      summary.push({
        title: boldMatch[1].trim(),
        description: boldMatch[2].replace(/\*\*/g, "").trim(),
      });
    } else if (clean) {
      summary.push({ title: "", description: clean.replace(/\*\*/g, "").trim() });
    }
  });

  return summary;
};
