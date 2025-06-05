const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { LangChainEvaluationService } = require('./services/LangChainEvaluationService');

const app = express();
const PORT = process.env.PORT || 3002;

// Trust proxy - это важно для работы rate limiting за прокси
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Более точная идентификация пользователей за прокси
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress;
  }
});
app.use('/api', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://ai-startup-evaluator.onrender.com']
    : ['http://localhost:5173', 'http://localhost:5177', 'http://localhost:3000']
}));

app.use(express.json({ limit: '10mb' }));

// Store active evaluations (in production, use Redis)
const activeEvaluations = new Map();

// Available budget options
const BUDGET_OPTIONS = [0.1, 0.5, 1, 2, 3, 5, 10];

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    version: '2.0.0-langchain',
    budgetOptions: BUDGET_OPTIONS
  });
});

// Get budget options endpoint
app.get('/api/budget-options', (req, res) => {
  res.json({ budgetOptions: BUDGET_OPTIONS });
});

// Start evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
    const { idea, apiKey, budget } = req.body;

    if (!idea || !idea.trim()) {
      return res.status(400).json({ error: 'Startup idea is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!budget || budget <= 0) {
      return res.status(400).json({ error: 'Valid budget is required' });
    }

    if (!BUDGET_OPTIONS.includes(parseFloat(budget))) {
      return res.status(400).json({ 
        error: 'Invalid budget', 
        allowedBudgets: BUDGET_OPTIONS 
      });
    }

    const evaluationId = generateEvaluationId();
    const service = new LangChainEvaluationService(apiKey, parseFloat(budget));
    
    activeEvaluations.set(evaluationId, {
      service,
      status: 'active',
      startedAt: new Date(),
      conversationHistory: [],
      currentCost: 0,
      idea: idea.trim(),
      budget: parseFloat(budget)
    });

    res.json({ 
      evaluationId,
      status: 'started',
      message: 'Startup evaluation started',
      budget: parseFloat(budget),
      maxIterations: 5
    });

    // Start evaluation in background
    service.evaluateIdea(
      idea.trim(),
      (step, message, cost) => {
        const evaluation = activeEvaluations.get(evaluationId);
        if (evaluation) {
          evaluation.conversationHistory.push(message);
          evaluation.currentCost = service.currentCost;
          evaluation.lastUpdate = new Date();
          evaluation.currentIteration = service.currentIteration;
        }
      },
      (summary) => {
        const evaluation = activeEvaluations.get(evaluationId);
        if (evaluation) {
          evaluation.status = 'completed';
          evaluation.finalSummary = summary;
          evaluation.completedAt = new Date();
          evaluation.totalCost = summary.metadata?.totalCost || service.currentCost;
        }
      },
      (partialResult) => {
        const evaluation = activeEvaluations.get(evaluationId);
        if (evaluation) {
          evaluation.partialResult = partialResult;
        }
      }
    ).catch((error) => {
      console.error('Evaluation error:', error);
      const evaluation = activeEvaluations.get(evaluationId);
      if (evaluation) {
        evaluation.status = 'error';
        evaluation.error = error.message;
        evaluation.errorAt = new Date();
      }
    });

  } catch (error) {
    console.error('Error starting evaluation:', error);
    res.status(500).json({ error: 'Failed to start evaluation' });
  }
});

// Get evaluation status endpoint
app.get('/api/evaluate/:evaluationId', (req, res) => {
  try {
    const { evaluationId } = req.params;
    const evaluation = activeEvaluations.get(evaluationId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    const response = {
      evaluationId,
      status: evaluation.status,
      conversationHistory: evaluation.conversationHistory,
      currentCost: evaluation.currentCost,
      budget: evaluation.budget,
      startedAt: evaluation.startedAt,
      idea: evaluation.idea
    };

    if (evaluation.currentIteration) {
      response.currentIteration = evaluation.currentIteration;
    }

    if (evaluation.partialResult) {
      response.partialResult = evaluation.partialResult;
    }

    if (evaluation.finalSummary) {
      response.finalSummary = evaluation.finalSummary;
      response.completedAt = evaluation.completedAt;
      response.totalCost = evaluation.totalCost;
    }

    if (evaluation.error) {
      response.error = evaluation.error;
      response.errorAt = evaluation.errorAt;
    }

    if (evaluation.lastUpdate) {
      response.lastUpdate = evaluation.lastUpdate;
    }

    res.json(response);
  } catch (error) {
    console.error('Error getting evaluation status:', error);
    res.status(500).json({ error: 'Failed to get evaluation status' });
  }
});

// Stop evaluation endpoint
app.post('/api/evaluate/:evaluationId/stop', (req, res) => {
  try {
    const { evaluationId } = req.params;
    const evaluation = activeEvaluations.get(evaluationId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    evaluation.service.stop();
    evaluation.status = 'stopped';
    evaluation.stoppedAt = new Date();

    res.json({ 
      evaluationId,
      status: 'stopped',
      message: 'Evaluation stopped',
      totalCost: evaluation.service.currentCost
    });
  } catch (error) {
    console.error('Error stopping evaluation:', error);
    res.status(500).json({ error: 'Failed to stop evaluation' });
  }
});

// Get evaluation statistics endpoint
app.get('/api/evaluate/:evaluationId/stats', (req, res) => {
  try {
    const { evaluationId } = req.params;
    const evaluation = activeEvaluations.get(evaluationId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    const stats = {
      evaluationId,
      budget: evaluation.budget,
      currentCost: evaluation.currentCost,
      budgetUsed: ((evaluation.currentCost / evaluation.budget) * 100).toFixed(1),
      status: evaluation.status,
      iterations: evaluation.currentIteration || 0,
      maxIterations: 5,
      startedAt: evaluation.startedAt,
      duration: evaluation.completedAt 
        ? Math.round((evaluation.completedAt - evaluation.startedAt) / 1000)
        : Math.round((new Date() - evaluation.startedAt) / 1000),
      messagesCount: evaluation.conversationHistory.length
    };

    if (evaluation.completedAt) {
      stats.completedAt = evaluation.completedAt;
    }

    res.json(stats);
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../dist/index.html'));
  });
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// Cleanup old evaluations every hour
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  
  for (const [id, evaluation] of activeEvaluations.entries()) {
    if (evaluation.startedAt < oneHourAgo && evaluation.status !== 'active') {
      activeEvaluations.delete(id);
      console.log(`Removed old evaluation: ${id}`);
    }
  }
}, 60 * 60 * 1000);

// Generate unique evaluation ID
function generateEvaluationId() {
  return 'eval_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 LangChain startup evaluation active`);
});

module.exports = app; 