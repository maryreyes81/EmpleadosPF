// src/swagger/swagger.js
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'EmpleadosPF API',
    version: '1.0.0',
    description: 'API de empleados y autenticación',
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local' }
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Healthcheck',
        responses: {
          '200': {
            description: 'OK',
            content: { 'application/json': { schema: { type: 'object', properties: {
              status: { type: 'string' },
              db: { type: 'string' }
            }}}}
          }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'mary.reyes@empresa.com' },
                  password: { type: 'string', example: '123456' }
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Login OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean', example: true },
                    user: {
                      type: 'object',
                      properties: {
                        emp_no: { type: 'integer', example: 1001 },
                        email: { type: 'string', example: 'mary.reyes@empresa.com' },
                        name: { type: 'string', example: 'Mary Reyes' }
                      }
                    }
                  }
                }
              }
            }
          },
          '400': { description: 'Faltan credenciales' },
          '401': { description: 'Credenciales inválidas' },
          '403': { description: 'Acceso deshabilitado' },
          '500': { description: 'Error del servidor' }
        }
      }
    }
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  }
};
