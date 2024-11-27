const userRoutes = require('./userRoutes');

module.exports = {
    name: 'routes',
    register: async (server) => {
        server.route([...userRoutes]);
    },
};
