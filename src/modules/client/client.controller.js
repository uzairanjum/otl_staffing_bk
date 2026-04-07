const clientService = require('./client.service');
const { AppError } = require('../../common/middleware/error.middleware');

class ClientController {
  async getClients(req, res, next) {
    try {
      const clients = await clientService.getClients(req.company_id);
      res.json(clients);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createClient(req, res, next) {
    try {
      const client = await clientService.createClient(req.company_id, req.body);
      res.status(201).json(client);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getClient(req, res, next) {
    try {
      const client = await clientService.getClient(req.params.id, req.company_id);
      res.json(client);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateClient(req, res, next) {
    try {
      const client = await clientService.updateClient(req.params.id, req.company_id, req.body);
      res.json(client);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteClient(req, res, next) {
    try {
      await clientService.deleteClient(req.params.id, req.company_id);
      res.json({ message: 'Client deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async getRepresentatives(req, res, next) {
    try {
      const representatives = await clientService.getRepresentatives(req.params.id, req.company_id);
      res.json(representatives);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async createRepresentative(req, res, next) {
    try {
      const result = await clientService.createRepresentative(req.params.id, req.company_id, req.body);
      res.status(201).json(result);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async updateRepresentative(req, res, next) {
    try {
      const representative = await clientService.updateRepresentative(req.params.id, req.params.repId, req.company_id, req.body);
      res.json(representative);
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }

  async deleteRepresentative(req, res, next) {
    try {
      await clientService.deleteRepresentative(req.params.id, req.params.repId, req.company_id);
      res.json({ message: 'Representative deleted successfully' });
    } catch (error) {
      next(new AppError(error.message, error.statusCode || 500));
    }
  }
}

module.exports = new ClientController();
