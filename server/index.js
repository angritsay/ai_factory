const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { EvaluationService } = require('./services/EvaluationService');

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api', limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [process.env.FRONTEND_URL, 'https://ai-startup-evaluator.onrender.com']
    : ['http://localhost:5173', 'http://localhost:3000']
}));

app.use(express.json({ limit: '10mb' }));

// Store active evaluations (in production, use Redis)
const activeEvaluations = new Map();

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start evaluation endpoint
app.post('/api/evaluate', async (req, res) => {
  try {
    const { idea, apiKey, budget } = req.body;

    if (!idea || !idea.trim()) {
      return res.status(400).json({ error: 'Idea is required' });
    }

    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key is required' });
    }

    if (!budget || budget <= 0) {
      return res.status(400).json({ error: 'Valid budget is required' });
    }

    const evaluationId = generateEvaluationId();
    const service = new EvaluationService(apiKey, parseFloat(budget));
    
    activeEvaluations.set(evaluationId, {
      service,
      status: 'active',
      startedAt: new Date(),
      conversationHistory: [],
      currentCost: 0
    });

    res.json({ 
      evaluationId,
      status: 'started',
      message: 'Evaluation started successfully'
    });

    // Start evaluation in background
    service.evaluateIdea(
      idea,
      (step, message, cost) => {
        const evaluation = activeEvaluations.get(evaluationId);
        if (evaluation) {
          evaluation.conversationHistory.push(message);
          evaluation.currentCost += cost;
          evaluation.lastUpdate = new Date();
        }
      },
      (summary) => {
        const evaluation = activeEvaluations.get(evaluationId);
        if (evaluation) {
          evaluation.status = 'completed';
          evaluation.finalSummary = summary;
          evaluation.completedAt = new Date();
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
      startedAt: evaluation.startedAt
    };

    if (evaluation.partialResult) {
      response.partialResult = evaluation.partialResult;
    }

    if (evaluation.finalSummary) {
      response.finalSummary = evaluation.finalSummary;
      response.completedAt = evaluation.completedAt;
    }

    if (evaluation.error) {
      response.error = evaluation.error;
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
      message: 'Evaluation stopped successfully'
    });
  } catch (error) {
    console.error('Error stopping evaluation:', error);
    res.status(500).json({ error: 'Failed to stop evaluation' });
  }
});

// Continue evaluation endpoint
app.post('/api/evaluate/:evaluationId/continue', async (req, res) => {
  try {
    const { evaluationId } = req.params;
    const evaluation = activeEvaluations.get(evaluationId);

    if (!evaluation) {
      return res.status(404).json({ error: 'Evaluation not found' });
    }

    if (evaluation.status !== 'completed' && evaluation.status !== 'stopped') {
      return res.status(400).json({ error: 'Evaluation must be completed or stopped to continue' });
    }

    evaluation.status = 'active';
    evaluation.resumedAt = new Date();

    res.json({ 
      evaluationId,
      status: 'resumed',
      message: 'Evaluation resumed successfully'
    });

    // Continue evaluation in background
    evaluation.service.continueEvaluation(
      (step, message, cost) => {
        evaluation.conversationHistory.push(message);
        evaluation.currentCost += cost;
        evaluation.lastUpdate = new Date();
      },
      (summary) => {
        evaluation.status = 'completed';
        evaluation.finalSummary = summary;
        evaluation.completedAt = new Date();
      },
      (partialResult) => {
        evaluation.partialResult = partialResult;
      }
    ).catch((error) => {
      console.error('Continue evaluation error:', error);
      evaluation.status = 'error';
      evaluation.error = error.message;
    });

  } catch (error) {
    console.error('Error continuing evaluation:', error);
    res.status(500).json({ error: 'Failed to continue evaluation' });
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
  
  for (const [evaluationId, evaluation] of activeEvaluations.entries()) {
    if (evaluation.startedAt < oneHourAgo && 
        (evaluation.status === 'completed' || evaluation.status === 'error')) {
      activeEvaluations.delete(evaluationId);
    }
  }
}, 60 * 60 * 1000);

function generateEvaluationId() {
  return 'eval_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app; 