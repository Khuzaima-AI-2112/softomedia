import express from 'express';
import { Firestore } from '@google-cloud/firestore';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth, requireRole } from '../middleware/auth.js';
import {
    generateInviteToken,
    getInviteExpirationDate,
    isValidEmail,
    sendInvitationEmail,
    sanitizeUser
} from '../utils/helpers.js';
import { userRepository } from '../repositories/UserRepository.js';

const router = express.Router();
const firestore = new Firestore();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-prod';

/**
 * POST /api/users/invite
 * Send invitation to new user (retailer/brand/admin)
 * Auth: Admin only
 */
router.post('/invite', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { email, role, name, business_name } = req.body;

        // Validation
        if (!email || !role || !name) {
            return res.status(400).json({
                error: 'Missing required fields: email, role, name'
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        if (!['retailer', 'brand', 'admin'].includes(role)) {
            return res.status(400).json({
                error: 'Invalid role. Must be: retailer, brand, or admin'
            });
        }

        // Check if user already exists
        const existingUserSnapshot = await firestore
            .collection('users')
            .where('email', '==', email)
            .get();

        if (!existingUserSnapshot.empty) {
            return res.status(409).json({
                error: 'User with this email already exists'
            });
        }

        // Check if invitation already exists and is pending
        const existingInviteSnapshot = await firestore
            .collection('invitations')
            .where('email', '==', email)
            .where('status', '==', 'pending')
            .get();

        if (!existingInviteSnapshot.empty) {
            return res.status(409).json({
                error: 'Pending invitation already exists for this email'
            });
        }

        // Generate secure token
        const token = generateInviteToken();
        const expiresAt = getInviteExpirationDate();

        // Create invitation
        const invitationData = {
            email,
            role,
            invited_by_user_id: req.user.uid,
            metadata: {
                name,
                business_name: business_name || null
            },
            token,
            status: 'pending',
            expires_at: expiresAt,
            created_at: new Date().toISOString(),
            accepted_at: null
        };

        const invitationRef = await firestore.collection('invitations').add(invitationData);

        // Send invitation email
        await sendInvitationEmail({
            email,
            name,
            business_name,
            token,
            role
        });

        res.status(201).json({
            invitation_id: invitationRef.id,
            email,
            role,
            email_sent: true,
            expires_at: expiresAt
        });

    } catch (error) {
        console.error('Invitation error:', error);
        res.status(500).json({ error: 'Failed to send invitation' });
    }
});

/**
 * POST /api/users/accept-invitation
 * Accept invitation and create user account
 * Auth: None (uses invitation token)
 */
router.post('/accept-invitation', async (req, res) => {
    try {
        const { token, password, name } = req.body;

        if (!token || !password || !name) {
            return res.status(400).json({
                error: 'Missing required fields: token, password, name'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                error: 'Password must be at least 8 characters'
            });
        }

        // Find invitation by token
        const invitationsSnapshot = await firestore
            .collection('invitations')
            .where('token', '==', token)
            .where('status', '==', 'pending')
            .get();

        if (invitationsSnapshot.empty) {
            return res.status(404).json({
                error: 'Invalid or expired invitation'
            });
        }

        const invitationDoc = invitationsSnapshot.docs[0];
        const invitation = invitationDoc.data();

        // Check expiration
        if (new Date(invitation.expires_at) < new Date()) {
            await invitationDoc.ref.update({ status: 'expired' });
            return res.status(400).json({ error: 'Invitation has expired' });
        }

        // Hash password
        const passwordHash = await bcrypt.hash(password, 10);

        // Create user
        const userData = {
            email: invitation.email,
            password_hash: passwordHash,
            role: invitation.role,
            name: name,
            linked_entity_id: null, // Will be set when creating retailer/brand
            status: 'active',
            created_at: new Date().toISOString(),
            last_login: new Date().toISOString()
        };

        const userRef = await firestore.collection('users').add(userData);
        const userId = userRef.id;

        // Create linked entity based on role
        let linkedEntityId = null;

        if (invitation.role === 'retailer') {
            const retailerData = {
                owner_user_id: userId,
                business_name: invitation.metadata.business_name || 'My Business',
                contact_person: name,
                email: invitation.email,
                phone: '',
                address: {},
                screens_deployed: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const retailerRef = await firestore.collection('retailers').add(retailerData);
            linkedEntityId = retailerRef.id;

        } else if (invitation.role === 'brand') {
            const brandData = {
                owner_user_id: userId,
                company_name: invitation.metadata.business_name || 'My Company',
                contact_person: name,
                email: invitation.email,
                phone: '',
                billing_address: {},
                tax_id: '',
                active_campaigns: 0,
                total_budget: 0,
                spent_to_date: 0,
                status: 'active',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const brandRef = await firestore.collection('brands').add(brandData);
            linkedEntityId = brandRef.id;
        }

        // Update user with linked entity ID
        if (linkedEntityId) {
            await userRef.update({ linked_entity_id: linkedEntityId });
        }

        // Mark invitation as accepted
        await invitationDoc.ref.update({
            status: 'accepted',
            accepted_at: new Date().toISOString()
        });

        // Generate JWT token for immediate login
        const jwtToken = jwt.sign(
            {
                uid: userId,
                email: invitation.email,
                role: invitation.role,
                linked_entity_id: linkedEntityId
            },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.status(201).json({
            user_id: userId,
            role: invitation.role,
            linked_entity_id: linkedEntityId,
            token: jwtToken,
            message: 'Account created successfully'
        });

    } catch (error) {
        console.error('Accept invitation error:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

/**
 * POST /api/users
 * Direct creation of user (by Admin/SuperAdmin)
 */
router.post('/', requireAuth, requireRole(['admin', 'superadmin']), async (req, res) => {
    try {
        const { email, role, name, linked_entity_id } = req.body;

        if (!email || !role || !name) {
            return res.status(400).json({ error: 'Missing required fields: email, role, name' });
        }

        const normalizeRole = role === 'advertiser' ? 'brand' : role;

        if (!['retailer', 'brand', 'admin', 'superadmin', 'contentmanager'].includes(normalizeRole)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        if (normalizeRole === 'brand' && !linked_entity_id) {
            return res.status(400).json({ error: 'Role advertiser requires linked_entity_id' });
        }

        const existing = await userRepository.findByEmail(email);
        if (existing) {
            return res.status(409).json({ error: 'User with this email already exists' });
        }

        const newDocRef = firestore.collection('users').doc();
        const userData = {
            email,
            role: normalizeRole,
            name,
            linked_entity_id: linked_entity_id || null,
            status: 'active',
            password_hash: '',
            last_login: null
        };

        const createdUser = await userRepository.create(newDocRef.id, userData);

        res.status(201).json(sanitizeUser(createdUser));

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

/**
 * GET /api/users
 * List all users with optional role filtering
 * Auth: Admin only
 */
router.get('/', requireAuth, requireRole(['admin']), async (req, res) => {
    try {
        const { role, status } = req.query;

        let query = firestore.collection('users');

        if (role) {
            query = query.where('role', '==', role);
        }

        if (status) {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();
        const users = [];

        for (const doc of snapshot.docs) {
            const user = { id: doc.id, ...doc.data() };

            // Fetch linked entity details
            if (user.linked_entity_id) {
                if (user.role === 'retailer') {
                    const retailerDoc = await firestore
                        .collection('retailers')
                        .doc(user.linked_entity_id)
                        .get();

                    if (retailerDoc.exists) {
                        const retailerData = retailerDoc.data();
                        user.business_name = retailerData.business_name;
                        user.screens_deployed = retailerData.screens_deployed;
                    }
                } else if (user.role === 'brand') {
                    const brandDoc = await firestore
                        .collection('brands')
                        .doc(user.linked_entity_id)
                        .get();

                    if (brandDoc.exists) {
                        const brandData = brandDoc.data();
                        user.business_name = brandData.company_name;
                        user.active_campaigns = brandData.active_campaigns;
                    }
                }
            }

            users.push(sanitizeUser(user));
        }

        res.json({
            users,
            total: users.length
        });

    } catch (error) {
        console.error('List users error:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

/**
 * GET /api/users/:userId
 * Get user details
 * Auth: User themselves or Admin
 */
router.get('/:userId', requireAuth, async (req, res) => {
    try {
        const { userId } = req.params;

        // Check permissions
        if (req.user.uid !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }

        const userDoc = await firestore.collection('users').doc(userId).get();

        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = { id: userDoc.id, ...userDoc.data() };
        res.json({ user: sanitizeUser(user) });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ error: 'Failed to fetch user' });
    }
});

/**
 * DELETE /api/users/:userId
 * Soft delete a user
 * Auth: Admin only
 */
router.delete('/:userId', requireAuth, requireRole(['admin', 'superadmin']), async (req, res) => {
    try {
        const { userId } = req.params;

        // Ensure user exists
        const userDoc = await firestore.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Soft delete: update status to inactive
        await firestore.collection('users').doc(userId).update({
            status: 'inactive',
            updated_at: new Date().toISOString()
        });

        res.json({ message: 'User deleted successfully', id: userId });
    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

export default router;
