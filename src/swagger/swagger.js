// src/swagger/swagger.js
export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'EmpleadosPF API',
    version: '1.0.0',
    description: 'API de empleados y autenticación',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Employee: {
        type: 'object',
        properties: {
          emp_no: { type: 'integer', example: 10001 },
          birth_date: { type: 'string', format: 'date', example: '1990-05-10' },
          first_name: { type: 'string', example: 'Mary' },
          last_name: { type: 'string', example: 'Reyes' },
          gender: { type: 'string', enum: ['M','F'], example: 'F' },
          hire_date: { type: 'string', format: 'date', example: '2020-01-15' },
        },
      },
      EmployeeCreate: {
        type: 'object',
        required: ['birth_date', 'first_name', 'last_name', 'gender', 'hire_date'],
        properties: {
          birth_date: { type: 'string', format: 'date' },
          first_name: { type: 'string' },
          last_name: { type: 'string' },
          gender: { type: 'string', enum: ['M','F'] },
          hire_date: { type: 'string', format: 'date' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Healthcheck',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    db: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
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
                  password: { type: 'string', example: '123456' },
                },
              },
            },
          },
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
                        name: { type: 'string', example: 'Mary Reyes' },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Faltan credenciales' },
          '401': { description: 'Credenciales inválidas' },
          '403': { description: 'Acceso deshabilitado' },
          '500': { description: 'Error del servidor' },
        },
      },
    },

    // --- Employees ---
    '/api/employees': {
      get: {
        tags: ['Employees'],
        summary: 'Listar empleados',
        parameters: [
          { in: 'query', name: 'first_name', schema: { type: 'string' } },
          { in: 'query', name: 'last_name',  schema: { type: 'string' } },
          { in: 'query', name: 'gender',     schema: { type: 'string', enum: ['M','F'] } },
          { in: 'query', name: 'birth_date', schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'hire_date',  schema: { type: 'string', format: 'date' } },
          { in: 'query', name: 'limit',  schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { in: 'query', name: 'offset', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: { '200': { description: 'OK' } },
      },
      post: {
        tags: ['Employees'],
        summary: 'Crear empleado',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeCreate' } } },
        },
        responses: {
          '201': { description: 'Creado' },
          '400': { description: 'Datos inválidos' },
          '409': { description: 'Conflicto (emp_no duplicado)' },
          '500': { description: 'DB error' },
        },
      },
    },

    '/api/employees/search': {
      get: {
        tags: ['Employees'],
        summary: 'Búsqueda rápida por nombre/apellido',
        parameters: [
          { in: 'query', name: 'q', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'limit', schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'Falta q' } },
      },
    },

    '/api/employees/departments': {
      get: { tags: ['Employees'], summary: 'Catálogo de departamentos', responses: { '200': { description: 'OK' } } },
    },

    '/api/employees/{dept_no}/employees': {
      get: {
        tags: ['Employees'],
        summary: 'Empleados actuales por departamento',
        parameters: [
          { in: 'path', name: 'dept_no', required: true, schema: { type: 'string', example: 'd005' } },
          { in: 'query', name: 'limit',  schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
          { in: 'query', name: 'offset', schema: { type: 'integer', minimum: 0, default: 0 } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'dept_no inválido' } },
      },
    },

    // Bloque unificado para evitar colisiones y asegurar que se muestren GET/PUT/DELETE
    '/api/employees/{emp_no}': {
      get: {
        tags: ['Employees'],
        summary: 'Obtener empleado por ID',
        parameters: [{ in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '400': { description: 'emp_no inválido' }, '404': { description: 'No encontrado' } },
      },
      put: {
        tags: ['Employees'],
        summary: 'Actualizar empleado',
        parameters: [{ in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/EmployeeCreate' } } },
        },
        responses: {
          '200': { description: 'Actualizado' },
          '400': { description: 'Datos inválidos' },
          '404': { description: 'No encontrado' },
          '500': { description: 'DB error' },
        },
      },
      delete: {
        tags: ['Employees'],
        summary: 'Eliminar empleado',
        parameters: [{ in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': { description: 'Eliminado' },
          '404': { description: 'No encontrado' },
          '409': { description: 'Tiene registros relacionados' },
          '500': { description: 'DB error' },
        },
      },
    },

    '/api/employees/{emp_no}/full': {
      get: {
        tags: ['Employees'],
        summary: 'Detalle extendido (salario/título/depto actuales)',
        parameters: [{ in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } }],
        responses: { '200': { description: 'OK' }, '400': { description: 'emp_no inválido' }, '404': { description: 'No encontrado' } },
      },
    },

    '/api/employees/{emp_no}/salary': {
      get: {
        tags: ['Employees'],
        summary: 'Salario (actual o historial)',
        parameters: [
          { in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } },
          { in: 'query', name: 'current', schema: { type: 'string', enum: ['0','1','true','false'] } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'emp_no inválido' } },
      },
    },

    '/api/employees/{emp_no}/titles': {
      get: {
        tags: ['Employees'],
        summary: 'Títulos (actual o historial)',
        parameters: [
          { in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } },
          { in: 'query', name: 'current', schema: { type: 'string', enum: ['0','1','true','false'] } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'emp_no inválido' } },
      },
    },

    '/api/employees/{emp_no}/departments': {
      get: {
        tags: ['Employees'],
        summary: 'Departamentos del empleado (actual o historial)',
        parameters: [
          { in: 'path', name: 'emp_no', required: true, schema: { type: 'integer' } },
          { in: 'query', name: 'current', schema: { type: 'string', enum: ['0','1','true','false'] } },
        ],
        responses: { '200': { description: 'OK' }, '400': { description: 'emp_no inválido' } },
      },
    },
  },
};