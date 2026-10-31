import "./App.css";

function App() {
  return (
    <main className="home">
      <span className="badge">Your research workspace</span>

      <h1>AI-Powered Research Assistant</h1>

      <p>
        Organize research papers, understand key findings,
        and explore ideas with AI.
      </p>

      <section className="feature-grid">
        <article className="feature-card">
          <h2>Organize papers</h2>
          <p>Keep your research papers together in projects.</p>
        </article>

        <article className="feature-card">
          <h2>Generate summaries</h2>
          <p>Understand the objectives, methods, and findings of a paper.</p>
        </article>

        <article className="feature-card">
          <h2>Ask questions</h2>
          <p>Find answers supported by your uploaded papers.</p>
        </article>
      </section>
    </main>
  );
}

export default App;
