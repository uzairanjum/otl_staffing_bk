const express = require('express');
const router = express.Router();
const workerController = require('./worker.controller');
const { authenticate, requireRole } = require('../../common/middleware/auth.middleware');
const { validate, schemas } = require('../../common/middleware/validation.middleware');

/**
 * @route GET /api/me/onboarding/status
 * @description Get worker's current onboarding status
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @returns {object} 200 - Onboarding status details
 * @example response - 200
 * {
 *   "status": "onboarding",
 *   "onboarding_step": 3,
 *   "contract_signed": true
 * }
 */
router.use(authenticate);
router.use(requireRole('worker'));

router.get('/onboarding/status', workerController.getOnboardingStatus);

/**
 * @route PUT /api/me/onboarding/contract
 * @description Accept worker contract (Step 0)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {string} name.body.required - Worker's full name (typed to accept contract)
 * @returns {object} 200 - Contract accepted
 * @returns {object} 400 - Name does not match or contract already signed
 * @example request
 * {
 *   "name": "John Doe"
 * }
 * @example response - 200
 * {
 *   "id": "550e8400-e29b-41d4-a716-446655440002",
 *   "status": "onboarding",
 *   "onboarding_step": 1,
 *   "contract_signed": true,
 *   "contract_signed_at": "2024-01-15T10:00:00.000Z"
 * }
 */
router.put('/onboarding/contract', workerController.submitContract);

/**
 * @route PUT /api/me/onboarding/step-1
 * @description Submit basic info and address (Step 1)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {string} address_line1.body - Address line 1
 * @param {string} address_line2.body - Address line 2
 * @param {string} city.body - City
 * @param {string} state.body - State/Province
 * @param {string} postal_code.body - Postal code
 * @param {string} country.body - Country
 * @returns {object} 200 - Step completed, advances to step 2
 * @example request
 * {
 *   "address_line1": "123 Main Street",
 *   "address_line2": "Apt 4B",
 *   "city": "New York",
 *   "state": "NY",
 *   "postal_code": "10001",
 *   "country": "USA"
 * }
 */
router.put('/onboarding/step-1', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-2
 * @description Submit tax info and bank details (Step 2)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {string} tax_number.body - Tax number/UTR
 * @param {string} national_id.body - National ID
 * @param {string} bank_name.body - Bank name
 * @param {string} account_name.body - Account holder name
 * @param {string} account_number.body - Account number
 * @param {string} routing_number.body - Routing number
 * @returns {object} 200 - Step completed, advances to step 3
 * @example request
 * {
 *   "tax_number": "123456789",
 *   "national_id": "ABC123456",
 *   "bank_name": "Bank of America",
 *   "account_name": "John Doe",
 *   "account_number": "1234567890",
 *   "routing_number": "021000021"
 * }
 */
router.put('/onboarding/step-2', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-3
 * @description Submit emergency contact info (Step 3 - Optional)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {string} contact_name.body - Emergency contact name
 * @param {string} relationship.body - Relationship to worker
 * @param {string} phone.body - Contact phone number
 * @param {string} email.body - Contact email
 * @param {string} address_line1.body - Contact address line 1
 * @param {string} address_line2.body - Contact address line 2
 * @param {string} city.body - Contact city
 * @param {string} state.body - Contact state
 * @param {string} postal_code.body - Contact postal code
 * @param {string} country.body - Contact country
 * @returns {object} 200 - Step completed, advances to step 4
 * @example request
 * {
 *   "contact_name": "Jane Doe",
 *   "relationship": "spouse",
 *   "phone": "+1987654321",
 *   "email": "jane.doe@example.com"
 * }
 */
router.put('/onboarding/step-3', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-4
 * @description Submit role assignment and hourly rate (Step 4)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {string} company_role_id.body.required - Company role ID
 * @param {number} hourly_rate_override.body - Override default hourly rate
 * @returns {object} 200 - Step completed, advances to step 5
 * @example request
 * {
 *   "company_role_id": "550e8400-e29b-41d4-a716-446655440001",
 *   "hourly_rate_override": 18
 * }
 */
router.put('/onboarding/step-4', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-5
 * @description Submit working hours availability (Step 5)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {array} availability.body.required - Array of working hours for each day
 * @returns {object} 200 - Step completed, advances to step 6
 * @example request
 * {
 *   "availability": [
 *     { "day_of_week": 1, "start_time": "09:00", "end_time": "17:00" },
 *     { "day_of_week": 2, "start_time": "09:00", "end_time": "17:00" },
 *     { "day_of_week": 3, "start_time": "09:00", "end_time": "17:00" },
 *     { "day_of_week": 4, "start_time": "09:00", "end_time": "17:00" },
 *     { "day_of_week": 5, "start_time": "09:00", "end_time": "17:00" }
 *   ]
 * }
 */
router.put('/onboarding/step-5', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-6
 * @description Submit identity and address documents (Step 6)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {array} files.body - Array of file objects with file_type and file_url
 * @returns {object} 200 - Step completed, advances to step 7
 * @example request - Files uploaded via separate endpoint, this step confirms completion
 * {
 *   "files": [
 *     { "file_type": "proof_of_address", "file_url": "https://..." },
 *     { "file_type": "passport_front", "file_url": "https://..." },
 *     { "file_type": "profile_photo", "file_url": "https://..." }
 *   ]
 * }
 * @note Files should be uploaded using POST /api/workers/:id/files endpoint
 */
router.put('/onboarding/step-6', workerController.updateOnboardingStep);

/**
 * @route PUT /api/me/onboarding/step-7
 * @description Complete training requirements (Step 7 - Final step)
 * @group Onboarding - Worker onboarding flow
 * @security BearerAuth
 * @param {array} training_documents.body - Array of training document uploads
 * @returns {object} 200 - Onboarding completed, status changed to pending_approval
 * @example request
 * {
 *   "training_documents": [
 *     { "document_type": "safety_training", "file_url": "https://..." }
 *   ]
 * }
 * @note After this step, worker status changes to 'pending_approval' waiting for admin review
 */
router.put('/onboarding/step-7', workerController.updateOnboardingStep);

module.exports = router;
