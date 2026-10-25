const DATA_PATHS = {
  site: "data/site.json",
  taxonomy: "data/taxonomy.json",
  papers: "data/papers.json",
  benchmarks: "data/benchmarks.json",
};

const PAGE_SIZE = 24;
const CATEGORY_ORDER = [
  "All",
  "Perception",
  "Reasoning",
  "Interaction",
  "Foundations",
  "Resources",
  "Future Directions",
];

const state = {
  papers: [],
  benchmarks: [],
  category: "All",
  subcategory: "All",
  query: "",
  sort: "year-desc",
  visiblePapers: PAGE_SIZE,
  benchmarkCategory: "All",
  benchmarkQuery: "",
};

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function normalize(value) {
  return String(value || "").toLocaleLowerCase().normalize("NFKD");
}

function slug(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function safeHref(value, allowRelative = false) {
  if (!value) return "";
  if (allowRelative && !/^[a-z]+:/i.test(value)) return value;
  try {
    const url = new URL(value, window.location.href);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return response.json();
}

function setText(id, value) {
  const target = document.getElementById(id);
  if (target && value) target.textContent = value;
}

function formatPersonName(name) {
  if (!name.includes(",")) return name;
  const [family, ...given] = name.split(",").map((part) => part.trim());
  return `${given.join(" ")} ${family}`.trim();
}

function formatAuthors(authors) {
  const names = authors.map(formatPersonName);
  if (names.length <= 3) return names.join(", ");
  return `${names.slice(0, 3).join(", ")} et al.`;
}

function renderSite(site) {
  document.title = `${site.title} · ${site.projectName}`;
  setText("siteEyebrow", site.eyebrow);
  setText("siteTitle", site.title);
  setText("siteDescription", site.description);
  setText("supportText", site.support);
  setText("citationStatus", `${site.citation.status}; update after public release.`);
  setText("citationText", site.citation.bibtex);
  setText("currentYear", new Date().getFullYear());

  const authors = document.getElementById("heroAuthors");
  authors.replaceChildren();
  site.authors.forEach((person) => {
    const wrapper = person.url ? el("a", "author") : el("span", "author");
    if (person.url) {
      wrapper.href = safeHref(person.url);
      wrapper.target = "_blank";
      wrapper.rel = "noreferrer";
    }
    wrapper.append(document.createTextNode(person.name));
    const affiliations = el("sup", "", person.affiliations.join(","));
    if (person.corresponding) affiliations.append(document.createTextNode(" ✦"));
    wrapper.append(affiliations);
    authors.append(wrapper);
  });

  const affiliations = document.getElementById("heroAffiliations");
  affiliations.replaceChildren();
  site.affiliations.forEach((affiliation) => {
    const row = el("div", "affiliation");
    row.append(el("span", "", affiliation.id), el("div", "", affiliation.name));
    affiliations.append(row);
  });

  const keywords = document.getElementById("keywordRow");
  keywords.replaceChildren(...site.keywords.map((keyword) => el("span", "", keyword)));

  const abstract = document.getElementById("abstractCopy");
  abstract.replaceChildren(...site.abstract.map((paragraph) => el("p", "", paragraph)));

  const actions = [
    ["github", "GitHub ↗"],
    ["pdf", "Read paper ↓"],
    ["arxiv", "arXiv ↗"],
    ["rednote", "Rednote ↗"],
  ];
  const actionRoot = document.getElementById("heroActions");
  actionRoot.replaceChildren();
  actions.forEach(([key, label]) => {
    const href = safeHref(site.links[key], key === "pdf");
    if (!href) return;
    const link = el("a", "", label);
    link.href = href;
    if (key !== "pdf") {
      link.target = "_blank";
      link.rel = "noreferrer";
    }
    actionRoot.append(link);
  });

  const email = document.getElementById("contactEmail");
  if (site.contact?.email) {
    email.textContent = site.contact.email;
    email.href = `mailto:${site.contact.email}`;
  }
}

function paperCountsByCategory() {
  const counts = new Map();
  state.papers.forEach((paper) => {
    new Set(paper.categories.map((item) => item.category)).forEach((category) => {
      counts.set(category, (counts.get(category) || 0) + 1);
    });
  });
  return counts;
}

function renderTaxonomy(taxonomy) {
  const tabs = document.getElementById("taxonomyTabs");
  const panel = document.getElementById("taxonomyPanel");
  const counts = paperCountsByCategory();
  let selectedIndex = 0;

  function activate(index, focus = false) {
    selectedIndex = index;
    [...tabs.children].forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    const dimension = taxonomy.dimensions[index];
    panel.setAttribute("aria-labelledby", `taxonomy-tab-${dimension.id}`);
    panel.replaceChildren();

    const head = el("div", "taxonomy-panel-head");
    const titleWrap = el("div");
    const question = el("h3", "", dimension.question);
    const count = el("p", "", `${counts.get(dimension.name) || 0} literature links in the current manuscript`);
    titleWrap.append(question, count);
    head.append(titleWrap, el("p", "", dimension.summary));

    const groups = el("div", "taxonomy-groups");
    dimension.groups.forEach((group) => {
      const groupElement = el("section", `taxonomy-group ${dimension.accent}`);
      const list = el("ul");
      group.items.forEach((item) => list.append(el("li", "", item)));
      groupElement.append(el("h4", "", group.name), list);
      groups.append(groupElement);
    });
    panel.append(head, groups);
    if (focus) tabs.children[index].focus();
  }

  tabs.replaceChildren();
  taxonomy.dimensions.forEach((dimension, index) => {
    const tab = el("button", "taxonomy-tab");
    tab.type = "button";
    tab.id = `taxonomy-tab-${dimension.id}`;
    tab.role = "tab";
    tab.dataset.accent = dimension.accent;
    tab.append(el("span", "", `0${index + 1} / ${counts.get(dimension.name) || 0} links`), el("strong", "", dimension.name));
    tab.addEventListener("click", () => activate(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") selectedIndex = 0;
      else if (event.key === "End") selectedIndex = taxonomy.dimensions.length - 1;
      else if (event.key === "ArrowRight") selectedIndex = (selectedIndex + 1) % taxonomy.dimensions.length;
      else selectedIndex = (selectedIndex - 1 + taxonomy.dimensions.length) % taxonomy.dimensions.length;
      activate(selectedIndex, true);
    });
    tabs.append(tab);
  });
  activate(0);
}

function readPaperStateFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get("q");
  const category = params.get("category");
  const subcategory = params.get("subcategory");
  const sort = params.get("sort");
  if (q) state.query = q;
  if (category && CATEGORY_ORDER.includes(category)) state.category = category;
  if (subcategory) state.subcategory = subcategory;
  if (["year-desc", "year-asc", "title-asc", "citation"].includes(sort)) state.sort = sort;
}

function syncPaperUrl() {
  const url = new URL(window.location.href);
  const values = {
    q: state.query,
    category: state.category === "All" ? "" : state.category,
    subcategory: state.subcategory === "All" ? "" : state.subcategory,
    sort: state.sort === "year-desc" ? "" : state.sort,
  };
  Object.entries(values).forEach(([key, value]) => value ? url.searchParams.set(key, value) : url.searchParams.delete(key));
  window.history.replaceState({}, "", url);
}

function availableSubcategories(category) {
  if (category === "All") return [];
  return [...new Set(
    state.papers.flatMap((paper) => paper.categories)
      .filter((item) => item.category === category)
      .map((item) => item.subcategory),
  )].sort((a, b) => a.localeCompare(b));
}

function paperMatches(paper) {
  const categoryMatch = state.category === "All" || paper.categories.some((item) => item.category === state.category);
  const subcategoryMatch = state.subcategory === "All" || paper.categories.some((item) => item.category === state.category && item.subcategory === state.subcategory);
  const searchable = normalize([
    paper.title,
    paper.authors.join(" "),
    paper.venue,
    paper.year,
    paper.categories.map((item) => `${item.category} ${item.subcategory}`).join(" "),
  ].join(" "));
  return categoryMatch && subcategoryMatch && (!state.query || searchable.includes(normalize(state.query)));
}

function sortedFilteredPapers() {
  const papers = state.papers.filter(paperMatches);
  return papers.sort((a, b) => {
    if (state.sort === "year-asc") return (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title);
    if (state.sort === "title-asc") return a.title.localeCompare(b.title);
    if (state.sort === "citation") return a.citationOrder - b.citationOrder;
    return (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title);
  });
}

function makePaperRow(paper) {
  const row = el("article", "paper-row");
  row.role = "row";

  const main = el("div", "paper-cell-main");
  main.role = "cell";
  const title = el("h3", "paper-title");
  const titleButton = el("button", "paper-title-button", paper.title);
  titleButton.type = "button";
  titleButton.addEventListener("click", () => openPaperDialog(paper));
  title.append(titleButton);
  main.append(title, el("p", "paper-authors", formatAuthors(paper.authors)));

  const meta = el("div", "paper-cell-meta");
  meta.role = "cell";
  meta.append(el("span", "paper-year", paper.year || "n.d."), el("span", "paper-venue", paper.venue || "Venue not listed"));

  const tags = el("div", "paper-tags paper-cell-tags");
  tags.role = "cell";
  const uniqueTags = [];
  paper.categories.forEach((item) => {
    const key = `${item.category}|${item.subcategory}`;
    if (!uniqueTags.some((tag) => tag.key === key)) uniqueTags.push({ key, ...item });
  });
  uniqueTags.slice(0, 4).forEach((tag) => {
    const label = tag.subcategory === "Overview" ? tag.category : tag.subcategory;
    const chip = el("span", `paper-tag ${slug(tag.category)}`, label);
    chip.title = tag.category;
    tags.append(chip);
  });
  if (uniqueTags.length > 4) tags.append(el("span", "paper-tag", `+${uniqueTags.length - 4}`));

  const source = el("div", "paper-source");
  source.role = "cell";
  const href = safeHref(paper.url);
  if (href) {
    const link = el("a", "", "↗");
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.setAttribute("aria-label", `Open ${paper.title}`);
    source.append(link);
  } else {
    source.append(el("span", "", "—"));
  }

  row.append(main, meta, tags, source);
  return row;
}

function openPaperDialog(paper) {
  const dialog = document.getElementById("paperDialog");
  setText("paperDialogOrder", `Manuscript citation ${String(paper.citationOrder).padStart(3, "0")}`);
  setText("paperDialogYear", paper.year || "Year not listed");
  setText("paperDialogTitle", paper.title);
  setText("paperDialogAuthors", paper.authors.map(formatPersonName).join(", ") || "Authors not listed");
  setText("paperDialogVenue", paper.venue || "Venue not listed in the local bibliography");
  setText("paperDialogAbstract", paper.abstract || "An abstract is not available in the local bibliography. Use the source link below for the complete paper record.");

  const tags = document.getElementById("paperDialogTags");
  tags.replaceChildren();
  paper.categories.forEach((item) => {
    tags.append(el("span", `paper-tag ${slug(item.category)}`, `${item.category} · ${item.subcategory}`));
  });

  const actions = document.getElementById("paperDialogActions");
  actions.replaceChildren();
  const links = [];
  if (paper.url) links.push([paper.url, "Open source ↗"]);
  if (paper.doi) links.push([`https://doi.org/${paper.doi}`, "DOI ↗"]);
  if (paper.arxivId) links.push([`https://arxiv.org/abs/${paper.arxivId}`, "arXiv ↗"]);
  const seen = new Set();
  links.forEach(([rawHref, label]) => {
    const href = safeHref(rawHref);
    if (!href || seen.has(href)) return;
    seen.add(href);
    const link = el("a", "", label);
    link.href = href;
    link.target = "_blank";
    link.rel = "noreferrer";
    actions.append(link);
  });
  dialog.showModal();
}

function renderSubcategoryFilters() {
  const root = document.getElementById("subcategoryFilter");
  const subcategories = availableSubcategories(state.category);
  if (!subcategories.includes(state.subcategory)) state.subcategory = "All";
  root.hidden = subcategories.length === 0;
  root.replaceChildren();
  if (!subcategories.length) return;
  ["All", ...subcategories].forEach((subcategory) => {
    const button = el("button", `filter-button${subcategory === state.subcategory ? " is-active" : ""}`, subcategory);
    button.type = "button";
    button.dataset.value = subcategory;
    button.addEventListener("click", () => {
      state.subcategory = subcategory;
      state.visiblePapers = PAGE_SIZE;
      renderPaperExplorer();
    });
    root.append(button);
  });
}

function renderPaperExplorer() {
  renderSubcategoryFilters();
  const papers = sortedFilteredPapers();
  const visible = papers.slice(0, state.visiblePapers);
  const list = document.getElementById("paperList");
  list.replaceChildren();
  if (!visible.length) {
    const empty = el("div", "empty-results");
    empty.append(el("strong", "", "No papers match this view."), el("span", "", "Try another keyword or clear the active filters."));
    list.append(empty);
  } else {
    const fragment = document.createDocumentFragment();
    visible.forEach((paper) => fragment.append(makePaperRow(paper)));
    list.append(fragment);
  }

  document.querySelectorAll("#categoryFilter .filter-button").forEach((button) => {
    button.classList.toggle("is-active", button.dataset.value === state.category);
  });
  document.getElementById("paperSearch").value = state.query;
  document.getElementById("paperSort").value = state.sort;
  document.getElementById("paperResultSummary").textContent = papers.length
    ? `Showing ${Math.min(visible.length, papers.length)} of ${papers.length} matching papers`
    : "No matching papers";
  document.querySelector(".load-more-wrap").hidden = visible.length >= papers.length;
  syncPaperUrl();
}

function initPaperExplorer(payload) {
  state.papers = payload.papers;
  readPaperStateFromUrl();
  const years = state.papers.map((paper) => paper.year).filter(Number.isFinite);
  const categoryLinks = state.papers.reduce((total, paper) => total + paper.categories.length, 0);
  setText("paperCount", state.papers.length.toLocaleString("en-US"));
  setText("paperYearRange", `${Math.min(...years)}—${Math.max(...years)}`);
  setText("categoryLinkCount", categoryLinks.toLocaleString("en-US"));
  const generated = new Date(payload.generatedAt);
  setText("dataTimestamp", `Built from manuscript · ${generated.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`);

  const counts = paperCountsByCategory();
  const filterRoot = document.getElementById("categoryFilter");
  filterRoot.replaceChildren();
  CATEGORY_ORDER.forEach((category) => {
    if (category !== "All" && !counts.has(category)) return;
    const label = category === "All" ? `All · ${state.papers.length}` : `${category} · ${counts.get(category)}`;
    const button = el("button", "filter-button", label);
    button.type = "button";
    button.dataset.value = category;
    button.addEventListener("click", () => {
      state.category = category;
      state.subcategory = "All";
      state.visiblePapers = PAGE_SIZE;
      renderPaperExplorer();
    });
    filterRoot.append(button);
  });

  let debounce;
  document.getElementById("paperSearch").addEventListener("input", (event) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      state.query = event.target.value.trim();
      state.visiblePapers = PAGE_SIZE;
      renderPaperExplorer();
    }, 120);
  });
  document.getElementById("paperSort").addEventListener("change", (event) => {
    state.sort = event.target.value;
    renderPaperExplorer();
  });
  document.getElementById("loadMorePapers").addEventListener("click", () => {
    state.visiblePapers += PAGE_SIZE;
    renderPaperExplorer();
  });
  document.getElementById("clearPaperFilters").addEventListener("click", () => {
    Object.assign(state, { category: "All", subcategory: "All", query: "", sort: "year-desc", visiblePapers: PAGE_SIZE });
    renderPaperExplorer();
    document.getElementById("paperSearch").focus();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      document.getElementById("paperSearch").focus();
    }
  });
  renderPaperExplorer();
}

function renderBenchmarks(paperById) {
  const root = document.getElementById("benchmarkGrid");
  const query = normalize(state.benchmarkQuery);
  const matches = state.benchmarks.filter((benchmark) => {
    const categoryMatch = state.benchmarkCategory === "All" || benchmark.category === state.benchmarkCategory;
    const text = normalize(`${benchmark.name} ${benchmark.task} ${benchmark.scale} ${benchmark.annotation}`);
    return categoryMatch && (!query || text.includes(query));
  });
  root.replaceChildren();
  matches.forEach((benchmark) => {
    const card = el("article", "benchmark-card");
    const marker = el("span", `benchmark-marker ${slug(benchmark.category)}`);
    const header = el("header");
    const year = el("time", "", benchmark.year);
    year.dateTime = String(benchmark.year);
    header.append(el("h3", "", benchmark.name), year);
    const data = el("dl");
    [["Scale", benchmark.scale], ["Annotation", benchmark.annotation]].forEach(([term, value]) => {
      const row = el("div");
      row.append(el("dt", "", term), el("dd", "", value));
      data.append(row);
    });
    card.append(marker, header, el("p", "", benchmark.task), data);
    const sourcePaper = paperById.get(benchmark.citationKey);
    const href = safeHref(sourcePaper?.url);
    if (href) {
      const link = el("a", "benchmark-source", "Open source ↗");
      link.href = href;
      link.target = "_blank";
      link.rel = "noreferrer";
      card.append(link);
    }
    root.append(card);
  });
  if (!matches.length) {
    const empty = el("div", "empty-results");
    empty.append(el("strong", "", "No benchmarks match."), el("span", "", "Change the capability or search term."));
    root.append(empty);
  }
}

function initBenchmarks(payload) {
  state.benchmarks = payload.benchmarks;
  const categories = ["All", ...new Set(state.benchmarks.map((item) => item.category))];
  const controls = document.getElementById("benchmarkFilter");
  const paperById = new Map(state.papers.map((paper) => [paper.id, paper]));
  categories.forEach((category) => {
    const button = el("button", category === "All" ? "is-active" : "", category);
    button.type = "button";
    button.addEventListener("click", () => {
      state.benchmarkCategory = category;
      [...controls.children].forEach((item) => item.classList.toggle("is-active", item === button));
      renderBenchmarks(paperById);
    });
    controls.append(button);
  });
  document.getElementById("benchmarkSearch").addEventListener("input", (event) => {
    state.benchmarkQuery = event.target.value.trim();
    renderBenchmarks(paperById);
  });
  renderBenchmarks(paperById);
}

function initNavigation() {
  const header = document.querySelector("[data-header]");
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.getElementById("site-nav");
  const close = () => {
    toggle.setAttribute("aria-expanded", "false");
    nav.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  };
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    nav.classList.toggle("is-open", open);
    document.body.classList.toggle("nav-open", open);
  });
  nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", close));
  window.addEventListener("scroll", () => header.classList.toggle("is-scrolled", window.scrollY > 16), { passive: true });

  const sections = [...document.querySelectorAll("main section[id]")];
  const navLinks = [...nav.querySelectorAll("a")];
  const observer = new IntersectionObserver((entries) => {
    const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (!visible) return;
    navLinks.forEach((link) => link.setAttribute("aria-current", String(link.hash === `#${visible.target.id}`)));
  }, { rootMargin: "-20% 0px -70%", threshold: [0, 0.1, 0.5] });
  sections.forEach((section) => observer.observe(section));
}

function initLightbox() {
  const dialog = document.getElementById("figureLightbox");
  const image = dialog.querySelector("img");
  const caption = dialog.querySelector("p");
  document.querySelectorAll("[data-lightbox]").forEach((button) => {
    button.addEventListener("click", () => {
      image.src = button.dataset.lightbox;
      image.alt = button.querySelector("img")?.alt || "Expanded survey figure";
      caption.textContent = button.dataset.caption || "";
      dialog.showModal();
    });
  });
  dialog.querySelector(".lightbox-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function initPaperDialog() {
  const dialog = document.getElementById("paperDialog");
  dialog.querySelector(".paper-dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function initCopy() {
  const button = document.getElementById("copyCitation");
  button.addEventListener("click", async () => {
    const citation = document.getElementById("citationText").textContent;
    try {
      await navigator.clipboard.writeText(citation);
      button.textContent = "Copied";
    } catch {
      const range = document.createRange();
      range.selectNodeContents(document.getElementById("citationText"));
      window.getSelection().removeAllRanges();
      window.getSelection().addRange(range);
      button.textContent = "Selected — press Ctrl+C";
    }
    setTimeout(() => { button.textContent = "Copy BibTeX"; }, 2200);
  });
}

function initReveals() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const elements = document.querySelectorAll(".reveal");
  if (reducedMotion || !("IntersectionObserver" in window)) {
    elements.forEach((element) => element.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8%", threshold: 0.01 });
  elements.forEach((element) => observer.observe(element));
}

async function boot() {
  initNavigation();
  initLightbox();
  initPaperDialog();
  initCopy();
  try {
    const [site, taxonomy, paperPayload, benchmarkPayload] = await Promise.all([
      fetchJson(DATA_PATHS.site),
      fetchJson(DATA_PATHS.taxonomy),
      fetchJson(DATA_PATHS.papers),
      fetchJson(DATA_PATHS.benchmarks),
    ]);
    renderSite(site);
    initPaperExplorer(paperPayload);
    renderTaxonomy(taxonomy);
    initBenchmarks(benchmarkPayload);
  } catch (error) {
    console.error(error);
    document.getElementById("paperResultSummary").textContent = "The local data files could not be loaded. Serve this folder over HTTP and refresh.";
  } finally {
    initReveals();
  }
}

boot();
