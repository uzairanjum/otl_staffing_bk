const Client = require('./Client');
const ClientRepresentative = require('./ClientRepresentative');
const User = require('../../common/models/User');
const { AppError } = require('../../common/middleware/error.middleware');
const { sendEmailWithTemplate } = require('../../config/email');
const { v4: uuidv4 } = require('uuid');

class ClientService {
  generateTempPassword() {
    return uuidv4().slice(0, 8) + 'A1!';
  }

  async getClients(companyId) {
    return Client.find({ company_id: companyId }).sort({ createdAt: -1 });
  }

  async createClient(companyId, data) {
    const client = await Client.create({
      ...data,
      company_id: companyId
    });
    return client;
  }

  async getClient(clientId, companyId) {
    const client = await Client.findOne({ _id: clientId, company_id: companyId });
    if (!client) {
      throw new AppError('Client not found', 404);
    }

    const representatives = await ClientRepresentative.find({ client_id: clientId });
    return { ...client.toObject(), representatives };
  }

  async updateClient(clientId, companyId, data) {
    const client = await Client.findOneAndUpdate(
      { _id: clientId, company_id: companyId },
      data,
      { new: true, runValidators: true }
    );
    if (!client) {
      throw new AppError('Client not found', 404);
    }
    return client;
  }

  async deleteClient(clientId, companyId) {
    const client = await Client.findOneAndUpdate(
      { _id: clientId, company_id: companyId },
      { status: 'inactive' },
      { new: true }
    );
    if (!client) {
      throw new AppError('Client not found', 404);
    }
    return client;
  }

  async getRepresentatives(clientId, companyId) {
    await this.getClient(clientId, companyId);
    return ClientRepresentative.find({ client_id: clientId });
  }

  async createRepresentative(clientId, companyId, data) {
    await this.getClient(clientId, companyId);

    const tempPassword = this.generateTempPassword();

    const representative = await ClientRepresentative.create({
      ...data,
      client_id: clientId,
      company_id: companyId
    });

    const user = await User.create({
      company_id: companyId,
      email: data.email.toLowerCase(),
      password_hash: tempPassword,
      role: 'client_rep',
      client_rep_id: representative._id,
      first_login: true
    });

    await sendEmailWithTemplate(data.email, 'Welcome to OTL Staffing', 'invitation', {
      name: `${data.first_name} ${data.last_name}`,
      email: data.email,
      tempPassword: tempPassword,
      loginUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    });

    return { representative, user };
  }

  async updateRepresentative(clientId, repId, companyId, data) {
    await this.getClient(clientId, companyId);

    const representative = await ClientRepresentative.findOneAndUpdate(
      { _id: repId, client_id: clientId },
      data,
      { new: true, runValidators: true }
    );
    if (!representative) {
      throw new AppError('Representative not found', 404);
    }
    return representative;
  }

  async deleteRepresentative(clientId, repId, companyId) {
    await this.getClient(clientId, companyId);

    const representative = await ClientRepresentative.findOneAndDelete({ _id: repId, client_id: clientId });
    if (!representative) {
      throw new AppError('Representative not found', 404);
    }

    await User.deleteOne({ client_rep_id: repId });

    return { message: 'Representative deleted successfully' };
  }
}

module.exports = new ClientService();
