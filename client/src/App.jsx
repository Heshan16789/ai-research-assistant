import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API = "/api";

const getId = (item) => item?._id || item?.id || "";

const getArray = (data, key) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data?.data?.[key])) return data.data[key];
  return [];
};

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString() : "—";

const emptyPaperForm = () => ({
  title: "",
  abstract: "",
  authors: "",
  publicationYear: new Date().getFullYear(),
  venue: "",
  doi: "",
  pdfUrl: "",
  keywords: "",
});

async function apiRequest(path, options = {}, token = "") {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const raw = await response.text();
  let data;

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { message: raw || "Invalid server response." };
  }

  if (!response.ok) {
    throw new Error(
      data.message || data.detail || `Request failed (${response.status})`
    );
  }

  return data;
}

const navigation = [
  {
    group: "WORKSPACE",
    items: [
      { id: "overview", icon: "⌂", label: "Overview" },
      { id: "projects", icon: "▤", label: "My projects" },
      { id: "papers", icon: "▧", label: "Research library" },
    ],
  },
  {
    group: "AI RESEARCH TOOLS",
    items: [
      { id: "compare", icon: "⇄", label: "Compare papers" },
      { id: "clustering", icon: "◈", label: "Paper clustering" },
      { id: "recommendations", icon: "✧", label: "Recommendations" },
    ],
  },
];

const pageInfo = {
  overview: {
    title: "Overview",
    subtitle: "Your research activity at a glance.",
  },
  projects: {
    title: "My projects",
    subtitle: "Organize your academic research into projects.",
  },
  papers: {
    title: "Research library",
    subtitle: "Manage and explore your research papers.",
  },
  compare: {
    title: "Compare papers",
    subtitle: "Understand how different research papers relate.",
  },
  clustering: {
    title: "Paper clustering",
    subtitle: "Automatically discover groups of related research.",
  },
  recommendations: {
    title: "Recommendations",
    subtitle: "Discover research papers related to your interests.",
  },
};

function App() {
  const [token, setToken] = useState(
    () => sessionStorage.getItem("research_token") || ""
  );
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [activeTab, setActiveTab] = useState("overview");
  const [projects, setProjects] = useState([]);
  const [papers, setPapers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");

  const [projectForm, setProjectForm] = useState({
    title: "",
    description: "",
  });

  const [paperForm, setPaperForm] = useState(emptyPaperForm);
  const [editingPaperId, setEditingPaperId] = useState("");
  const [showPaperForm, setShowPaperForm] = useState(false);
  const [viewingPaper, setViewingPaper] = useState(null);

  const [paperSearch, setPaperSearch] = useState("");
  const [projectSearch, setProjectSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");

  const [selectedPaperIds, setSelectedPaperIds] = useState([]);
  const [comparisonResult, setComparisonResult] = useState(null);
  const [clusteringResult, setClusteringResult] = useState(null);
  const [recommendationResult, setRecommendationResult] = useState(null);

  const [numberOfClusters, setNumberOfClusters] = useState(2);
  const [recommendationPaperId, setRecommendationPaperId] = useState("");
  const [topK, setTopK] = useState(5);

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);
  const [keywordLoading, setKeywordLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const selectedProject = projects.find(
    (project) => getId(project) === selectedProjectId
  );

  const clearMessages = () => {
    setError("");
    setNotice("");
  };

  // --------------------------------------------------
  // Authentication
  // --------------------------------------------------

  const authenticate = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const endpoint =
        authMode === "login" ? "/auth/login" : "/auth/register";
      const payload =
        authMode === "login"
          ? { email: authForm.email, password: authForm.password }
          : authForm;

      const data = await apiRequest(endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (data.token) {
        sessionStorage.setItem("research_token", data.token);
        setToken(data.token);
        setUser(data.user || null);
      } else if (authMode === "register") {
        setAuthMode("login");
        setNotice("Your account has been created. Please sign in.");
      } else {
        throw new Error("Login response did not contain an access token.");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    sessionStorage.removeItem("research_token");
    setToken("");
    setUser(null);
    setProjects([]);
    setPapers([]);
    setSelectedProjectId("");
    setActiveTab("overview");
    setShowPaperForm(false);
    setEditingPaperId("");
    setViewingPaper(null);
    clearMessages();
  };

  // --------------------------------------------------
  // Load projects
  // --------------------------------------------------

  const loadProjects = useCallback(async () => {
    if (!token) return;

    setPageLoading(true);
    try {
      const data = await apiRequest("/projects", {}, token);
      const list = getArray(data, "projects");
      setProjects(list);

      setSelectedProjectId((current) => {
        if (current && list.some((project) => getId(project) === current)) {
          return current;
        }
        return getId(list[0]);
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setPageLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) loadProjects();
  }, [token, loadProjects]);

  // --------------------------------------------------
  // Load papers belonging to the selected project
  // --------------------------------------------------

  const loadPapers = useCallback(async () => {
    if (!token || !selectedProjectId) {
      setPapers([]);
      return;
    }

    try {
      const data = await apiRequest(
        `/papers/${selectedProjectId}`,
        {},
        token
      );
      setPapers(getArray(data, "papers"));
      setSelectedPaperIds([]);
      setComparisonResult(null);
      setClusteringResult(null);
      setRecommendationResult(null);
      setRecommendationPaperId("");
      setYearFilter("all");
    } catch (err) {
      setPapers([]);
      setError(err.message);
    }
  }, [token, selectedProjectId]);

  useEffect(() => {
    loadPapers();
  }, [loadPapers]);

  // --------------------------------------------------
  // Create project
  // --------------------------------------------------

  const createProject = async (event) => {
    event.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        "/projects",
        {
          method: "POST",
          body: JSON.stringify(projectForm),
        },
        token
      );

      setProjectForm({ title: "", description: "" });
      setNotice(data.message || "Project created successfully.");
      await loadProjects();

      if (data.project?._id) {
        setSelectedProjectId(data.project._id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Open paper forms
  // --------------------------------------------------

  const openAddPaper = () => {
    setEditingPaperId("");
    setPaperForm(emptyPaperForm());
    setViewingPaper(null);
    setShowPaperForm(true);
    setActiveTab("papers");
    clearMessages();
  };

  const openEditPaper = (paper) => {
    setEditingPaperId(getId(paper));
    setPaperForm({
      title: paper.title || "",
      abstract: paper.abstract || "",
      authors: (paper.authors || []).join(", "),
      publicationYear: paper.publicationYear || new Date().getFullYear(),
      venue: paper.venue || "",
      doi: paper.doi || "",
      pdfUrl: paper.pdfUrl || "",
      keywords: (paper.keywords || []).join(", "),
    });
    setViewingPaper(null);
    setShowPaperForm(true);
    setActiveTab("papers");
    clearMessages();
  };

  const closePaperForm = () => {
    setShowPaperForm(false);
    setEditingPaperId("");
    setPaperForm(emptyPaperForm());
  };

  // --------------------------------------------------
  // Create or update research paper
  // --------------------------------------------------

  const savePaper = async (event) => {
    event.preventDefault();

    if (!selectedProjectId) {
      setError("Please select a project first.");
      return;
    }

    if (!paperForm.title.trim()) {
      setError("Paper title is required.");
      return;
    }

    if (
      paperForm.publicationYear !== "" &&
      (!Number.isInteger(Number(paperForm.publicationYear)) ||
        Number(paperForm.publicationYear) < 1900 ||
        Number(paperForm.publicationYear) > 2100)
    ) {
      setError("Enter a valid publication year between 1900 and 2100.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const payload = {
        title: paperForm.title.trim(),
        abstract: paperForm.abstract.trim(),
        authors: paperForm.authors
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        venue: paperForm.venue.trim(),
        doi: paperForm.doi.trim(),
        pdfUrl: paperForm.pdfUrl.trim(),
        keywords: paperForm.keywords
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      };

      if (paperForm.publicationYear !== "") {
        payload.publicationYear = Number(paperForm.publicationYear);
      }

      const isEditing = Boolean(editingPaperId);
      const endpoint = isEditing
        ? `/papers/${selectedProjectId}/${editingPaperId}`
        : `/papers/${selectedProjectId}`;

      const data = await apiRequest(
        endpoint,
        {
          method: isEditing ? "PUT" : "POST",
          body: JSON.stringify(payload),
        },
        token
      );

      closePaperForm();
      setNotice(
        data.message ||
          (isEditing
            ? "Research paper updated successfully."
            : "Research paper added successfully.")
      );
      await loadPapers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Delete research paper
  // --------------------------------------------------

  const deletePaper = async (paper) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${paper.title}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        `/papers/${selectedProjectId}/${getId(paper)}`,
        { method: "DELETE" },
        token
      );

      setViewingPaper(null);
      setSelectedPaperIds((current) =>
        current.filter((id) => id !== getId(paper))
      );
      setNotice(data.message || "Research paper deleted successfully.");
      await loadPapers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // YAKE keyword extraction
  // --------------------------------------------------

  const generateKeywords = async () => {
    const abstract = paperForm.abstract.trim();

    if (abstract.length < 30) {
      setError("Enter an abstract containing at least 30 characters first.");
      return;
    }

    clearMessages();
    setKeywordLoading(true);

    try {
      const data = await apiRequest(
        "/keywords/extract",
        {
          method: "POST",
          body: JSON.stringify({ text: abstract }),
        },
        token
      );

      const extracted = (data.keywords || [])
        .map((item) => item.keyword)
        .filter(Boolean);

      setPaperForm((current) => ({
        ...current,
        keywords: extracted.join(", "),
      }));
      setNotice(
        `${extracted.length} keywords extracted successfully using YAKE. Review them before saving.`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setKeywordLoading(false);
    }
  };

  // --------------------------------------------------
  // Paper comparison
  // --------------------------------------------------

  const togglePaperSelection = (paperId) => {
    setSelectedPaperIds((current) => {
      if (current.includes(paperId)) {
        return current.filter((id) => id !== paperId);
      }

      if (current.length >= 5) {
        setError("You can compare a maximum of five papers.");
        return current;
      }

      return [...current, paperId];
    });

    setError("");
    setComparisonResult(null);
  };

  const comparePapers = async () => {
    if (selectedPaperIds.length < 2) {
      setError("Select at least two papers to compare.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        "/comparisons",
        {
          method: "POST",
          body: JSON.stringify({ paperIds: selectedPaperIds }),
        },
        token
      );

      setComparisonResult(data.comparison || data);
      setNotice("Comparison completed successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // K-Means clustering
  // --------------------------------------------------

  const runClustering = async () => {
    if (papers.length < 2) {
      setError("Add at least two research papers before clustering.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        `/clustering/${selectedProjectId}`,
        {
          method: "POST",
          body: JSON.stringify({
            numberOfClusters: Number(numberOfClusters),
          }),
        },
        token
      );

      setClusteringResult(data.clustering || data);
      setNotice("Research groups generated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // AI recommendations
  // --------------------------------------------------

  const runRecommendations = async () => {
    if (!recommendationPaperId) {
      setError("Choose a paper to find related research.");
      return;
    }

    clearMessages();
    setLoading(true);

    try {
      const data = await apiRequest(
        `/recommendations/${selectedProjectId}/${recommendationPaperId}`,
        {
          method: "POST",
          body: JSON.stringify({ topK: Number(topK) }),
        },
        token
      );

      setRecommendationResult(data.recommendation || data);
      setNotice("Related research papers found.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // --------------------------------------------------
  // Search and filter data
  // --------------------------------------------------

  const filteredPapers = useMemo(() => {
    const search = paperSearch.trim().toLowerCase();

    return papers.filter((paper) => {
      const matchesSearch =
        !search ||
        paper.title?.toLowerCase().includes(search) ||
        paper.abstract?.toLowerCase().includes(search) ||
        paper.venue?.toLowerCase().includes(search) ||
        paper.doi?.toLowerCase().includes(search) ||
        paper.authors?.some((author) => author.toLowerCase().includes(search)) ||
        paper.keywords?.some((keyword) => keyword.toLowerCase().includes(search));

      const matchesYear =
        yearFilter === "all" ||
        String(paper.publicationYear || "") === yearFilter;

      return matchesSearch && matchesYear;
    });
  }, [papers, paperSearch, yearFilter]);

  const filteredProjects = useMemo(
    () =>
      projects.filter((project) =>
        project.title
          ?.toLowerCase()
          .includes(projectSearch.trim().toLowerCase())
      ),
    [projects, projectSearch]
  );

  // --------------------------------------------------
  // Authentication screen
  // --------------------------------------------------

  if (!token) {
    return (
      <div className="auth-page">
        <section className="auth-visual">
          <div className="auth-brand">
            <div className="brand-mark">R</div>
            <span>ResearchAI</span>
          </div>

          <div className="auth-visual-copy">
            <span className="eyebrow">YOUR ACADEMIC WORKSPACE</span>
            <h1>Bring your research together.</h1>
            <p>
              Organize academic papers, compare ideas and discover related
              research with intelligent tools.
            </p>
            <div className="auth-benefits">
              <span>✓ Organize your research</span>
              <span>✓ Compare academic papers</span>
              <span>✓ Discover related studies</span>
            </div>
          </div>

          <div className="auth-visual-footer">
            AI-powered tools for a more connected research journey.
          </div>
          <div className="auth-glow auth-glow-one" />
          <div className="auth-glow auth-glow-two" />
        </section>

        <section className="auth-form-side">
          <div className="auth-form">
            <span className="eyebrow">WELCOME TO RESEARCHAI</span>
            <h2>
              {authMode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p className="muted">
              {authMode === "login"
                ? "Sign in to continue to your research workspace."
                : "Create an account to start organizing your research."}
            </p>

            {error && <Alert type="error" message={error} />}
            {notice && <Alert type="success" message={notice} />}

            <form className="form-stack" onSubmit={authenticate}>
              {authMode === "register" && (
                <Field label="Full name">
                  <input
                    required
                    value={authForm.name}
                    onChange={(e) =>
                      setAuthForm({ ...authForm, name: e.target.value })
                    }
                    placeholder="Enter your full name"
                  />
                </Field>
              )}

              <Field label="Email address">
                <input
                  required
                  type="email"
                  value={authForm.email}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, email: e.target.value })
                  }
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="Password">
                <input
                  required
                  type="password"
                  minLength={6}
                  value={authForm.password}
                  onChange={(e) =>
                    setAuthForm({ ...authForm, password: e.target.value })
                  }
                  placeholder="Enter your password"
                />
              </Field>

              <button className="btn btn-primary full-width" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Sign in to ResearchAI"
                    : "Create account"}
              </button>
            </form>

            <div className="auth-switch">
              {authMode === "login"
                ? "New to ResearchAI?"
                : "Already have an account?"}
              <button
                type="button"
                onClick={() => {
                  setAuthMode(authMode === "login" ? "register" : "login");
                  clearMessages();
                }}
              >
                {authMode === "login" ? "Create an account" : "Sign in"}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  const currentPage = pageInfo[activeTab] || pageInfo.overview;

  // --------------------------------------------------
  // Main application
  // --------------------------------------------------

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">R</div>
          <div>
            <strong>ResearchAI</strong>
            <span>Research workspace</span>
          </div>
        </div>

        <div className="project-switcher">
          <label>ACTIVE PROJECT</label>
          <select
            value={selectedProjectId}
            onChange={(e) => {
              setSelectedProjectId(e.target.value);
              setViewingPaper(null);
              setPaperSearch("");
              setYearFilter("all");
              setRecommendationPaperId("");
              clearMessages();
            }}
          >
            <option value="">Choose a project</option>
            {projects.map((project) => (
              <option key={getId(project)} value={getId(project)}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        <nav className="sidebar-navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              <span className="nav-group-title">{group.group}</span>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`nav-link ${activeTab === item.id ? "active" : ""}`}
                  onClick={() => {
                    setActiveTab(item.id);
                    setViewingPaper(null);
                    clearMessages();
                  }}
                >
                  <span className="nav-symbol">{item.icon}</span>
                  <span>{item.label}</span>
                  {activeTab === item.id && <span className="nav-indicator" />}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-help">
          <div className="help-icon">?</div>
          <div>
            <strong>Need a hand?</strong>
            <span>Start by adding research papers to a project.</span>
          </div>
        </div>

        <div className="sidebar-account">
          <div className="account-avatar">
            {(user?.name || user?.email || "R").charAt(0).toUpperCase()}
          </div>
          <div className="account-info">
            <strong>{user?.name || "Researcher"}</strong>
            <span>{user?.email || "Your account"}</span>
          </div>
          <button
            className="account-logout"
            title="Sign out"
            onClick={logout}
          >
            ↗
          </button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="breadcrumb">
              Workspace <span>/</span> {currentPage.title}
            </div>
            <h1>{currentPage.title}</h1>
            <p>{currentPage.subtitle}</p>
          </div>

          <div className="topbar-actions">
            <div className="project-context">
              <span className="project-context-dot" />
              {selectedProject?.title || "No project selected"}
            </div>
            <button className="btn btn-primary" onClick={openAddPaper}>
              <span>＋</span> Add paper
            </button>
          </div>
        </header>

        <div className="content-area">
          {error && (
            <Alert
              type="error"
              message={error}
              onClose={() => setError("")}
            />
          )}
          {notice && (
            <Alert
              type="success"
              message={notice}
              onClose={() => setNotice("")}
            />
          )}

          {!selectedProjectId && activeTab !== "projects" ? (
            <div className="first-project-state">
              <div className="empty-illustration">▤</div>
              <span className="eyebrow">LET'S GET STARTED</span>
              <h2>Create your first research project</h2>
              <p>
                A project is where you keep related papers together and use
                the AI research tools.
              </p>
              <button
                className="btn btn-primary"
                onClick={() => setActiveTab("projects")}
              >
                Create a project
              </button>
            </div>
          ) : (
            <>
              {/* OVERVIEW */}
              {activeTab === "overview" && (
                <>
                  <section className="welcome-panel">
                    <div className="welcome-copy">
                      <span className="eyebrow light-eyebrow">
                        YOUR RESEARCH WORKSPACE
                      </span>
                      <h2>
                        {user?.name
                          ? `Welcome back, ${user.name}.`
                          : "Welcome to your research workspace."}
                      </h2>
                      <p>
                        Keep your papers organized, explore connections and
                        make your next research discovery.
                      </p>
                      <button
                        className="btn btn-light"
                        onClick={() => setActiveTab("papers")}
                      >
                        Explore research library <span>→</span>
                      </button>
                    </div>
                    <div className="welcome-decoration">
                      <div className="welcome-orbit orbit-a" />
                      <div className="welcome-orbit orbit-b" />
                      <div className="welcome-symbol">✧</div>
                    </div>
                  </section>

                  <div className="section-heading">
                    <div>
                      <h2>Research overview</h2>
                      <p>A quick look at your current project.</p>
                    </div>
                    <span className="subtle-project-name">
                      {selectedProject?.title}
                    </span>
                  </div>

                  <section className="stats-grid">
                    <StatCard
                      icon="▤"
                      label="Projects"
                      value={projects.length}
                      tone="purple"
                    />
                    <StatCard
                      icon="▧"
                      label="Research papers"
                      value={papers.length}
                      tone="blue"
                    />
                    <StatCard
                      icon="◈"
                      label="Clusters generated"
                      value={clusteringResult?.actualClusters ?? "—"}
                      tone="orange"
                    />
                    <StatCard
                      icon="✧"
                      label="Recommendations"
                      value={recommendationResult?.totalRecommendations ?? "—"}
                      tone="green"
                    />
                  </section>

                  <div className="section-heading">
                    <div>
                      <h2>What would you like to do?</h2>
                      <p>Choose your next research activity.</p>
                    </div>
                  </div>

                  <section className="workflow-grid">
                    <WorkflowCard
                      number="01"
                      icon="＋"
                      title="Add research papers"
                      description="Build your research library by adding papers and their abstracts."
                      action="Go to library"
                      onClick={openAddPaper}
                    />
                    <WorkflowCard
                      number="02"
                      icon="⇄"
                      title="Compare papers"
                      description="Compare abstracts, keywords and publication details."
                      action="Compare research"
                      onClick={() => setActiveTab("compare")}
                    />
                    <WorkflowCard
                      number="03"
                      icon="✧"
                      title="Discover related work"
                      description="Find relevant papers using semantic recommendations."
                      action="Find recommendations"
                      onClick={() => setActiveTab("recommendations")}
                    />
                  </section>

                  <div className="section-heading">
                    <div>
                      <h2>Recently added papers</h2>
                      <p>Your latest research additions.</p>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveTab("papers")}
                    >
                      View all papers →
                    </button>
                  </div>

                  <PaperList
                    papers={papers.slice(0, 4)}
                    onView={setViewingPaper}
                    onEdit={openEditPaper}
                    onDelete={deletePaper}
                  />
                </>
              )}

              {/* PROJECTS */}
              {activeTab === "projects" && (
                <>
                  <section className="page-intro">
                    <div>
                      <h2>Keep your research organized.</h2>
                      <p>
                        Create separate projects for different research topics,
                        assignments or investigations.
                      </p>
                    </div>
                    <span className="page-intro-icon">▤</span>
                  </section>

                  <section className="panel project-create-panel">
                    <div className="panel-heading">
                      <div>
                        <h2>Create a new project</h2>
                        <p>Give your research a name and a short description.</p>
                      </div>
                    </div>

                    <form className="project-form" onSubmit={createProject}>
                      <Field label="Project title">
                        <input
                          required
                          maxLength={150}
                          placeholder="e.g. Machine Learning Research"
                          value={projectForm.title}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              title: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <Field label="Description">
                        <input
                          maxLength={2000}
                          placeholder="What is this project about?"
                          value={projectForm.description}
                          onChange={(e) =>
                            setProjectForm({
                              ...projectForm,
                              description: e.target.value,
                            })
                          }
                        />
                      </Field>
                      <button className="btn btn-primary" disabled={loading}>
                        {loading ? "Creating..." : "Create project"}
                      </button>
                    </form>
                  </section>

                  <div className="section-heading">
                    <div>
                      <h2>Your projects</h2>
                      <p>{projects.length} projects in your workspace.</p>
                    </div>
                    <input
                      className="compact-search"
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                    />
                  </div>

                  {filteredProjects.length ? (
                    <div className="project-grid">
                      {filteredProjects.map((project) => (
                        <button
                          key={getId(project)}
                          className={`project-card ${
                            selectedProjectId === getId(project) ? "selected" : ""
                          }`}
                          onClick={() => {
                            setSelectedProjectId(getId(project));
                            clearMessages();
                          }}
                        >
                          <div className="project-card-top">
                            <span className="project-card-icon">▤</span>
                            <span className="project-status">
                              {project.status || "Planning"}
                            </span>
                          </div>
                          <h3>{project.title}</h3>
                          <p>{project.description || "No description added."}</p>
                          <div className="project-card-footer">
                            <span>Created {formatDate(project.createdAt)}</span>
                            <strong>
                              {selectedProjectId === getId(project)
                                ? "Selected ✓"
                                : "Open project →"}
                            </strong>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <EmptyState
                      title="No matching projects"
                      description="Try another search or create a new project."
                    />
                  )}
                </>
              )}

              {/* RESEARCH LIBRARY */}
              {activeTab === "papers" && (
                <>
                  <section className="page-intro">
                    <div>
                      <h2>Your academic research library.</h2>
                      <p>
                        Manage paper details, edit abstracts and extract
                        keywords automatically.
                      </p>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        if (showPaperForm) closePaperForm();
                        else openAddPaper();
                      }}
                    >
                      {showPaperForm ? "Close form" : "＋ Add research paper"}
                    </button>
                  </section>

                  {showPaperForm && (
                    <section className="panel paper-form-panel">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">
                            {editingPaperId ? "UPDATE PAPER" : "NEW PAPER"}
                          </span>
                          <h2>
                            {editingPaperId
                              ? "Edit research paper"
                              : "Add a research paper"}
                          </h2>
                          <p>
                            Enter the academic information. Fields marked with *
                            are required.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          onClick={closePaperForm}
                          aria-label="Close paper form"
                        >
                          ×
                        </button>
                      </div>

                      <form className="paper-form" onSubmit={savePaper}>
                        <Field label="Paper title *">
                          <input
                            required
                            maxLength={300}
                            placeholder="Enter the full research paper title"
                            value={paperForm.title}
                            onChange={(e) =>
                              setPaperForm({
                                ...paperForm,
                                title: e.target.value,
                              })
                            }
                          />
                        </Field>

                        <Field label="Abstract">
                          <textarea
                            rows={6}
                            maxLength={10000}
                            placeholder="Paste the research paper abstract here..."
                            value={paperForm.abstract}
                            onChange={(e) =>
                              setPaperForm({
                                ...paperForm,
                                abstract: e.target.value,
                              })
                            }
                          />
                        </Field>

                        <div className="keyword-extraction-row">
                          <small>
                            Extract important terms from an abstract using YAKE.
                            Review the extracted keywords before saving.
                          </small>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={generateKeywords}
                            disabled={
                              keywordLoading || paperForm.abstract.trim().length < 30
                            }
                          >
                            {keywordLoading
                              ? "Extracting..."
                              : "✧ Extract keywords with YAKE"}
                          </button>
                        </div>

                        <div className="form-grid-two">
                          <Field label="Authors">
                            <input
                              placeholder="Author 1, Author 2"
                              value={paperForm.authors}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  authors: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="Publication year">
                            <input
                              type="number"
                              min="1900"
                              max="2100"
                              value={paperForm.publicationYear}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  publicationYear: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>

                        <div className="form-grid-two">
                          <Field label="Journal or publication venue">
                            <input
                              placeholder="Journal or conference name"
                              value={paperForm.venue}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  venue: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="Keywords">
                            <input
                              placeholder="AI, Machine Learning, NLP"
                              value={paperForm.keywords}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  keywords: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>

                        <div className="form-grid-two">
                          <Field label="DOI (optional)">
                            <input
                              placeholder="10.xxxx/example"
                              value={paperForm.doi}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  doi: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label="PDF URL (optional)">
                            <input
                              type="url"
                              placeholder="https://example.com/paper.pdf"
                              value={paperForm.pdfUrl}
                              onChange={(e) =>
                                setPaperForm({
                                  ...paperForm,
                                  pdfUrl: e.target.value,
                                })
                              }
                            />
                          </Field>
                        </div>

                        <div className="form-actions">
                          <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={closePaperForm}
                          >
                            Cancel
                          </button>
                          <button
                            className="btn btn-primary"
                            disabled={loading || !selectedProjectId}
                          >
                            {loading
                              ? "Saving..."
                              : editingPaperId
                                ? "Save changes"
                                : "Save research paper"}
                          </button>
                        </div>
                      </form>
                    </section>
                  )}

                  <section className="library-toolbar">
                    <div>
                      <h2>All papers</h2>
                      <p>
                        {filteredPapers.length} of {papers.length} papers in{" "}
                        {selectedProject?.title || "your project"}.
                      </p>
                    </div>
                    <div className="search-box">
                      <span>⌕</span>
                      <input
                        placeholder="Search titles, abstracts, authors or keywords..."
                        value={paperSearch}
                        onChange={(e) => setPaperSearch(e.target.value)}
                      />
                    </div>
                  </section>

                  <PaperList
                    papers={filteredPapers}
                    onView={setViewingPaper}
                    onEdit={openEditPaper}
                    onDelete={deletePaper}
                    showControls
                    yearFilter={yearFilter}
                    setYearFilter={setYearFilter}
                    sortBy={sortBy}
                    setSortBy={setSortBy}
                  />
                </>
              )}

              {/* PAPER COMPARISON */}
              {activeTab === "compare" && (
                <>
                  <section className="page-intro">
                    <div>
                      <span className="eyebrow">PAPER ANALYSIS</span>
                      <h2>Explore similarities between papers.</h2>
                      <p>
                        Select at least two papers to compare their abstracts,
                        keywords and publication details.
                      </p>
                    </div>
                    <span className="page-intro-icon">⇄</span>
                  </section>

                  <div className="analysis-grid">
                    <section className="panel">
                      <div className="panel-heading">
                        <div>
                          <h2>1. Select papers</h2>
                          <p>Choose 2–5 papers from the active project.</p>
                        </div>
                        <span className="step-number">01</span>
                      </div>

                      <div className="selection-summary">
                        <strong>{selectedPaperIds.length} selected</strong>
                        <span>Choose at least 2 papers</span>
                      </div>

                      <div className="select-paper-list">
                        {papers.map((paper) => (
                          <label
                            key={getId(paper)}
                            className={`select-paper ${
                              selectedPaperIds.includes(getId(paper))
                                ? "checked"
                                : ""
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPaperIds.includes(getId(paper))}
                              onChange={() => togglePaperSelection(getId(paper))}
                            />
                            <span className="custom-checkbox">✓</span>
                            <span className="select-paper-info">
                              <strong>{paper.title}</strong>
                              <small>
                                {paper.publicationYear || "Year unavailable"} ·{" "}
                                {paper.venue || "Venue unavailable"}
                              </small>
                            </span>
                          </label>
                        ))}
                        {!papers.length && (
                          <EmptyState
                            title="No papers in this project"
                            description="Add research papers before starting a comparison."
                          />
                        )}
                      </div>

                      <button
                        className="btn btn-primary full-width"
                        onClick={comparePapers}
                        disabled={loading || selectedPaperIds.length < 2}
                      >
                        {loading ? "Comparing papers..." : "Compare selected papers"}
                      </button>
                    </section>

                    <section className="panel result-panel">
                      {!comparisonResult ? (
                        <AnalysisPlaceholder
                          icon="⇄"
                          title="Your comparison will appear here"
                          description="Select your research papers and run a comparison to view the analysis."
                        />
                      ) : (
                        <>
                          <div className="panel-heading">
                            <div>
                              <span className="eyebrow">ANALYSIS COMPLETE</span>
                              <h2>Comparison results</h2>
                              <p>{comparisonResult.totalPapers} papers analyzed.</p>
                            </div>
                            <span className="success-icon">✓</span>
                          </div>

                          <ResultSection title="Abstract similarity">
                            {(comparisonResult.abstractSimilarity?.similarities || []).map(
                              (item, index) => (
                                <SimilarityRow
                                  key={index}
                                  item={item}
                                  algorithm="TF-IDF"
                                />
                              )
                            )}
                          </ResultSection>

                          <ResultSection title="Semantic similarity">
                            {(comparisonResult.semanticSimilarity?.similarities || []).map(
                              (item, index) => (
                                <SimilarityRow
                                  key={index}
                                  item={item}
                                  algorithm="Sentence-BERT"
                                />
                              )
                            )}
                          </ResultSection>

                          <ResultSection title="Shared keywords">
                            <TagList
                              items={comparisonResult.keywordAnalysis?.commonKeywords || []}
                              emptyText="No common keywords found."
                            />
                          </ResultSection>

                          <ResultSection title="Publication overview">
                            <div className="mini-stats">
                              <MiniStat
                                label="Earliest year"
                                value={comparisonResult.publicationAnalysis?.earliestYear ?? "—"}
                              />
                              <MiniStat
                                label="Latest year"
                                value={comparisonResult.publicationAnalysis?.latestYear ?? "—"}
                              />
                              <MiniStat
                                label="Year difference"
                                value={comparisonResult.publicationAnalysis?.yearRange ?? "—"}
                              />
                            </div>
                          </ResultSection>
                        </>
                      )}
                    </section>
                  </div>
                </>
              )}

              {/* CLUSTERING */}
              {activeTab === "clustering" && (
                <>
                  <section className="page-intro">
                    <div>
                      <span className="eyebrow">UNSUPERVISED LEARNING</span>
                      <h2>Find groups of related research.</h2>
                      <p>
                        K-Means organizes your papers into groups based on their
                        titles, abstracts and keywords.
                      </p>
                    </div>
                    <span className="page-intro-icon">◈</span>
                  </section>

                  <section className="panel analysis-control">
                    <div className="panel-heading">
                      <div>
                        <h2>Set up your clustering</h2>
                        <p>Choose how many groups you want the system to create.</p>
                      </div>
                      <span className="step-number">01</span>
                    </div>

                    <div className="analysis-options">
                      <Field label="Number of groups">
                        <select
                          value={numberOfClusters}
                          onChange={(e) =>
                            setNumberOfClusters(Number(e.target.value))
                          }
                          disabled={papers.length < 2}
                        >
                          {Array.from(
                            {
                              length: Math.max(
                                0,
                                Math.min(10, papers.length) - 1
                              ),
                            },
                            (_, index) => index + 2
                          ).map((count) => (
                            <option key={count} value={count}>
                              {count} groups
                            </option>
                          ))}
                        </select>
                      </Field>

                      <div className="analysis-info">
                        <strong>{papers.length} papers available</strong>
                        <span>At least two papers are needed.</span>
                      </div>

                      <button
                        className="btn btn-primary"
                        onClick={runClustering}
                        disabled={loading || papers.length < 2}
                      >
                        {loading ? "Grouping papers..." : "Group my papers"}
                      </button>
                    </div>
                  </section>

                  {clusteringResult ? (
                    <>
                      <div className="section-heading">
                        <div>
                          <h2>Your research groups</h2>
                          <p>
                            {clusteringResult.totalPapers} papers were placed
                            into {clusteringResult.actualClusters} groups.
                          </p>
                        </div>
                      </div>

                      <div className="cluster-grid">
                        {(clusteringResult.clusters || []).map((cluster) => (
                          <section
                            className="panel cluster-card"
                            key={cluster.clusterId}
                          >
                            <div className="cluster-header">
                              <span className="cluster-number">
                                Group {cluster.clusterId}
                              </span>
                              <span className="cluster-count">
                                {cluster.totalPapers} papers
                              </span>
                            </div>
                            <h3>{cluster.label}</h3>
                            <span className="field-caption">Important terms</span>
                            <TagList items={cluster.importantTerms || []} />
                            <div className="cluster-paper-list">
                              {cluster.papers?.map((paper) => (
                                <div className="cluster-paper" key={paper.paperId}>
                                  <span className="paper-icon">▧</span>
                                  <div>
                                    <strong>{paper.title}</strong>
                                    <small>
                                      Distance from group centre: {paper.distanceFromCenter}
                                    </small>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    </>
                  ) : (
                    <AnalysisPlaceholder
                      icon="◈"
                      title="Your research groups will appear here"
                      description="Choose the number of groups and select Group my papers to begin."
                    />
                  )}
                </>
              )}

              {/* RECOMMENDATIONS */}
              {activeTab === "recommendations" && (
                <>
                  <section className="page-intro">
                    <div>
                      <span className="eyebrow">SEMANTIC DISCOVERY</span>
                      <h2>Discover your next relevant paper.</h2>
                      <p>
                        Choose a reference paper and let Sentence-BERT identify
                        other research with related meaning.
                      </p>
                    </div>
                    <span className="page-intro-icon">✧</span>
                  </section>

                  <section className="panel analysis-control">
                    <div className="panel-heading">
                      <div>
                        <h2>Find related research</h2>
                        <p>Choose a paper as the starting point.</p>
                      </div>
                      <span className="step-number">01</span>
                    </div>

                    {papers.length < 2 ? (
                      <EmptyState
                        title="Add more research papers"
                        description="At least two papers are required for recommendations."
                      />
                    ) : (
                      <div className="recommendation-form">
                        <Field label="Reference paper">
                          <select
                            value={recommendationPaperId}
                            onChange={(e) => setRecommendationPaperId(e.target.value)}
                          >
                            <option value="">Choose a research paper</option>
                            {papers.map((paper) => (
                              <option key={getId(paper)} value={getId(paper)}>
                                {paper.title}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <Field label="Number of results">
                          <select
                            value={topK}
                            onChange={(e) => setTopK(Number(e.target.value))}
                          >
                            {[1, 3, 5, 10, 15, 20].map((number) => (
                              <option key={number} value={number}>
                                Top {number}
                              </option>
                            ))}
                          </select>
                        </Field>

                        <button
                          className="btn btn-primary"
                          onClick={runRecommendations}
                          disabled={loading || !recommendationPaperId}
                        >
                          {loading ? "Searching..." : "Find related papers"}
                        </button>
                      </div>
                    )}
                  </section>

                  {recommendationResult && (
                    <section className="panel recommendations-results">
                      <div className="panel-heading">
                        <div>
                          <span className="eyebrow">YOUR RESULTS</span>
                          <h2>Related research papers</h2>
                          <p>
                            Based on <strong>{recommendationResult.targetPaper?.title}</strong>
                          </p>
                        </div>
                        <span className="success-icon">✧</span>
                      </div>

                      {recommendationResult.recommendations?.length ? (
                        recommendationResult.recommendations.map((paper, index) => (
                          <div className="recommendation-item" key={paper.paperId}>
                            <div className="recommendation-rank">{index + 1}</div>
                            <div className="recommendation-info">
                              <strong>{paper.title}</strong>
                              <TagList
                                items={paper.matchingKeywords || []}
                                emptyText="No exact keyword matches"
                              />
                              <div className="similarity-progress">
                                <div
                                  className="similarity-progress-fill"
                                  style={{
                                    width: `${Math.max(
                                      0,
                                      Math.min(100, paper.similarityPercentage)
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                            <div className="recommendation-score">
                              <strong>
                                {Number(paper.similarityPercentage || 0).toFixed(2)}%
                              </strong>
                              <small>Similarity</small>
                            </div>
                          </div>
                        ))
                      ) : (
                        <EmptyState
                          title="No recommendations found"
                          description="No other papers were available to recommend."
                        />
                      )}
                    </section>
                  )}
                </>
              )}
            </>
          )}

          {pageLoading && (
            <div className="loading-message">
              <span className="spinner" />
              Loading your workspace...
            </div>
          )}
        </div>

        <footer className="app-footer">
          <span>ResearchAI</span>
          <span>Tools for smarter academic research</span>
        </footer>
      </main>

      {/* Full research paper details */}
      {viewingPaper && (
        <div className="paper-modal-backdrop" onClick={() => setViewingPaper(null)}>
          <section
            className="paper-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="paper-modal-title"
          >
            <div className="paper-modal-header">
              <div>
                <span className="eyebrow">RESEARCH PAPER DETAILS</span>
                <h2 id="paper-modal-title">{viewingPaper.title}</h2>
                <p className="muted">
                  {viewingPaper.publicationYear || "Year unavailable"} ·{" "}
                  {viewingPaper.venue || "Publication venue unavailable"}
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setViewingPaper(null)}
                aria-label="Close details"
              >
                ×
              </button>
            </div>

            <div className="paper-detail-grid">
              <Detail label="Authors">
                {viewingPaper.authors?.length
                  ? viewingPaper.authors.join(", ")
                  : "No authors recorded."}
              </Detail>
              <Detail label="DOI">{viewingPaper.doi || "Not provided."}</Detail>
              <Detail label="Abstract">
                {viewingPaper.abstract || "No abstract recorded."}
              </Detail>
              <Detail label="Keywords">
                <TagList
                  items={viewingPaper.keywords || []}
                  emptyText="No keywords recorded."
                />
              </Detail>
              <Detail label="PDF link">
                {viewingPaper.pdfUrl ? (
                  <a href={viewingPaper.pdfUrl} target="_blank" rel="noreferrer">
                    Open research paper PDF ↗
                  </a>
                ) : (
                  "No PDF link recorded."
                )}
              </Detail>
              <Detail label="Date added">{formatDate(viewingPaper.createdAt)}</Detail>
            </div>

            <div className="paper-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openEditPaper(viewingPaper)}
              >
                Edit paper
              </button>
              <button
                type="button"
                className="btn delete-button"
                disabled={loading}
                onClick={() => deletePaper(viewingPaper)}
              >
                Delete paper
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setViewingPaper(null)}
              >
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

// --------------------------------------------------
// Reusable components
// --------------------------------------------------

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function Alert({ type, message, onClose }) {
  return (
    <div className={`alert ${type === "error" ? "error-alert" : "success-alert"}`}>
      <span>{message}</span>
      {onClose && <button onClick={onClose}>×</button>}
    </div>
  );
}

function StatCard({ icon, label, value, tone }) {
  return (
    <div className="stat-card">
      <span className={`stat-icon ${tone}`}>{icon}</span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

function WorkflowCard({ number, icon, title, description, action, onClick }) {
  return (
    <button className="workflow-card" onClick={onClick}>
      <div className="workflow-card-top">
        <span className="workflow-number">{number}</span>
        <span className="workflow-icon">{icon}</span>
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      <span className="workflow-action">{action} →</span>
    </button>
  );
}

function PaperList({
  papers,
  onView,
  onEdit,
  onDelete,
  showControls = false,
  yearFilter = "all",
  setYearFilter,
  sortBy = "newest",
  setSortBy,
}) {
  const years = [
    ...new Set(papers.map((paper) => paper.publicationYear).filter(Boolean)),
  ].sort((a, b) => b - a);

  const visiblePapers = [...papers]
    .filter(
      (paper) =>
        yearFilter === "all" || String(paper.publicationYear || "") === yearFilter
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
        case "title-asc":
          return (a.title || "").localeCompare(b.title || "");
        case "title-desc":
          return (b.title || "").localeCompare(a.title || "");
        case "year-desc":
          return (b.publicationYear || 0) - (a.publicationYear || 0);
        case "year-asc":
          return (a.publicationYear || 0) - (b.publicationYear || 0);
        case "newest":
        default:
          return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      }
    });

  if (!papers?.length) {
    return (
      <EmptyState
        title="Your research library is empty"
        description="Add your first academic paper to start building your research collection."
      />
    );
  }

  return (
    <div>
      {showControls && (
        <div className="library-filter-bar">
          <div className="filter-count">
            Showing <strong>{visiblePapers.length}</strong> of{" "}
            <strong>{papers.length}</strong> papers
          </div>
          <div className="library-filters">
            <label>
              <span>Publication year</span>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
              >
                <option value="all">All years</option>
                {years.map((year) => (
                  <option key={year} value={String(year)}>
                    {year}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Sort by</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="newest">Recently added</option>
                <option value="oldest">Oldest added</option>
                <option value="title-asc">Title A–Z</option>
                <option value="title-desc">Title Z–A</option>
                <option value="year-desc">Newest publication</option>
                <option value="year-asc">Oldest publication</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {!visiblePapers.length ? (
        <EmptyState
          title="No papers match this filter"
          description="Change the search or publication-year filter to see your papers."
        />
      ) : (
        <div className="paper-list">
          {visiblePapers.map((paper) => (
            <article className="paper-card" key={getId(paper)}>
              <div className="paper-card-icon">▧</div>
              <div className="paper-card-content">
                <button
                  type="button"
                  className="paper-title-button"
                  onClick={() => onView(paper)}
                >
                  <h3>{paper.title}</h3>
                </button>

                <div className="paper-meta">
                  {paper.publicationYear || "Year unavailable"}
                  <span>·</span>
                  {paper.venue || "Publication venue unavailable"}
                  {paper.authors?.length > 0 && (
                    <>
                      <span>·</span>
                      {paper.authors.join(", ")}
                    </>
                  )}
                </div>

                {paper.abstract && (
                  <p className="paper-abstract">
                    {paper.abstract.length > 230
                      ? `${paper.abstract.slice(0, 230)}...`
                      : paper.abstract}
                  </p>
                )}

                <TagList items={(paper.keywords || []).slice(0, 6)} />

                <div className="paper-actions">
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onView(paper)}
                  >
                    View details
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => onEdit(paper)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-button delete-text-button"
                    onClick={() => onDelete(paper)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Detail({ label, children }) {
  return (
    <div className="paper-detail-item">
      <strong>{label}</strong>
      <div>{children}</div>
    </div>
  );
}

function EmptyState({ title, description }) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">▧</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function AnalysisPlaceholder({ icon, title, description }) {
  return (
    <div className="analysis-placeholder">
      <span className="placeholder-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

function TagList({ items, emptyText = "No keywords available." }) {
  if (!items?.length) {
    return <span className="empty-tags">{emptyText}</span>;
  }

  return (
    <div className="tag-list">
      {items.map((item) => (
        <span className="tag" key={item}>
          {item}
        </span>
      ))}
    </div>
  );
}

function ResultSection({ title, children }) {
  return (
    <div className="result-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function SimilarityRow({ item, algorithm }) {
  const percentage = Number(item.similarityPercentage || 0);

  return (
    <div className="similarity-row">
      <div className="similarity-names">
        <strong>{item.paperA?.title || "Paper A"}</strong>
        <span>compared with</span>
        <strong>{item.paperB?.title || "Paper B"}</strong>
      </div>
      <div className="similarity-value">
        <strong>{percentage.toFixed(2)}%</strong>
        <small>{algorithm}</small>
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div className="mini-stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;

