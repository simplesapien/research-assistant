const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const toolsRouter = require('./routes/tools');
const chatRouter = require('./routes/chat');
const insightsRouter = require('./routes/insights');
const db = require('./services/database');
const searchService = require('./services/search');
const authRouter = require('./routes/auth');
const authMiddleware = require('./middleware/auth');
const requestLogger = require('./middleware/requestLogger');

const app = express();

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

app.use(requestLogger);

// Debug logging in development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Auth routes (unprotected)
app.use('/api/auth', authRouter);

// Protected search endpoint
app.post('/search-tools', authMiddleware, async (req, res) => {
    const { 
        query, 
        filters = {}, 
        searchType = 'hybrid',
        limit = 5,
        threshold = 0.7
    } = req.body;
    
    try {
        const results = await searchService.searchTools(query, {
            searchType,
            filters,
            limit,
            threshold
        });

        res.json({
            results,
            searchMetadata: {
                type: searchType,
                appliedFilters: filters,
                resultCount: results.length
            }
        });
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ 
            error: 'Search failed',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// Protected routes
app.use('/api/tools', authMiddleware, toolsRouter);
app.use('/api/insights', authMiddleware, insightsRouter);
app.use('/api/chat', authMiddleware, chatRouter);

const learningService = require('./services/learning');
// Test route to check contents of insights collection
app.use('/test-insights', async (req, res) => {
  // I just want to see the contents of the insights collection
  // ALl of the insights. not ones that match a query
  const insights = await learningService.findAllInsights();
  res.json(insights);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  
  // Handle specific auth errors
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  
  // Generic error response
  res.status(500).json({ 
    error: 'Something broke!',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 3000;

async function initializeServices() {
  try {
    // Connect to database first
    await db.connect();
    
    // Initialize auth service with database instance
    const authService = require('./services/auth');
    await authService.initialize(db.getDb());
    
    // Initialize search service
    await searchService.initialize();
    
    console.log('All services initialized successfully');
  } catch (error) {
    console.error('Failed to initialize services:', error);
    process.exit(1);
  }
}

initializeServices().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}).catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

module.exports = app;