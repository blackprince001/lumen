import { memo, useMemo } from "react";
import ReactMarkdown, {
  defaultUrlTransform,
  type Components,
} from "react-markdown";
import remarkMath from "remark-math";
import remarkGfm from "remark-gfm";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/cjs/styles/prism";
import "katex/dist/katex.min.css";
import { cn } from "@/lib/utils";
import { ReferenceChip } from "./ReferenceChip";
import { ReferenceManifestProvider } from "./ReferenceManifestProvider";
import type { ReferenceManifestEntry } from "@/lib/api/references";

interface MarkdownMessageProps {
  content: string;
  className?: string;
  referenceManifest?: ReferenceManifestEntry[] | null;
}

const REMARK_PLUGINS = [remarkMath, remarkGfm];

function refAwareUrlTransform(url: string): string {
  return url.startsWith("ref:") ? url : defaultUrlTransform(url);
}
// throwOnError keeps a single malformed expression from blanking the whole
// message — KaTeX renders the offending source in red instead of crashing.
const REHYPE_PLUGINS = [
  [rehypeKatex, { throwOnError: false, strict: false }],
] as any;

function extractText(node: unknown): string {
  if (node == null || node === false) return "";
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (typeof node === "object" && "props" in (node as any)) {
    return extractText((node as any).props?.children);
  }
  return "";
}

const REF_KINDS =
  "paper|citation|figure|section|annotation|note|external|author";

function linkifyBareRefs(input: string): string {
  if (!input.includes("ref:")) return input;

  const segments = input.split(/(```[\s\S]*?```|`[^`]*`)/g);
  const bracketed = new RegExp(
    `\\[ref:(${REF_KINDS})/([A-Za-z0-9:._-]+)\\]`,
    "g",
  );
  const inline = new RegExp(
    `(^|[^([/\\]])ref:(${REF_KINDS})/([A-Za-z0-9:._-]+)`,
    "g",
  );
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // code segment
      seg = seg.replace(
        bracketed,
        (_, k, id) => `[${k}/${id}](ref:${k}/${id})`,
      );
      seg = seg.replace(
        inline,
        (_, pre, k, id) => `${pre}[${k}/${id}](ref:${k}/${id})`,
      );
      return seg;
    })
    .join("");
}

function maskIncompleteRefLinks(input: string): string {
  return input.replace(/\[[^\]]*\]\(ref:[^)]*$/gm, (match) => {
    if (match.endsWith(")")) return match;
    return match.replace(/\(ref:[^)]*$/, "");
  });
}

/**
 * Convert LaTeX written with `\( \)` / `\[ \]` delimiters (the style most
 * LLMs emit) into the `$ $` / `$$ $$` delimiters that remark-math parses.
 * Without this, markdown treats `\(` as an escaped paren and the math never
 * renders. Fenced and inline code spans are left untouched.
 */
function normalizeMathDelimiters(input: string): string {
  if (!input.includes("\\(") && !input.includes("\\[")) return input;
  // Split on code so delimiter rewriting never touches code samples. The
  // capturing group keeps the code segments in the array at odd indices.
  const segments = input.split(/(```[\s\S]*?```|`[^`]*`)/g);
  return segments
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // a code segment — leave as-is
      return seg
        .replace(/\\\[([\s\S]+?)\\\]/g, (_, body) => `$$${body}$$`)
        .replace(/\\\(([\s\S]+?)\\\)/g, (_, body) => `$${body}$`);
    })
    .join("");
}

const MARKDOWN_COMPONENTS: Components = {
  code({ className: cls, children, ...props }: any) {
    const match = /language-(\w+)/.exec(cls || "");
    const language = match?.[1];
    return language ? (
      <SyntaxHighlighter
        style={oneLight}
        language={language}
        PreTag="div"
        customStyle={{
          marginTop: "0.75rem",
          marginBottom: "0.75rem",
          padding: "1rem",
          borderRadius: "0.5rem",
          background: "var(--muted)",
          fontSize: "0.75rem",
        }}
        {...props}
      >
        {String(children).replace(/\n$/, "")}
      </SyntaxHighlighter>
    ) : (
      <code
        className="bg-(--muted) px-1.5 py-0.5 rounded text-caption"
        {...props}
      >
        {children}
      </code>
    );
  },
  p({ children }) {
    return <p className="mb-3 last:mb-0">{children}</p>;
  },
  h1({ children }) {
    return (
      <p className="text-btn font-semibold mb-2 mt-4 first:mt-0">{children}</p>
    );
  },
  h2({ children }) {
    return (
      <p className="text-body font-semibold mb-2 mt-3 first:mt-0">{children}</p>
    );
  },
  h3({ children }) {
    return (
      <p className="text-code font-semibold mb-1.5 mt-2 first:mt-0">
        {children}
      </p>
    );
  },
  h4({ children }) {
    return (
      <p className="text-code font-medium mb-1 mt-2 first:mt-0">{children}</p>
    );
  },
  h5({ children }) {
    return (
      <p className="text-code font-medium mb-1 mt-2 first:mt-0">{children}</p>
    );
  },
  h6({ children }) {
    return (
      <p className="text-caption font-medium mb-1 mt-1 first:mt-0">
        {children}
      </p>
    );
  },
  ul({ children }) {
    return (
      <ul className="list-disc list-outside mb-3 space-y-1.5 ml-5">
        {children}
      </ul>
    );
  },
  ol({ children }) {
    return (
      <ol className="list-decimal list-outside mb-3 space-y-1.5 ml-5">
        {children}
      </ol>
    );
  },
  li({ children }) {
    return <li>{children}</li>;
  },
  blockquote({ children }) {
    return (
      <blockquote className="border-l-2 border-(--border) pl-4 my-3 text-(--muted-foreground) italic">
        {children}
      </blockquote>
    );
  },
  a({ href, children }) {
    if (href?.startsWith("ref:")) {
      const rest = href.slice(4);
      const slash = rest.indexOf("/");
      if (slash > 0) {
        const kind = rest.slice(0, slash);
        const id = rest.slice(slash + 1);
        // react-markdown passes children as a node array, not a string —
        // flatten to the visible text the model wrote so the chip keeps it.
        const label = extractText(children);
        return <ReferenceChip kind={kind} id={id} label={label} />;
      }
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-(--sky-blue) underline underline-offset-2 hover:opacity-80 transition-opacity"
      >
        {children}
      </a>
    );
  },
  table({ children }) {
    return (
      <div className="overflow-x-auto my-3">
        <table className="min-w-full border border-(--border) rounded-lg overflow-hidden text-caption">
          {children}
        </table>
      </div>
    );
  },
  th({ children }) {
    return (
      <th className="border border-(--border) px-3 py-2 bg-(--muted) font-semibold text-left">
        {children}
      </th>
    );
  },
  td({ children }) {
    return <td className="border border-(--border) px-3 py-2">{children}</td>;
  },
  hr() {
    return <hr className="my-4 border-(--border)" />;
  },
  strong({ children }) {
    return <strong className="font-semibold">{children}</strong>;
  },
  em({ children }) {
    return <em className="italic">{children}</em>;
  },
};

export const MarkdownMessage = memo(function MarkdownMessage({
  content,
  className,
  referenceManifest,
}: MarkdownMessageProps) {
  const safe = useMemo(() => maskIncompleteRefLinks(content), [content]);
  const linked = useMemo(() => linkifyBareRefs(safe), [safe]);
  const normalized = useMemo(() => normalizeMathDelimiters(linked), [linked]);
  return (
    <div className={cn("text-code leading-[1.75]", className)}>
      <ReferenceManifestProvider manifest={referenceManifest}>
        <ReactMarkdown
          remarkPlugins={REMARK_PLUGINS}
          rehypePlugins={REHYPE_PLUGINS}
          urlTransform={refAwareUrlTransform}
          components={MARKDOWN_COMPONENTS}
        >
          {normalized}
        </ReactMarkdown>
      </ReferenceManifestProvider>
    </div>
  );
});
