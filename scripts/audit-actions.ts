import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const srcRoot = path.join(root, "src");
const outputPath = path.join(root, "docs", "ACTION-MANIFEST.md");
const strict = process.argv.includes("--strict");
const check = process.argv.includes("--check") || strict;

const interactiveTags = new Set(["button", "a", "Link", "input", "select", "textarea", "summary"]);

function listFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(absolute);
    return /\.(tsx|jsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function attribute(node: ts.JsxOpeningLikeElement, name: string): ts.JsxAttribute | undefined {
  return node.attributes.properties.find(
    (item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText() === name,
  );
}

function attributeValue(item: ts.JsxAttribute | undefined, source: ts.SourceFile): string | null {
  if (!item?.initializer) return item ? "true" : null;
  if (ts.isStringLiteral(item.initializer)) return item.initializer.text;
  if (ts.isJsxExpression(item.initializer) && item.initializer.expression) {
    const expression = item.initializer.expression;
    if (ts.isStringLiteral(expression) || ts.isNoSubstitutionTemplateLiteral(expression)) return expression.text;
    return expression.getText(source).replaceAll("|", "\\|");
  }
  return item.initializer.getText(source).replaceAll("|", "\\|");
}

function childLabel(parent: ts.JsxElement | undefined, source: ts.SourceFile): string {
  if (!parent) return "Unlabeled control";
  const parts: string[] = [];
  for (const child of parent.children) {
    if (ts.isJsxText(child)) {
      const value = child.text.replace(/\s+/g, " ").trim();
      if (value) parts.push(value);
    } else if (ts.isJsxExpression(child) && child.expression) {
      const value = child.expression.getText(source);
      if (/^[\w.]+$/.test(value)) parts.push(`{${value}}`);
    }
  }
  return parts.join(" ").slice(0, 120) || "Icon or computed label";
}

function classifySharedState(text: string): string {
  const states: string[] = [];
  if (/useQuery|queryClient|invalidateQueries/.test(text)) states.push("React Query");
  if (/useUserConnections|profileState/.test(text)) states.push("Profile connection state");
  if (/useSpendableUsd|capitalState/.test(text)) states.push("Capital/wallet state");
  if (/localStorage/.test(text)) states.push("localStorage");
  return states.join(", ") || "Component/server state";
}

const registryText = fs.readFileSync(path.join(srcRoot, "lib", "actions", "types.ts"), "utf8");
const registeredIds = new Set(
  [...registryText.matchAll(/^\s+"([a-z][a-z0-9_.]+)",$/gm)].map((match) => match[1]),
);

type Row = {
  file: string;
  line: number;
  control: string;
  label: string;
  actionId: string;
  execution: string;
  destination: string;
  server: string;
  database: string;
  sharedState: string;
  lifecycle: string;
  disabled: string;
};

const rows: Row[] = [];
const deadPatterns: Array<{ file: string; line: number; pattern: string }> = [];

for (const absolute of listFiles(srcRoot)) {
  const text = fs.readFileSync(absolute, "utf8");
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  const source = ts.createSourceFile(absolute, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const endpoints = [...new Set([...text.matchAll(/["'`](\/api\/[^"'`?\s${}]*)/g)].map((match) => match[1]))];
  const sharedState = classifySharedState(text);
  const database = /prisma\.|@\/lib\/db/.test(text) ? "Direct Prisma" : endpoints.length ? "Via API" : "None visible";
  const lifecycle = [
    /isLoading|loading|busy|pending|isFetching/i.test(text) ? "pending" : null,
    /toast\.success|confirmed|success/i.test(text) ? "success" : null,
    /toast\.(error|message)|catch\s*\(|error/i.test(text) ? "error" : null,
  ].filter(Boolean).join("/") || "none detected";

  for (const match of text.matchAll(/href\s*=\s*["']#["']|console\.log\s*\(|TODO|FIXME|onClick\s*=\s*\{\s*\(\)\s*=>\s*\{?\s*\}?\s*\}/g)) {
    deadPatterns.push({
      file: relative,
      line: text.slice(0, match.index).split("\n").length,
      pattern: match[0].replaceAll("|", "\\|"),
    });
  }

  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source);
      const hasOnClick = Boolean(attribute(node, "onClick"));
      const hasOnSubmit = Boolean(attribute(node, "onSubmit"));
      const hasHref = Boolean(attribute(node, "href"));
      if (interactiveTags.has(tag) || hasOnClick || hasOnSubmit || hasHref) {
        const parent = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) ? node.parent : undefined;
        const label =
          attributeValue(attribute(node, "aria-label"), source) ??
          attributeValue(attribute(node, "title"), source) ??
          attributeValue(attribute(node, "placeholder"), source) ??
          childLabel(parent, source);
        const actionAttribute = attribute(node, "data-action-id");
        const rawActionId = attributeValue(actionAttribute, source);
        const actionId = actionAttribute?.initializer && ts.isJsxExpression(actionAttribute.initializer)
          && actionAttribute.initializer.expression
          && !ts.isStringLiteral(actionAttribute.initializer.expression)
          && !ts.isNoSubstitutionTemplateLiteral(actionAttribute.initializer.expression)
          ? `DYNAMIC:${rawActionId}`
          : rawActionId ?? "UNREGISTERED";
        const href = attributeValue(attribute(node, "href"), source);
        const onClick = attributeValue(attribute(node, "onClick"), source);
        const onSubmit = attributeValue(attribute(node, "onSubmit"), source);
        const disabled = attributeValue(attribute(node, "disabled"), source);
        const position = source.getLineAndCharacterOfPosition(node.getStart(source));
        rows.push({
          file: relative,
          line: position.line + 1,
          control: tag,
          label: label.replaceAll("|", "\\|"),
          actionId,
          execution: href ? "navigation" : onSubmit ? `submit: ${onSubmit}` : onClick ? `click: ${onClick}` : "form control",
          destination: href ?? "—",
          server: endpoints.join(", ") || "—",
          database,
          sharedState,
          lifecycle,
          disabled: disabled ?? "no",
        });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

const unknownIds = rows.filter(
  (row) => row.actionId !== "UNREGISTERED" && !row.actionId.startsWith("DYNAMIC:") && !registeredIds.has(row.actionId),
);
const unregistered = rows.filter((row) => row.actionId === "UNREGISTERED");
const generatedAt = new Date().toISOString();
const lines = [
  "# Action Manifest",
  "",
  `Generated by \`scripts/audit-actions.ts\` at ${generatedAt}. This is a repository-wide inventory, not a claim that every legacy control is production-complete.`,
  "",
  "## Audit summary",
  "",
  `- Visible interactive controls: ${rows.length}`,
  `- Controls with stable action IDs: ${rows.length - unregistered.length}`,
  `- Controls missing stable action IDs: ${unregistered.length}`,
  `- Unknown action IDs: ${unknownIds.length}`,
  `- Suspicious/dead patterns: ${deadPatterns.length}`,
  "",
  "A control is production-ready only when its action ID is registered, its preconditions and recovery path are defined, and the UI exposes pending, confirmed/rejected, and synchronization-failure states. The central catalog lives in `src/lib/actions/action-registry.ts`.",
  "",
  "## Suspicious patterns",
  "",
  ...(deadPatterns.length
    ? ["| File | Line | Pattern |", "|---|---:|---|", ...deadPatterns.map((item) => `| ${item.file} | ${item.line} | \`${item.pattern}\` |`)]
    : ["No placeholder hrefs, empty click handlers, console-only handlers, TODOs, or FIXMEs were detected by the static scan."]),
  "",
  "## Visible controls",
  "",
  "| File | Line | Control | Visible label | Action ID | Execution | Destination | Server endpoint(s) | DB | Shared state | Lifecycle | Disabled |",
  "|---|---:|---|---|---|---|---|---|---|---|---|---|",
  ...rows.map((row) =>
    `| ${row.file} | ${row.line} | ${row.control} | ${row.label} | ${row.actionId} | ${row.execution} | ${row.destination} | ${row.server} | ${row.database} | ${row.sharedState} | ${row.lifecycle} | ${row.disabled} |`,
  ),
  "",
];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, lines.join("\n"));

console.log(JSON.stringify({ controls: rows.length, registered: rows.length - unregistered.length, unregistered: unregistered.length, unknownIds: unknownIds.length, deadPatterns: deadPatterns.length, output: path.relative(root, outputPath) }, null, 2));

if (check && (unknownIds.length > 0 || deadPatterns.length > 0 || (strict && unregistered.length > 0))) {
  process.exitCode = 1;
}
