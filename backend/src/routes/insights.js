const express = require('express');
const router = express.Router();
const learningService = require('../services/learning');

// Get all insights
router.get('/', async (req, res) => {
  try {
    const insights = await learningService.findAllInsights();
    
    // Sort insights by date (newest first)
    const sortedInsights = insights.sort((a, b) => {
      const dateA = a.metadata?.createdAt || a.createdAt || new Date(0);
      const dateB = b.metadata?.createdAt || b.createdAt || new Date(0);
      return dateB - dateA;
    });

    // Format the response
    const formattedInsights = sortedInsights.map(insight => ({
      _id: insight._id,
      title: insight.type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      content: insight.content,
      type: insight.type,
      createdAt: insight.metadata?.createdAt || insight.createdAt,
      metadata: insight.metadata
    }));

    res.json(formattedInsights);
  } catch (error) {
    console.error('Error fetching insights:', error);
    res.status(500).json({ error: 'Failed to fetch insights' });
  }
});

// Add new insight
router.post('/', async (req, res) => {
  try {
    const result = await learningService.addInsight(
      req.body.content,
      req.body.type,
      { tags: req.body.tags }
    );
    res.json(result);
  } catch (error) {
    console.error('Error creating insight:', error);
    res.status(500).json({ error: 'Failed to add insight' });
  }
});

// Update insight
router.put('/:id', async (req, res) => {
  try {
    const result = await learningService.updateInsight(
      req.params.id,
      req.body.content,
      req.body.type
    );
    res.json(result);
  } catch (error) {
    console.error('Error updating insight:', error);
    res.status(500).json({ error: 'Failed to update insight' });
  }
});

// Delete insight
router.delete('/:id', async (req, res) => {
  try {
    await learningService.deleteInsight(req.params.id);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting insight:', error);
    res.status(500).json({ error: 'Failed to delete insight' });
  }
});

module.exports = router;
