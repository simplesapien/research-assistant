const express = require('express');
const router = express.Router();
const db = require('../services/database');
const aiService = require('../services/ai');

// Get all tools
router.get('/', async (req, res) => {
  // Temporary debug logging
  console.log('Auth header:', req.headers.authorization);
  console.log('User from req:', req.user);

  try {
    const tools = await db.getAllTools();
    res.json(tools);
  } catch (error) {
    console.error('Error fetching tools:', error);
    res.status(500).json({ error: 'Failed to fetch tools' });
  }
});

// Add new tool
router.post('/', async (req, res) => {
  try {
    const toolData = req.body;
    
    // Generate embedding for the new tool
    const textForEmbedding = `${toolData.name} ${toolData.description} ${toolData.category}`;
    const embedding = await aiService.generateEmbedding(textForEmbedding);
    
    const result = await db.createTool({
      ...toolData,
      embedding,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error creating tool:', error);
    res.status(500).json({ error: 'Failed to add tool' });
  }
});

// Update tool
router.put('/:id', async (req, res) => {
  try {
    const toolData = req.body;
    
    // Generate new embedding if name, description, or category changed
    const textForEmbedding = `${toolData.name} ${toolData.description} ${toolData.category}`;
    const embedding = await aiService.generateEmbedding(textForEmbedding);
    
    const result = await db.updateTool(req.params.id, {
      ...toolData,
      embedding,
      updatedAt: new Date()
    });
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error updating tool:', error);
    res.status(500).json({ error: 'Failed to update tool' });
  }
});

// Delete tool
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.deleteTool(req.params.id);
    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting tool:', error);
    res.status(500).json({ error: 'Failed to delete tool' });
  }
});

module.exports = router;