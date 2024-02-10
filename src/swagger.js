const swaggerJsdoc = require('swagger-jsdoc');

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'API Pessoas',
            version: '1.0.0',
            description: 'API para cadastrar, listar, atualizar e excluir pessoas.',
        },
    },
    apis: ['src/API.js'], 
};

const specs = swaggerJsdoc(options);

module.exports = specs;
