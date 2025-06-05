💡 Original Prompt

Build a web application for collaborative startup idea evaluation using AI agents.

⸻

🔧 Core Requirements
 1. Frontend (React preferred):
 • Input field for the user to enter a raw startup idea or thought fragment.
 • Field to enter an OpenAI API key. Store the key in localStorage.
 • Budget selector (in USD) to limit total OpenAI API usage for the evaluation session.
 • Real-time (or staged) UI showing agent conversations.
 • Final summary section with:
 • Structured startup pitch.
 • Investment verdict.
 • Option to view the entire conversation history.
 2. Backend (Node.js, FastAPI, or Flask):
 • Receives raw user input and budget.
 • Launches a chain of AI agents with clearly defined roles:
 1. Clarifier Agent — Reformulates and interprets the idea.
 2. Critic Agent — Acts as an investor. Challenges the idea on feasibility, logic, and market potential.
 3. Defender Agent — Responds to critique, elaborates and improves the idea without user help.
 4. Investor Agent — Evaluates the final version and makes a decision whether to “invest” or not. Generates a clear Markdown summary.
 • The conversation runs in cycles (e.g. 3–5 rounds max) or until API budget is exhausted.
 • Logs all agent messages for the frontend to display.
 • Supports a setting to limit OpenAI token usage by price ($ cost estimate via tiktoken or OpenAI usage API).
 3. Agent Instructions (System Prompts):
 • Must be defined clearly and separately for each agent.
 • Critic agent must be skeptical, precise, realistic.
 • Defender agent must be optimistic but reasonable, enhancing the idea constructively.
 • Investor agent must simulate a real angel investor with concerns about market size, traction, execution risk.

⸻

🎯 Goals
 • Minimal user interaction after idea input.
 • Autonomous agent dialog without manual intervention.
 • Highly readable final output: Startup summary + Investment verdict.
 • Simple, clean UI (no authentication needed, single-page app).

⸻

🧠 Notes
 • Use OpenAI Chat API (gpt-4o or gpt-4) for agent interactions.
 • Consider token costs, maintain total cost under the provided budget.
 • Each agent can be a function with reusable prompt templates.
 • Allow easy switching of models in the backend (e.g. gpt-4 ↔ gpt-3.5).
 • You may stub API calls or conversation generation for the UI first and plug in OpenAI logic later.
