# 🔄 Migration to LangChain v2.0

## Key Changes

### New Agent Architecture
- **Before**: 4 agents (Clarifier, Critic, Defender, Investor)
- **After**: 3 agents (Proposer, Critic, Investor)
- **New**: Using LangChain for orchestration

### Iterative System
- **Before**: Single evaluation in 3-5 rounds
- **After**: Up to 5 iterations with 10 turns per agent
- **New**: Investor can reformulate ideas

### Budget Management
- **Before**: Arbitrary values $5-$50
- **After**: Fixed options $0.1-$20
- **New**: More precise cost control

## Changed Files

### New Files
- `server/services/LangChainEvaluationService.js` - new service with LangChain
- `MIGRATION.md` - this file

### Updated Files
- `PROMPT.md` - new base prompt for agents
- `server/index.js` - LangChain service integration
- `package.json` - added LangChain dependencies
- `README.md` - v2.0 documentation

### Legacy Files (can be removed)
- `server/services/EvaluationService.js` - replaced with LangChain version

## Key API Changes

### New Endpoints
- `GET /api/budget-options` - list of available budgets
- `GET /api/evaluate/:id/stats` - budget statistics

### Removed Endpoints
- `POST /api/evaluate/:id/continue` - replaced with iterative system

### Changed Responses
- Added fields `currentIteration`, `budget`, `totalCost`
- New `metadata` structure in final report

## Benefits of New Version

1. **Better agent coordination** through LangChain
2. **Automatic idea improvement** through iterations  
3. **Precise budget control** with preset options
4. **Structured results** from Investor
5. **Better performance** and error handling

## Backward Compatibility

- ✅ Frontend remains compatible
- ✅ Main API endpoints preserved
- ✅ Response format extended but compatible
- ⚠️ Some fields may have new values 