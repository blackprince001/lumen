import { useState } from 'react';
import {
  HamburgerMenu,
  CloseCircle,
  ArrowRight,
  MagicStar,
  SearchNormal,
  Book,
  Shield,
  TickCircle,
  People,
  Profile2User,
  Teacher,
  Code,
  Cloud,
  Lock,
} from 'iconsax-reactjs';
import { Logo } from './components/Logo';

const APP_URL = import.meta.env.VITE_APP_URL ?? '#';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Use Cases', href: '#use-cases' },
  { label: 'About', href: '#about' },
];

export default function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-canvas-white text-black font-sans selection:bg-blue-tint-medium selection:text-deep-blue">

      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-canvas-white/90 backdrop-blur-sm border-b border-light-border">
        <div className="flex items-center justify-between px-5 md:px-10 h-[60px] max-w-[1280px] mx-auto w-full">

          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="font-semibold text-[17px] tracking-[0.04em]">PAPERS</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-[15px] text-dark-zinc hover:text-brand-blue transition-colors">{l.label}</a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-4">
            <a href={APP_URL} className="text-[15px] text-dark-zinc hover:text-brand-blue transition-colors">Admin Login</a>
            <a
              href={APP_URL}
              className="flex items-center gap-1.5 bg-blue-highlight text-black font-semibold text-[15px] px-4 py-2 rounded-[10px] border-[1.5px] border-blue-tint-medium hover:bg-blue-tint-light hover:border-medium-grey hover:text-deep-blue active:bg-blue-tint-medium active:border-brand-blue active:text-darkest-blue transition-all"
            >
              Sign In <ArrowRight size={15} />
            </a>
          </div>

          <button
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <CloseCircle size={24} /> : <HamburgerMenu size={24} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-light-border bg-canvas-white px-5 py-4 flex flex-col gap-1">
            {[...NAV_LINKS.map((l) => ({ label: l.label, href: l.href })), { label: 'Admin Login', href: APP_URL }].map((l) => (
              <a key={l.label} href={l.href} className="text-[15px] text-dark-zinc hover:text-brand-blue transition-colors py-2.5 border-b border-light-border last:border-0">{l.label}</a>
            ))}
            <a
              href={APP_URL}
              className="mt-3 flex items-center justify-center gap-1.5 bg-blue-highlight text-black font-semibold text-[15px] px-4 py-2.5 rounded-[10px] border-[1.5px] border-blue-tint-medium"
            >
              Sign In <ArrowRight size={15} />
            </a>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="pt-[40px] md:pt-[80px] pb-[40px] md:pb-[84px] px-5 md:px-10 max-w-[1280px] mx-auto w-full flex flex-col xl:flex-row gap-10 xl:gap-8 items-start">
        <div className="flex-1 max-w-[720px]">
          <h1 className="text-[40px] sm:text-[52px] md:text-[64px] lg:text-[72px] xl:text-[80px] font-semibold leading-[1.1] md:leading-[0.9] tracking-[-0.02em] mb-6">
            The modern way to read and organize{' '}
            <span className="inline-block bg-blue-tint-light text-deep-blue rounded-[20px] px-4 py-1 mt-2 md:mt-0">research</span>.
          </h1>
          <p className="text-[20px] md:text-[30px] leading-[1.4] md:leading-[30px] text-dark-zinc mb-10 max-w-[600px]">
            Papers is a self-hosted academic management platform with AI-powered reading assistance and semantic discovery.
          </p>
          <a
            href={APP_URL}
            className="inline-flex items-center gap-2 bg-blue-highlight text-black font-semibold text-[16px] px-6 py-3 rounded-[10px] border-[1.5px] border-blue-tint-medium hover:bg-blue-tint-light hover:border-medium-grey hover:text-deep-blue active:bg-blue-tint-medium active:border-brand-blue active:text-darkest-blue transition-all"
          >
            Open Papers <ArrowRight size={16} />
          </a>
        </div>

        <div className="flex-1 w-full xl:w-auto">
          <div className="bg-white border border-light-border rounded-[20px] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
            <div className="flex items-center gap-2 mb-4 border-b border-light-border pb-4">
              <div className="w-3 h-3 rounded-full bg-[#FF5F56]" />
              <div className="w-3 h-3 rounded-full bg-[#FFBD2E]" />
              <div className="w-3 h-3 rounded-full bg-[#27C93F]" />
            </div>
            <div className="space-y-4">
              <div className="flex gap-2">
                <span className="bg-mist-grey px-2 py-1 rounded-md text-[12px]">NeurIPS 2017</span>
                <span className="bg-mist-grey px-2 py-1 rounded-md text-[12px]">Deep Learning</span>
              </div>
              <p className="text-black text-[24px] font-semibold leading-[1.2]">Attention Is All You Need</p>
              <p className="text-[14px] text-medium-grey">Ashish Vaswani, Noam Shazeer, Niki Parmar, Jakob Uszkoreit...</p>
              <div className="bg-blue-highlight p-5 rounded-[12px] border border-blue-tint-medium">
                <div className="flex items-center gap-2 mb-3 text-deep-blue font-semibold text-[13px]">
                  <MagicStar size={15} color="#1D4ED8" /> AI Summary
                </div>
                <p className="text-[14px] leading-[22px] text-black">
                  Proposes the Transformer, a novel architecture based solely on attention mechanisms. Experiments on machine translation show superior quality with significantly less training time.
                </p>
              </div>
              <p className="text-[14px] text-brand-blue cursor-pointer hover:underline">View full PDF & Annotations →</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features — deep dives */}
      <section id="features">
        {[
          {
            icon: <MagicStar size={24} color="#2563EB" />,
            title: 'Chat with your research.',
            desc: 'Ask context-aware questions about any paper and get detailed responses powered by Google Gemini. Create follow-up threads for deeper exploration of specific topics.',
            bullets: ['Auto-generated summaries on ingest', 'Key findings & methodology extraction', 'AI-suggested highlights and reading guides'],
            img: 'chat',
            reverse: false,
          },
          {
            icon: <SearchNormal size={24} color="#2563EB" />,
            title: 'Semantic discovery.',
            desc: 'Find papers by meaning, not just keywords. pgvector-powered semantic search uses 768-dimensional embeddings to surface the most relevant literature for your query.',
            bullets: ['Full-text search across all PDFs', 'Multi-source discovery: arXiv, Semantic Scholar, HuggingFace', 'Advanced filtering by tag, group, status, and date'],
            img: 'search',
            reverse: true,
          },
          {
            icon: <Book size={24} color="#2563EB" />,
            title: 'Read and annotate.',
            desc: 'A smooth, responsive PDF viewer integrated directly into the application. Highlight text, attach notes, and track your reading progress without leaving the browser.',
            bullets: ['Built-in PDF.js viewer', 'Rich text annotations with TipTap', 'Export notes to Markdown'],
            img: 'reader',
            reverse: false,
          },
        ].map(({ icon, title, desc, bullets, img, reverse }) => (
          <div
            key={title}
            className={`py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full flex flex-col gap-10 lg:gap-20 items-center ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'}`}
          >
            <div className="flex-1 max-w-[500px]">
              <div className="bg-mist-grey w-12 h-12 rounded-full flex items-center justify-center mb-6">{icon}</div>
              <h2 className="text-[30px] md:text-[40px] font-semibold leading-[1.2] tracking-[-0.01em] mb-6">{title}</h2>
              <p className="text-[18px] leading-[28px] text-dark-zinc mb-6">{desc}</p>
              <ul className="space-y-3">
                {bullets.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-[16px] text-dark-zinc">
                    <TickCircle size={20} color="#2563EB" /> {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 w-full">
              <div className="bg-white border border-light-border rounded-[20px] p-2 md:p-4 shadow-[0_2px_12px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
                <img
                  src={`https://picsum.photos/seed/${img}/1200/800?blur=2`}
                  alt={title}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto rounded-[12px] border border-light-border"
                />
              </div>
            </div>
          </div>
        ))}

        {/* Feature grid */}
        <div className="py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full">
          <h2 className="text-[22px] md:text-[30px] font-semibold leading-[1.2] md:leading-[45px] tracking-[-0.01em] mb-[40px] md:mb-[60px] max-w-[600px]">
            Everything you need for academic research, built for the modern web.
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[32px]">
            {[
              { icon: <MagicStar size={24} color="#2563EB" />, title: 'AI-Powered Reading Assistant', desc: 'Chat with any paper. Get auto-generated summaries, key findings extraction, and smart highlights powered by Google Gemini.', wide: true, blue: true },
              { icon: <SearchNormal size={24} color="#000" />, title: 'Semantic Discovery', desc: 'Find papers by meaning using 768-dimensional vector embeddings and full-text search across your entire library.', wide: false, blue: false },
              { icon: <Book size={24} color="#000" />, title: 'Rich Annotations', desc: 'Built-in PDF reader with seamless highlighting, notes, bookmarks, and citation graph visualization.', wide: false, blue: false },
              { icon: <Shield size={24} color="#2563EB" />, title: 'Self-Hosted & Private', desc: 'Full control over your library. Deploy with Docker, PostgreSQL, and per-user data isolation. Your data never leaves your server.', wide: true, blue: true },
            ].map(({ icon, title, desc, wide, blue }) => (
              <div
                key={title}
                className={`${wide ? 'col-span-1 md:col-span-2' : ''} ${blue ? 'bg-blue-highlight border-blue-tint-medium hover:bg-blue-tint-light hover:border-brand-blue active:bg-blue-tint-medium active:border-deep-blue' : 'bg-mist-grey border-mist-grey hover:bg-[#E5E7EB] hover:border-border-grey active:bg-border-grey active:border-medium-grey'} border-[3px] rounded-[20px] p-[27px_17px_30px_27px] md:p-[36px] min-h-[200px] transition-colors cursor-pointer group flex flex-col justify-between`}
              >
                <div>
                  <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center mb-6 shadow-sm group-hover:scale-110 transition-transform">
                    {icon}
                  </div>
                  <h3 className="text-[28px] md:text-[34px] font-semibold leading-[1.1] tracking-[-0.01em] mb-4">{title}</h3>
                  <p className="text-[16px] leading-[24px] text-dark-zinc max-w-[400px]">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full">
        <div className="mb-[40px] md:mb-[60px]">
          <h2 className="text-[22px] md:text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] mb-3">Simple pricing.</h2>
          <p className="text-[18px] text-dark-zinc max-w-[500px]">Papers is self-hosted and free to run. You only pay for the infrastructure you choose and the AI API calls you make.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: 'Self-Hosted',
              price: 'Free',
              sub: 'forever',
              desc: 'Run Papers on your own server. Full control, no subscriptions, no data leaving your infrastructure.',
              bullets: ['Unlimited papers & annotations', 'All AI features (bring your own Gemini key)', 'Multi-user with per-user isolation', 'Docker Compose deployment', 'PostgreSQL + pgvector included'],
              cta: 'Deploy Now',
              href: APP_URL,
              highlight: false,
            },
            {
              name: 'AI Usage',
              price: 'Pay-as-you-go',
              sub: 'via Google AI',
              desc: 'AI features are powered by Google Gemini. You connect your own API key — costs scale with your usage.',
              bullets: ['Summaries & key findings extraction', 'Chat with papers (SSE streaming)', 'Smart highlights & reading guides', '768-dim embeddings for semantic search', 'Free tier available from Google'],
              cta: 'Get Gemini Key',
              href: 'https://ai.google.dev/',
              highlight: true,
            },
            {
              name: 'Infrastructure',
              price: 'Your choice',
              sub: 'any cloud or bare metal',
              desc: 'A modest VPS is all you need. Papers runs comfortably on 2 vCPUs and 4GB RAM.',
              bullets: ['2 vCPU / 4GB RAM minimum', 'PostgreSQL 16 + pgvector', 'Redis for task queue', 'Traefik for SSL & routing', '~$10–20/mo on most cloud providers'],
              cta: 'See Setup Guide',
              href: APP_URL,
              highlight: false,
            },
          ].map(({ name, price, sub, desc, bullets, cta, href, highlight }) => (
            <div
              key={name}
              className={`rounded-[20px] p-8 flex flex-col gap-6 border-[2px] ${highlight ? 'bg-blue-highlight border-blue-tint-medium' : 'bg-mist-grey border-mist-grey'}`}
            >
              <div>
                <p className="text-[13px] font-semibold text-medium-grey uppercase tracking-widest mb-2">{name}</p>
                <p className="text-[36px] font-semibold leading-none tracking-[-0.02em]">{price}</p>
                <p className="text-[14px] text-medium-grey mt-1">{sub}</p>
              </div>
              <p className="text-[15px] leading-[24px] text-dark-zinc">{desc}</p>
              <ul className="space-y-2.5 flex-1">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14px] text-dark-zinc">
                    <TickCircle size={18} color="#2563EB" className="mt-0.5 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
              <a
                href={href}
                className="flex items-center justify-center gap-1.5 bg-white text-black font-semibold text-[14px] px-4 py-2.5 rounded-[10px] border-[1.5px] border-light-border hover:border-medium-grey transition-all"
              >
                {cta} <ArrowRight size={14} />
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full">
        <div className="mb-[40px] md:mb-[60px]">
          <h2 className="text-[22px] md:text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] mb-3">Built for serious researchers.</h2>
          <p className="text-[18px] text-dark-zinc max-w-[500px]">Whether you're writing a dissertation, exploring a new field, or managing a team's reading list — Papers adapts to how you work.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Teacher size={32} color="#2563EB" />,
              title: 'PhD Researchers',
              desc: 'Manage hundreds of papers across multiple projects. Use AI summaries to triage new literature quickly, annotate deeply when it matters, and track your reading progress through your entire review.',
              bullets: ['Hierarchical groups by project or chapter', 'Citation graph to map related work', 'Export annotations for writing'],
            },
            {
              icon: <Profile2User size={32} color="#2563EB" />,
              title: 'Research Teams',
              desc: 'Deploy a shared instance for your lab or team. Each member gets their own isolated library while admins can oversee the full collection and manage accounts.',
              bullets: ['Multi-user with per-user data isolation', 'Admin dashboard for user management', 'Shared discovery sessions'],
            },
            {
              icon: <People size={32} color="#2563EB" />,
              title: 'Independent Learners',
              desc: 'Dive deep into any field without institutional access. Import papers from arXiv, HuggingFace, and open-access sources. Let AI guide your reading and surface what matters.',
              bullets: ['Import from arXiv, ACM, IEEE, OpenReview', 'AI reading guides for unfamiliar topics', 'Semantic search to find related work'],
            },
          ].map(({ icon, title, desc, bullets }) => (
            <div key={title} className="bg-white border border-light-border rounded-[20px] p-8 flex flex-col gap-5">
              <div className="bg-mist-grey w-14 h-14 rounded-full flex items-center justify-center">{icon}</div>
              <div>
                <h3 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] mb-3">{title}</h3>
                <p className="text-[15px] leading-[24px] text-dark-zinc">{desc}</p>
              </div>
              <ul className="space-y-2.5 mt-auto">
                {bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-[14px] text-dark-zinc">
                    <TickCircle size={16} color="#2563EB" className="mt-0.5 shrink-0" /> {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section id="about" className="py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          <div>
            <h2 className="text-[22px] md:text-[30px] font-semibold leading-[1.2] tracking-[-0.01em] mb-6">What is Papers?</h2>
            <p className="text-[17px] leading-[28px] text-dark-zinc mb-4">
              Papers started as a personal tool for managing an ever-growing library of academic PDFs. The goal was simple: a single place to read, annotate, and actually understand research — with AI doing the heavy lifting on summarization and discovery.
            </p>
            <p className="text-[17px] leading-[28px] text-dark-zinc mb-4">
              It's self-hosted by design. Your papers, annotations, and conversations stay on your infrastructure. There's no SaaS subscription, no vendor lock-in, and no usage caps beyond what your own API keys allow.
            </p>
            <p className="text-[17px] leading-[28px] text-dark-zinc">
              Papers is a full-stack polyglot application — a FastAPI backend with async SQLAlchemy, a React 19 frontend, Celery workers for background AI tasks, and pgvector for semantic search. It deploys with a single Docker Compose command.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: <Code size={22} color="#2563EB" />, label: 'FastAPI + Python 3.13', desc: 'Async backend with SQLAlchemy 2.0 and Alembic migrations' },
              { icon: <MagicStar size={22} color="#2563EB" />, label: 'Google Gemini', desc: 'AI summaries, chat, embeddings, and smart highlights' },
              { icon: <SearchNormal size={22} color="#2563EB" />, label: 'pgvector', desc: '768-dimensional semantic search directly in PostgreSQL' },
              { icon: <Cloud size={22} color="#2563EB" />, label: 'React 19 + Vite', desc: 'TypeScript frontend with TanStack Query and TipTap' },
              { icon: <Lock size={22} color="#2563EB" />, label: 'Google OAuth + JWT', desc: 'Secure auth with per-user data isolation and admin access' },
              { icon: <Shield size={22} color="#2563EB" />, label: 'Docker + Traefik', desc: 'One-command deployment with automatic SSL via Let\'s Encrypt' },
            ].map(({ icon, label, desc }) => (
              <div key={label} className="bg-mist-grey rounded-[16px] p-5">
                <div className="bg-white w-10 h-10 rounded-full flex items-center justify-center mb-3 shadow-sm">{icon}</div>
                <p className="text-[14px] font-semibold mb-1">{label}</p>
                <p className="text-[13px] text-medium-grey leading-[20px]">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-[40px] md:py-[80px] px-5 md:px-10 max-w-[1280px] mx-auto w-full">
        <div className="bg-blue-highlight border-[2px] border-blue-tint-medium rounded-[24px] p-10 md:p-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h2 className="text-[28px] md:text-[36px] font-semibold leading-[1.2] tracking-[-0.01em] mb-3">Ready to take control of your research?</h2>
            <p className="text-[17px] text-dark-zinc max-w-[480px]">Open Papers and start building your library. Import your first paper in under a minute.</p>
          </div>
          <a
            href={APP_URL}
            className="shrink-0 flex items-center gap-2 bg-white text-black font-semibold text-[16px] px-6 py-3 rounded-[10px] border-[1.5px] border-light-border hover:border-medium-grey transition-all"
          >
            Open Papers <ArrowRight size={16} />
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-light-border mt-[40px] md:mt-[80px] py-[40px] px-5 md:px-10 max-w-[1280px] mx-auto w-full flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-semibold text-[17px] tracking-[0.04em]">PAPERS</span>
        </div>
        <div className="flex gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.label} href={l.href} className="text-[14px] text-dark-zinc hover:text-brand-blue transition-colors">{l.label}</a>
          ))}
        </div>
      </footer>
    </div>
  );
}
