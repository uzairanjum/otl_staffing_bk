const express = require('express');
const router = express.Router();
const clientController = require('./client.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

router.use(authenticate);
router.use(requireRole('admin'));

router.get('/', clientController.getClients);
router.post('/', validate(schemas.client), clientController.createClient);
router.get('/:id', clientController.getClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);
router.get('/:id/representatives', clientController.getRepresentatives);
router.post('/:id/representatives', validate(schemas.clientRepresentative), clientController.createRepresentative);
router.put('/:id/representatives/:repId', clientController.updateRepresentative);
router.delete('/:id/representatives/:repId', clientController.deleteRepresentative);

module.exports = router;
