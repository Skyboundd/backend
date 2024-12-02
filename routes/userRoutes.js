const { deleteUser, registerUser, getAllUsers, loginUser, getUser, getUserStatus, sendRoadmap, getCourse, getSubCourse, requestOTP, verifyOTP } = require('./handler');
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

    // Send a Roadmap
    {
        method: 'POST',
        path: '/roadmap',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: sendRoadmap
    },

    // Get a Course
    {
        method: 'GET',
        path: '/roadmaps/{roadmapId}/courses',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getCourse
    },

    // Get a Sub Course
    {
        method: 'GET',
        path: '/roadmaps/{roadmapId}/courses/{courseId}/subcourses',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getSubCourse
    },

    /* Get Question
    {
        method: 'GET',
        path: '/roadmaps/{roadmapId}/courses/{courseId}/subcourses/{subcourseId}/questions',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getQuestion
    },
    */
   
    // OTP Verification
    {
        method: 'POST',
        path: '/login/requestOTP',
        handler: requestOTP   
    },

    {
        method: 'POST',
        path: '/login/verifyOTP',
        handler: verifyOTP
    }
];
