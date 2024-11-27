const { deleteUser, registerUser, getAllUsers, loginUser, getUser, getUserStatus } = require('./handler');
const { verifyJwtToken } = require('../middlewares/authMiddleware');

module.exports = [
    // Get All Users
    {
        method: 'GET',
        path: '/users',
        handler: getAllUsers
    },

    // Get a User
    {
        method: 'GET',
        path: '/user',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getUser
    },

    // Register a User
    {
        method: 'POST',
        path: '/users',
        handler: registerUser
    },

    // Login a User
    {
        method: 'POST',
        path: '/login',
        handler: loginUser
    },

    // Get a User Status
    {
        method: 'GET',
        path: '/user/status',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getUserStatus
    },

    // Delete a User
    {
        method: 'DELETE',
        path: '/users/{id}',
        handler: deleteUser
    },
];
