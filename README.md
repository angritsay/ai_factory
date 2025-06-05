# 🚀 AI Startup Evaluator v2.0 (LangChain Edition)

AI-powered startup idea evaluation system using LangChain for orchestrating collaborative AI agents.

## 🎯 Overview

This system uses three specialized AI agents for comprehensive startup idea evaluation:

- **Proposer** — proposes and refines startup ideas
- **Critic** — critically analyzes ideas, identifies weaknesses
- **Investor** — makes final investment decisions

## 🔧 New Features in v2.0

### LangChain Orchestration
- Uses LangChain for coordinating agent interactions
- Structured workflow with clear roles
- Support for iterative idea improvement

### Smart Iterative System
- Up to 5 evaluation iterations
- Each iteration includes up to 10 turns per agent
- Investor can reformulate ideas for next iteration
- Automatic completion when idea is ready

### Flexible Budget Management
Available budget options: **$0.1, $1, $2, $3, $5, $10, $20**
- Global spending control for entire session
- Automatic stop when budget is exhausted
- Detailed usage statistics

### Enhanced Investor Requirements
Investor must provide:
- **Clear idea formulation**: product, audience, problem, monetization
- **Investment decision**: yes/no with reasoning and confidence level
- **Readiness verdict**: "ready" or "not ready"

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Proposer     │◄──►│     Critic      │    │    Investor     │
│   (proposes)    │    │   (critiques)   │    │   (evaluates)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         ▲                       ▲                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 ▼
                    ┌─────────────────────┐
                    │   LangChain         │
                    │   Orchestrator      │
                    └─────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18.0.0
- OpenAI API key
- npm or yarn

### Installation

1. **Clone repository**
```bash
git clone <repository-url>
cd ai-startup-evaluator
```

2. **Install dependencies**
```bash
npm install
```

3. **Setup environment**
```bash
cp env.example .env
```

4. **Run in development mode**
```bash
npm run dev
```

The application will be available at `http://localhost:5177`

### Usage

1. **Enter startup idea** — brief description of your concept
2. **Provide OpenAI API key** — for GPT-4 interaction
3. **Select budget** — from $0.1 to $20 for cost control
4. **Start evaluation** — watch agent debates in real-time

## 📊 API Endpoints

### POST `/api/evaluate`
Start new evaluation
```json
{
  "idea": "Startup idea text",
  "apiKey": "sk-...",
  "budget": 5.0
}
```

### GET `/api/evaluate/:id`
Get evaluation status

### GET `/api/evaluate/:id/stats`
Budget usage statistics

### POST `/api/evaluate/:id/stop`
Stop active evaluation

### GET `/api/budget-options`
List of available budgets

## 🎭 Agent Roles

### Proposer
- Formulates and improves ideas
- Adapts based on criticism
- Brief, reasoned responses (200-300 words)

### Critic  
- Critical analysis of viability
- Questions about market potential
- Identifies risks and weaknesses

### Investor
- Final readiness assessment
- Structured investment decision
- Reformulates ideas for iterations

## 💰 Budget Management

| Budget | Approximate Evaluation | Recommended For |
|--------|----------------------|-----------------|
| $0.1   | Quick check | System testing |
| $1-2   | Basic evaluation | Simple ideas |
| $3-5   | Full evaluation | Most cases |
| $10-20 | Deep analysis | Complex projects |

## 🔧 Tech Stack

- **Backend**: Node.js + Express
- **AI Orchestration**: LangChain
- **LLM**: OpenAI GPT-4
- **Frontend**: React + Vite + Tailwind CSS
- **Token Management**: tiktoken

## 📈 Usage Examples

### Basic SaaS Idea
```
Idea: "Email marketing automation platform for small businesses"
Budget: $3
Result: 3 iterations, ready for implementation
```

### Complex AI Product
```
Idea: "AI assistant for medical diagnosis"  
Budget: $10
Result: 5 iterations, requires further development
```

## 🐛 Troubleshooting

### API Key Errors
- Verify OpenAI API key correctness
- Ensure sufficient account balance

### Budget Exceeded
- Use smaller budget for testing
- Monitor spending in real-time

### Agent Issues
- Check `PROMPT.md` content
- Verify system prompt correctness

## 🚢 Deployment

### Render.com
Application ready for Render.com deployment using `render.yaml`

### Local Production
```bash
npm run build
npm start
```

## 📝 Logging & Monitoring

System maintains detailed logs:
- Agent interactions
- Budget usage
- Iteration statistics
- Errors and warnings

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Make changes
4. Add tests
5. Create Pull Request

## 📄 License

MIT License

## 🆘 Support

If you have questions or issues:
1. Check "Troubleshooting" section
2. Review browser console logs
3. Create Issue in repository

---

**🎯 Project Goal**: Demonstrate LangChain capabilities for creating complex multi-agent systems in business idea analysis. 