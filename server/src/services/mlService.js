const ML_SERVICE_URL =
  process.env.ML_SERVICE_URL || "http://127.0.0.1:8000";

const callMLService = async (endpoint, payload, timeout = 30000) => {
  try {
    const response = await fetch(`${ML_SERVICE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeout),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.detail || "ML service request failed.");
    }

    return data;
  } catch (error) {
    console.error(`ML service error (${endpoint}):`, error.message);
    throw new Error(error.message);
  }
};

export const extractKeywords = async (text) => {
  return callMLService("/api/keywords", { text }, 15000);
};

export const calculateSemanticSimilarity = async (text1, text2) => {
  return callMLService(
    "/api/semantic-similarity",
    { text1, text2 },
    60000
  );
};

export const clusterPapers = async (papers, numberOfClusters) => {
  return callMLService(
    "/api/cluster-papers",
    { papers, numberOfClusters },
    60000
  );
};

// Generate semantic recommendations for a selected research paper.
export const recommendPapers = async (targetPaperId, papers, topK = 5) => {
  return callMLService(
    "/api/recommend-papers",
    {
      targetPaperId,
      papers,
      topK,
    },
    60000
  );
};
