// routes/handler.js
const admin = require('firebase-admin');
const db = admin.firestore();
const argon2 = require('argon2');

const jwt = require('jsonwebtoken');
// Secret key for JWT (store this securely, e.g., in environment variables)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authentication
const registerUser = async (request, h) => {
    try {
        const { userName, email, password, gender, status, phoneNumber, dateOfBirth } = request.payload;

        // Check if the user already exists
            const userSnapshot = await db.collection('users').where('email', '==', email).get();
            if (!userSnapshot.empty) {
                return h.response({ error: 'User already exists' }).code(409);
            }

            // Hash the password
            const hashedPassword = await argon2.hash(password);

            // Save the user to Firestore
            const newUser = await db.collection('users').add({
                userName,
                email,
                password: hashedPassword, // Store hashed password
                gender,
                status,
                phoneNumber,
                dateOfBirth
            });

            return h.response({ message: 'User created successfully' }).code(201);
    } catch (error) {
        console.error(error);
        return h.response({ error: 'Unable to create user' }).code(500);
    }
}

const loginUser = async (request, h) => {
    try {
        const { email, password } = request.payload;

        // Find user by email
        const userSnapshot = await db.collection('users').where('email', '==', email).get();
        if (userSnapshot.empty) {
            return h.response({ error: 'Invalid email or password' }).code(401);
        }

        // Extract user data
        const user = userSnapshot.docs[0].data();

        // Verify the password using Argon2
        const isValidPassword = await argon2.verify(user.password, password);
        if (!isValidPassword) {
            return h.response({ error: 'Invalid email or password' }).code(401);
        }

        // Generate a JWT token
        const token = jwt.sign(
            { id: userSnapshot.docs[0].id, email: user.email },
            JWT_SECRET,
            { expiresIn: '1h' } // Token expires in 1 hour
        );

        return h.response({ token, message: 'Login successful' }).code(200);
    } catch (error) {
        console.error(error);
        return h.response({ error: 'Unable to login' }).code(500);
    }
}

// Delete a user
const deleteUser = async (request, h) => {
    try {
        const { id } = request.params;
        await db.collection('users').doc(id).delete();
        return h.response({ message: 'User deleted' }).code(200);
    } catch (error) {
        console.error(error);
        return h.response({ error: 'Unable to delete user' }).code(500);
    }
}

// Get all users
const getAllUsers = async (request, h) => {
    try {
        const users = [];
        const snapshot = await db.collection('users').get();
        snapshot.forEach((doc) => {
            users.push({ id: doc.id, ...doc.data() });
        });
        return h.response(users).code(200);
    } catch (error) {
        console.error(error);
        return h.response({ error: 'Unable to fetch users' }).code(500);
    }
}

// Users


module.exports = {
    deleteUser, registerUser, getAllUsers, loginUser
}