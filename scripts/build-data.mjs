import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "..");
const sourceDir = process.env.AVEI_SOURCE_DIR
  ? path.resolve(process.env.AVEI_SOURCE_DIR)
  : path.resolve(projectDir, "..", "PAMI_Audio-Visual_Survey");

const texPath = path.join(sourceDir, "main.tex");
const bibPath = path.join(sourceDir, "literature.bib");
const outputPath = path.join(projectDir, "data", "papers.json");
const reportPath = path.join(projectDir, "data", "build-report.json");

for (const requiredPath of [texPath, bibPath]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing source file: ${requiredPath}`);
  }
}

const texSource = fs.readFileSync(texPath, "utf8");
const bibSource = fs.readFileSync(bibPath, "utf8");

function stripTexComments(source) {
  return source
    .split(/\r?\n/)
    .map((line) => line.replace(/(?<!\\)%.*$/, ""))
    .join("\n");
}

function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function cleanLatex(value = "") {
  let result = value;
  const wrappers = [
    "textit",
    "textbf",
    "emph",
    "mathrm",
    "mathbf",
    "operatorname",
    "url",
  ];

  for (let pass = 0; pass < 4; pass += 1) {
    for (const command of wrappers) {
      result = result.replace(
        new RegExp(`\\\\${command}\\s*\\{([^{}]*)\\}`, "g"),
        "$1",
      );
    }
  }

  const latexCharacters = new Map([
    ["\\&", "&"],
    ["\\%", "%"],
    ["\\_", "_"],
    ["\\#", "#"],
    ["\\alpha", "α"],
    ["\\beta", "β"],
    ["\\pi", "π"],
    ["\\times", "×"],
  ]);

  for (const [token, replacement] of latexCharacters) {
    result = result.split(token).join(replacement);
  }

  result = result
    .replace(/\\["'`^~=.uvHckr]\s*\{?([A-Za-z])\}?/g, "$1")
    .replace(/\$([^$]+)\$/g, "$1")
    .replace(/[{}]/g, "")
    .replace(/~/g, " ")
    .replace(/---/g, "—")
    .replace(/--/g, "–")
    .replace(/\\,/g, "")
    .replace(/\\!/g, "")
    .replace(/\\\s+/g, " ");

  return normalizeSpace(result);
}

function parseBibEntries(source) {
  const entries = new Map();
  let cursor = 0;

  while (cursor < source.length) {
    const at = source.indexOf("@", cursor);
    if (at < 0) break;

    const open = source.indexOf("{", at);
    if (open < 0) break;

    const type = source.slice(at + 1, open).trim().toLowerCase();
    if (!/^[a-z]+$/.test(type)) {
      cursor = open + 1;
      continue;
    }

    let depth = 1;
    let quote = false;
    let close = open + 1;
    for (; close < source.length; close += 1) {
      const character = source[close];
      const previous = source[close - 1];
      if (character === '"' && previous !== "\\") quote = !quote;
      if (quote) continue;
      if (character === "{") depth += 1;
      if (character === "}") depth -= 1;
      if (depth === 0) break;
    }

    const block = source.slice(open + 1, close);
    const firstComma = block.indexOf(",");
    if (firstComma < 0) {
      cursor = close + 1;
      continue;
    }

    const key = block.slice(0, firstComma).trim();
    const body = block.slice(firstComma + 1);
    const fields = {};
    let index = 0;

    while (index < body.length) {
      while (index < body.length && /[\s,]/.test(body[index])) index += 1;
      const nameStart = index;
      while (index < body.length && /[A-Za-z0-9_-]/.test(body[index])) index += 1;
      const name = body.slice(nameStart, index).trim().toLowerCase();
      while (index < body.length && /\s/.test(body[index])) index += 1;
      if (!name || body[index] !== "=") {
        index += 1;
        continue;
      }
      index += 1;
      while (index < body.length && /\s/.test(body[index])) index += 1;

      let value = "";
      if (body[index] === "{") {
        const valueStart = index + 1;
        let valueDepth = 1;
        index += 1;
        while (index < body.length && valueDepth > 0) {
          if (body[index] === "{" && body[index - 1] !== "\\") valueDepth += 1;
          if (body[index] === "}" && body[index - 1] !== "\\") valueDepth -= 1;
          index += 1;
        }
        value = body.slice(valueStart, index - 1);
      } else if (body[index] === '"') {
        const valueStart = index + 1;
        index += 1;
        while (index < body.length) {
          if (body[index] === '"' && body[index - 1] !== "\\") break;
          index += 1;
        }
        value = body.slice(valueStart, index);
        index += 1;
      } else {
        const valueStart = index;
        while (index < body.length && body[index] !== ",") index += 1;
        value = body.slice(valueStart, index).trim();
      }

      fields[name] = value.trim();
    }

    entries.set(key, { id: key, type, fields });
    cursor = close + 1;
  }

  return entries;
}

function categoryFor(section, subsection) {
  if (["Perception", "Reasoning", "Interaction"].includes(section)) {
    return { category: section, subcategory: subsection || "Overview" };
  }

  if (section === "Further Discussion and Future Directions") {
    return { category: "Future Directions", subcategory: subsection || "Discussion" };
  }

  if (section === "Background") {
    return { category: "Foundations", subcategory: subsection || "Background" };
  }

  if (section === "Introduction") {
    return { category: "Foundations", subcategory: "Related Work" };
  }

  if (subsection === "More Benchmark") {
    return { category: "Resources", subcategory: "Benchmarks" };
  }

  return { category: "Resources", subcategory: subsection || section || "Other" };
}

function parseCitations(source) {
  const lines = stripTexComments(source).split(/\r?\n/);
  const categoryMap = new Map();
  const order = [];
  let section = "Introduction";
  let subsection = "";

  for (const line of lines) {
    const sectionMatch = line.match(/^\s*\\section\{([^}]+)\}/);
    const subsectionMatch = line.match(/^\s*\\subsection\{([^}]+)\}/);
    if (sectionMatch) {
      section = cleanLatex(sectionMatch[1]);
      subsection = "";
    }
    if (subsectionMatch) subsection = cleanLatex(subsectionMatch[1]);

    for (const match of line.matchAll(/\\cite[a-zA-Z]*\{([^}]+)\}/g)) {
      for (const rawKey of match[1].split(",")) {
        const key = rawKey.trim();
        if (!key) continue;
        if (!categoryMap.has(key)) {
          categoryMap.set(key, []);
          order.push(key);
        }
        const category = categoryFor(section, subsection);
        const categories = categoryMap.get(key);
        if (
          !categories.some(
            (item) =>
              item.category === category.category &&
              item.subcategory === category.subcategory,
          )
        ) {
          categories.push(category);
        }
      }
    }
  }

  return { categoryMap, order };
}

function inferArxivId(fields) {
  const candidates = [
    fields.eprint,
    fields.journal,
    fields.booktitle,
    fields.note,
    fields.url,
  ].filter(Boolean);
  for (const candidate of candidates) {
    const match = candidate.match(/(?:arXiv:?\s*|arxiv\.org\/(?:abs|pdf)\/)(\d{4}\.\d{4,5})(?:v\d+)?/i);
    if (match) return match[1];
  }
  return "";
}

function authorList(value = "") {
  return value
    .split(/\s+and\s+/i)
    .map(cleanLatex)
    .filter(Boolean);
}

const bibEntries = parseBibEntries(bibSource);
const { categoryMap, order } = parseCitations(texSource);
const missingKeys = order.filter((key) => !bibEntries.has(key));
const unusedKeys = [...bibEntries.keys()].filter((key) => !categoryMap.has(key));

const papers = order
  .filter((key) => bibEntries.has(key))
  .map((key, citationOrder) => {
    const entry = bibEntries.get(key);
    const fields = entry.fields;
    const title = cleanLatex(fields.title || key);
    const authors = authorList(fields.author || "");
    const year = Number.parseInt(cleanLatex(fields.year || "0"), 10) || null;
    const venue = cleanLatex(fields.booktitle || fields.journal || fields.publisher || "");
    const doi = cleanLatex(fields.doi || "");
    const arxivId = inferArxivId(fields);
    const explicitUrl = cleanLatex(fields.url || "");
    const url = explicitUrl || (doi ? `https://doi.org/${doi}` : arxivId ? `https://arxiv.org/abs/${arxivId}` : "");
    const categories = categoryMap.get(key) || [];

    return {
      id: key,
      type: entry.type,
      title,
      authors,
      year,
      venue,
      doi,
      arxivId,
      url,
      abstract: cleanLatex(fields.abstract || ""),
      categories,
      citationOrder: citationOrder + 1,
    };
  })
  .sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return a.title.localeCompare(b.title, "en");
  });

const categoryCounts = {};
for (const paper of papers) {
  for (const category of paper.categories) {
    categoryCounts[category.category] = (categoryCounts[category.category] || 0) + 1;
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    bibliography: "literature.bib",
    manuscript: "main.tex",
  },
  papers,
};

const report = {
  bibliographyEntries: bibEntries.size,
  activeCitationKeys: order.length,
  generatedPapers: papers.length,
  missingCitationKeys: missingKeys,
  unusedBibliographyKeys: unusedKeys,
  categoryCounts,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

if (papers.length < 300) {
  throw new Error(`Expected at least 300 resolved papers, generated ${papers.length}.`);
}

console.log(`Generated ${papers.length} papers from ${order.length} active citation keys.`);
console.log(`Missing citation keys: ${missingKeys.join(", ") || "none"}`);
console.log(`Output: ${outputPath}`);
