# Features — Feature Planning Concepts

Feature-planning documents live here. These are **not** part of the codebase
index (`/architecture.md` and the subtree under it describe the system as
built); this directory holds forward-looking design/plan docs for upcoming or
in-progress features — like the deep-research feature plan.

Each feature plan is an OKF concept with YAML frontmatter (required `type:`
field, typically `type: Feature Plan`). Use a per-feature concept file and
list it below as it is added.

# Plans

* [Deep Research](deep-research.md) - multi-step, source-backed research sessions driven by an agent against an external MCP server, with a per-user daily cap and a per-deployment feature flag. Flagship plan; referenced by the [reformation assessment](/reformation.md).

# Related

* [Architecture overview](/architecture.md) - the system as currently built.
* [Decisions](/decisions/index.md) - ADRs that feature plans may reference.