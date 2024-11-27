const { deleteUser, registerUser, getAllUsers, loginUser } = require('./handler');

module.exports = [
    // Get All Users
    {
        method: 'GET',
        path: '/users',
        handler: getAllUsers
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

    // Delete a User
    {
        method: 'DELETE',
        path: '/users/{id}',
        handler: deleteUser
    },
];
