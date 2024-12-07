// services/auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { ObjectId } = require('mongodb');

class AuthService {
    constructor() {
        this.collection = null;
    }

    async initialize(db) {
        if (this.collection) {
            return;
        }

        try {
            this.collection = db.collection('users');
            
            // Create indexes
            await this.collection.createIndex({ email: 1 }, { unique: true });
            await this.collection.createIndex({ username: 1 }, { unique: true });
            
            console.log('Auth service initialized successfully');
        } catch (error) {
            console.error('Auth service initialization failed:', error);
            throw error;
        }
    }

    async registerUser(userData) {
        try {
            const { email, password, username } = userData;

            // Validate input
            if (!email || !password || !username) {
                throw new Error('Missing required fields');
            }

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }

            // Check password strength
            if (password.length < 8) {
                throw new Error('Password must be at least 8 characters long');
            }

            // Check if user exists
            const existingUser = await this.collection.findOne({
                $or: [{ email: email.toLowerCase() }, { username }]
            });

            if (existingUser) {
                throw new Error(
                    existingUser.email === email.toLowerCase() 
                        ? 'Email already registered' 
                        : 'Username already taken'
                );
            }

            // Hash password
            const hashedPassword = await bcrypt.hash(password, 10);

            // Create user
            const result = await this.collection.insertOne({
                email: email.toLowerCase(),
                username,
                password: hashedPassword,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            // Generate token
            const token = this.generateToken(result.insertedId);

            return {
                token,
                user: {
                    id: result.insertedId,
                    email: email.toLowerCase(),
                    username
                }
            };
        } catch (error) {
            console.error('Registration error:', error);
            throw error;
        }
    }

    async loginUser(credentials) {
        try {
            const { email, password } = credentials;

            // Validate input
            if (!email || !password) {
                throw new Error('Email and password are required');
            }

            // Find user
            const user = await this.collection.findOne({ 
                email: email.toLowerCase() 
            });

            if (!user) {
                throw new Error('Invalid credentials');
            }

            // Verify password
            const isValid = await bcrypt.compare(password, user.password);
            if (!isValid) {
                throw new Error('Invalid credentials');
            }

            // Generate token
            const token = this.generateToken(user._id);

            return {
                token,
                user: {
                    id: user._id,
                    email: user.email,
                    username: user.username
                }
            };
        } catch (error) {
            console.error('Login error:', error);
            throw error;
        }
    }

    async verifyUser(userId) {
        try {
            if (!userId) {
                throw new Error('User ID is required');
            }

            const user = await this.collection.findOne(
                { _id: new ObjectId(userId) },
                { projection: { password: 0 } } // Exclude password from results
            );

            if (!user) {
                throw new Error('User not found');
            }

            return {
                id: user._id,
                email: user.email,
                username: user.username
            };
        } catch (error) {
            console.error('User verification error:', error);
            throw error;
        }
    }

    generateToken(userId) {
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET is not defined in environment variables');
        }

        return jwt.sign(
            { userId: userId.toString() },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );
    }

    verifyToken(token) {
        if (!token) {
            throw new Error('No token provided');
        }

        try {
            return jwt.verify(token, process.env.JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('Token has expired');
            }
            if (error.name === 'JsonWebTokenError') {
                throw new Error('Invalid token');
            }
            throw error;
        }
    }

    async updateUser(userId, updateData) {
        try {
            const updates = {
                ...updateData,
                updatedAt: new Date()
            };

            // If password is being updated, hash it
            if (updates.password) {
                updates.password = await bcrypt.hash(updates.password, 10);
            }

            const result = await this.collection.findOneAndUpdate(
                { _id: new ObjectId(userId) },
                { $set: updates },
                { returnDocument: 'after', projection: { password: 0 } }
            );

            if (!result) {
                throw new Error('User not found');
            }

            return {
                id: result._id,
                email: result.email,
                username: result.username
            };
        } catch (error) {
            console.error('Update user error:', error);
            throw error;
        }
    }
}

module.exports = new AuthService();