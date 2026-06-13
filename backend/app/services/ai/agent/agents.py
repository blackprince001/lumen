"""Agent factory functions.

Provides factory functions that build configured ``Agent`` instances
for single-paper chat, multi-paper chat, and deep research workflows.
Each agent is pre-configured with the appropriate system instructions
and tool bindings.
"""

from __future__ import annotations

from app.models.paper import Paper
from app.services.ai.agent.tools.chat_history import get_chat_history
from app.services.ai.agent.tools.discovery_tools import (
  get_author_works,
  get_recommendations,
  get_references,
  search_authors,
  search_discovery,
  web_search,
)
from app.services.ai.agent.tools.discovery_tools import (
  get_citations as discovery_get_citations,
)
from app.services.ai.agent.tools.discovery_tools import (
  get_paper_details as discovery_get_paper_details,
)
from app.services.ai.agent.tools.paper_tools import (
  get_annotations,
  get_citations,
  get_notes,
  get_paper_content,
  get_paper_metadata,
  search_papers,
)
from app.services.ai.agent.tools.rag_tool import semantic_search

# OpenAI Agents SDK — optional dependency
try:
  from agents import Agent

  _HAS_AGENTS_SDK = True
except ImportError:
  Agent = object  # type: ignore[misc,assignment]
  _HAS_AGENTS_SDK = False

PAPER_AGENT_INSTRUCTIONS = """You are an AI research assistant helping a user understand a specific research paper.

You have access to the full text of the paper, the user's annotations and notes,
and related papers in their library.

Guidelines:
- Answer questions clearly using the paper content. Cite specific sections.
- When referring to the paper, mention the title.
- If you use annotations or notes, mention that the user wrote them.
- If the user asks about something not in the paper, use your general knowledge but clarify what comes from the paper vs. what is external.
- Be concise but thorough. Default to providing useful detail.
- Use semantic_search when the user asks about related concepts not in this specific paper.
- Format mathematical expressions using LaTeX notation when relevant."""


MULTI_PAPER_AGENT_INSTRUCTIONS = """You are an AI research assistant helping a user understand and compare multiple research papers at once.

You have access to the full text of all papers in the current context, the user's annotations and notes,
and the rest of their library.

Guidelines:
- Compare and contrast the papers when relevant.
- Always mention which paper you are referring to by title.
- Synthesize findings across papers rather than treating them in isolation.
- If the user's notes or annotations are relevant, reference them.
- Use semantic_search to find additional relevant papers in the user's library.
- Be concise but thorough.
- Format mathematical expressions using LaTeX notation when relevant."""


DEEP_RESEARCH_INSTRUCTIONS = """You are a deep research assistant that produces comprehensive, cited reports.

Your workflow:
1. Understand the user's research question.
2. Search across the user's paper library and the broader web.
3. Synthesize findings into a well-structured report with citations.
4. Identify gaps, contradictions, and open questions.

Guidelines:
- Always cite sources. For papers from the user's library, include the paper ID.
- Structure the report with clear sections (e.g., Background, Findings, Analysis, Conclusions).
- Note the strength of evidence for each claim.
- Identify where papers agree and disagree.
- Suggest specific papers the user should read next.
- Be thorough and nuanced."""


SYSTEM_PROMPT_SUFFIX = """
\n\nAvailable papers in context:
{paper_context}
"""


def create_paper_agent(
  paper: Paper,
  additional_tools: list | None = None,
) -> Agent:
  """Create an agent for single-paper chat.

  Args:
      paper: The paper being discussed.
      additional_tools: Optional extra tools to bind.

  Returns:
      A configured ``Agent`` instance.
  """
  tools = [
    get_paper_content,
    get_paper_metadata,
    get_annotations,
    get_notes,
    get_citations,
    search_papers,
    semantic_search,
    get_chat_history,
  ]
  if additional_tools:
    tools.extend(additional_tools)

  paper_info = f"- [{paper.id}] {paper.title}"
  if paper.authors:
    paper_info += f" by {paper.authors[:100]}"

  instructions = PAPER_AGENT_INSTRUCTIONS + SYSTEM_PROMPT_SUFFIX.format(
    paper_context=paper_info,
  )

  return Agent(
    name="Paper Assistant",
    instructions=instructions,
    tools=tools,
  )


def create_multi_paper_agent(
  papers: list[Paper],
  additional_tools: list | None = None,
) -> Agent:
  """Create an agent for multi-paper (group) chat.

  Args:
      papers: List of papers in the current context.
      additional_tools: Optional extra tools to bind.

  Returns:
      A configured ``Agent`` instance.
  """
  tools = [
    get_paper_content,
    get_paper_metadata,
    get_annotations,
    get_notes,
    get_citations,
    search_papers,
    semantic_search,
    get_chat_history,
  ]
  if additional_tools:
    tools.extend(additional_tools)

  context_lines = [f"A user is discussing {len(papers)} paper(s):"]
  for p in papers:
    line = f"- [{p.id}] {p.title}"
    if p.authors:
      line += f" by {p.authors[:80]}"
    context_lines.append(line)

  instructions = MULTI_PAPER_AGENT_INSTRUCTIONS + SYSTEM_PROMPT_SUFFIX.format(
    paper_context="\n".join(context_lines),
  )

  return Agent(
    name="Multi-Paper Assistant",
    instructions=instructions,
    tools=tools,
  )


def create_deep_research_agent(
  additional_tools: list | None = None,
) -> Agent:
  """Create an agent for deep research report generation.

  Args:
      additional_tools: Optional extra tools to bind.

  Returns:
      A configured ``Agent`` instance.
  """
  tools = [
    search_papers,
    semantic_search,
    get_paper_content,
    get_paper_metadata,
    get_citations,
    search_discovery,
    discovery_get_paper_details,
    discovery_get_citations,
    get_references,
    get_recommendations,
    web_search,
    search_authors,
    get_author_works,
  ]
  if additional_tools:
    tools.extend(additional_tools)

  return Agent(
    name="Deep Research Assistant",
    instructions=DEEP_RESEARCH_INSTRUCTIONS,
    tools=tools,
  )
