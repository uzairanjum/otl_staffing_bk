const express = require('express');
const router = express.Router();
const clientController = require('./client.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/clients
 * @description Get all clients for the company
 * @group Clients - Client management
 * @security BearerAuth
 * @returns {array} 200 - List of clients
 * @example response - 200
 * [
 *   {
 *     "id": "550e8400-e29b-41d4-a716-446655440001",
 *     "name": "Acme Events",
 *     "email": "contact@acmeevents.com",
 *     "phone": "+1234567890",
 *     "address": "123 Event St, New York, NY",
 *     "status": "active"
 *   }
 * ]
 */
router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', clientController.getClients);

/**
 * @route POST /api/clients
 * @description Create a new client
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} name.body.required - Client name
 * @param {string} email.body - Client email
 * @param {string} phone.body - Client phone
 * @param {string} address.body - Client address
 * @returns {object} 201 - Client created
 * @example request
 * {
 *   "name": "Acme Events LLC",
 *   "email": "contact@acmeevents.com",
 *   "phone": "+1234567890",
 *   "address": "123 Event Street, New York, NY 10001"
 * }
 */
router.post('/', validate(schemas.client), clientController.createClient);

/**
 * @route GET /api/clients/:id
 * @description Get client details with representatives
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @returns {object} 200 - Client details with representatives
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440001",
 *   "name": "Acme Events",
 *   "email": "contact@acmeevents.com",
 *   "phone": "+1234567890",
 *   "status": "active",
 *   "representatives": [
 *     {
 *       "id": "550e8400-e29b-41d4-a716-446655440002",
 *       "first_name": "John",
 *       "last_name": "Smith",
 *       "email": "john@acmeevents.com",
 *       "phone": "+1987654321"
 *     }
 *   ]
 * }
 */
router.get('/:id', clientController.getClient);

/**
 * @route PUT /api/clients/:id
 * @description Update client details
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @param {string} name.body - Client name
 * @param {string} email.body - Client email
 * @param {string} phone.body - Client phone
 * @param {string} address.body - Client address
 * @returns {object} 200 - Client updated
 */
router.put('/:id', clientController.updateClient);

/**
 * @route DELETE /api/clients/:id
 * @description Delete (deactivate) a client
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @returns {object} 200 - Client deleted
 * @example response - 200
 * {
 *   "message": "Client deleted successfully"
 * }
 */
router.delete('/:id', clientController.deleteClient);

/**
 * @route GET /api/clients/:id/representatives
 * @description Get all representatives for a client
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @returns {array} 200 - List of representatives
 */
router.get('/:id/representatives', clientController.getRepresentatives);

/**
 * @route POST /api/clients/:id/representatives
 * @description Create a new client representative
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @param {string} first_name.body.required - Representative first name
 * @param {string} last_name.body.required - Representative last name
 * @param {string} email.body.required - Representative email
 * @param {string} phone.body - Representative phone
 * @returns {object} 201 - Representative created
 * @example request
 * {
 *   "first_name": "John",
 *   "last_name": "Smith",
 *   "email": "john@acmeevents.com",
 *   "phone": "+1987654321"
 * }
 */
router.post('/:id/representatives', validate(schemas.clientRepresentative), clientController.createRepresentative);

/**
 * @route PUT /api/clients/:id/representatives/:repId
 * @description Update a client representative
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @param {string} repId.path.required - Representative ID
 * @returns {object} 200 - Representative updated
 */
router.put('/:id/representatives/:repId', clientController.updateRepresentative);

/**
 * @route DELETE /api/clients/:id/representatives/:repId
 * @description Delete a client representative
 * @group Clients - Client management
 * @security BearerAuth
 * @param {string} id.path.required - Client ID
 * @param {string} repId.path.required - Representative ID
 * @returns {object} 200 - Representative deleted
 * @example response - 200
 * {
 *   "message": "Representative deleted successfully"
 * }
 */
router.delete('/:id/representatives/:repId', clientController.deleteRepresentative);

module.exports = router;
