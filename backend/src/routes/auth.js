// routes/auth.js
const express = require('express');
const router = express.Router();
const authService = require('../services/auth');

// Debug route
router.get('/test', (req, res) => {
    res.json({ message: 'Auth routes working' });
});

router.post('/login', async (req, res) => {
    try {
        const result = await authService.loginUser(req.body);
        res.json(result);
    } catch (error) {
        console.error('Login error:', error);
        res.status(401).json({ error: error.message });
    }
});

router.post('/register', async (req, res) => {
    try {
        const result = await authService.registerUser(req.body);
        res.json(result);
    } catch (error) {
        console.error('Registration error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Updated verify endpoint
router.get('/verify', async (req, res) => {
    console.log('Verify endpoint hit');
    try {
        const token = req.headers.authorization?.split(' ')[1];
        console.log('Token received:', token ? 'Yes' : 'No');
        
        if (!token) {
            return res.status(401).json({ error: 'No token provided' });
        }
        
        const decoded = authService.verifyToken(token);
        console.log('Token decoded:', decoded);

        // Get user data using the verified token
        const user = await authService.verifyUser(decoded.userId);
        
        // Send back the complete response
        res.json({ 
            valid: true, 
            user: user
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(401).json({ error: error.message });
    }
});

module.exports = router;