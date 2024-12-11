const { deleteUser, registerUser, getAllUsers, loginUser, getUser, getUserStatus, assignAndSendRoadmap, getUserCourses, getUserSubCourse, requestOTP, verifyOTP, sendQuesioner, deleteUserRoadmap, getAUserSubcourses } = require('./handler');
const { verifyJwtToken } = require('../middlewares/authMiddleware');

module.exports = [
    // Get All Users
    {
        method: 'GET',
        path: '/users',
        options:
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
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
        path: '/users/roadmaps',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: assignAndSendRoadmap
    },

    // Get a Course assigned to User
    {
        method: 'GET',
        path: '/users/courses',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getUserCourses
    },

    // Get a Sub Course assigned to User
    {
        method: 'GET',
        path: '/users/roadmaps/{roadmapId}/courses',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getUserSubCourse
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
   
    // OTP Request
    {
        method: 'POST',
        path: '/login/requestOTP',
        handler: requestOTP   
    },

    // OTP Verification
    {
        method: 'POST',
        path: '/login/verifyOTP',
        handler: verifyOTP
    },

    // Post User Roadmap
    {
        method: 'POST',
        path: '/user/roadmap',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: sendQuesioner
    },

    // Delete User Roadmap
    {
        method: 'DELETE',
        path: '/users/roadmaps',
        options: 
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: deleteUserRoadmap
    },

    // Get specific subcourse
    {
        method: 'GET',
        path: '/user/{roadmapName}/{courseName}/subcourses',
        options:
        {
            pre: [{ method: verifyJwtToken }], // Apply JWT middleware
        },
        handler: getAUserSubcourses
    },
];