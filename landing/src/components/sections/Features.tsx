import { Placeholder } from '@/components/Placeholder';

interface Feature {
  title: string;
  body: string;
  placeholder: string;
  hint: string;
  span: string;
  src?: string;
}

const FEATURES: Feature[] = [
  {
    title: 'Conduct reliable research.',
    body: 'Chat with any paper, ask across your whole library, and get answers grounded in the source full screen, in a tab, or beside the PDF.',
    placeholder: 'AI research assistant',
    hint: 'Chat panel answering a question with inline citation chips.',
    span: 'lg:col-span-7',
    src: '/screens/chat-alongside.png',
  },
  {
    title: 'Organize everything.',
    body: 'Hierarchical groups, smart tags, reading status, and duplicate detection keep your whole library tidy.',
    placeholder: 'Groups & tags',
    hint: 'Nested collections, tag filters, and the paper list.',
    span: 'lg:col-span-5',
    src: '/screens/groups.png',
  },
  {
    title: 'Semantic search.',
    body: 'Find papers by meaning, not just keywords, with vector embeddings across your library.',
    placeholder: 'Semantic search results',
    hint: 'Search bar with semantic results ranked by relevance.',
    span: 'lg:col-span-5',
    src: '/screens/semantic-search.png',
  },
  {
    title: 'Map the citations.',
    body: 'Lumen extracts citation relationships and lays them out as an interactive graph you can explore.',
    placeholder: 'Citation map / graph',
    hint: 'The force-directed citation graph view.',
    span: 'lg:col-span-7',
    src: '/screens/citation-map.png',
  },
];

export function Features() {
  return (
    <section id="features" className="bg-off-white px-6 py-24 md:px-10 md:py-32">
      <div className="mx-auto max-w-[1180px]">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.12em] text-mint-deep">
            How Lumen can help
          </span>
          <h2 className="mt-3 text-4xl font-bold tracking-tight text-forest md:text-5xl">
            We've got you covered
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-mid-gray">
            From discovering your first paper, to managing references, to writing
            your final piece, Lumen ensures both speed and accuracy.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className={`flex flex-col overflow-hidden rounded-3xl border border-border-gray bg-card-surface p-7 md:p-8 ${f.span}`}
            >
              <h3 className="text-xl font-semibold tracking-tight text-forest">
                {f.title}{' '}
                <span className="font-normal text-mid-gray">{f.body}</span>
              </h3>
              {f.src ? (
                // Let the screenshot bleed to the card's right edge so it reads big.
                <div className="-mr-7 mt-6 overflow-hidden rounded-l-xl shadow-[0_20px_50px_-25px_rgba(35,41,39,0.5)] md:-mr-8">
                  <img
                    src={f.src}
                    alt={f.placeholder}
                    loading="lazy"
                    className="block h-auto w-full"
                  />
                </div>
              ) : (
                <Placeholder
                  label={f.placeholder}
                  hint={f.hint}
                  className="mt-6 min-h-[240px] bg-off-white"
                />
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
