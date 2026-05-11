import crypto from 'crypto';

/**
 * Generate a secure random token for invitations
 * @returns {string} Secure random token
 */
export function generateInviteToken() {
    return crypto.randomBytes(32).toString('hex');
}

/**
 * Calculate invitation expiration date (7 days from now)
 * @returns {string} ISO timestamp
 */
export function getInviteExpirationDate() {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + 7);
    return expirationDate.toISOString();
}

/**
 * Validate email format
 * @param {string} email 
 * @returns {boolean}
 */
export function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Generate a temporary password for new users
 * @returns {string} Random password
 */
export function generateTempPassword() {
    return crypto.randomBytes(16).toString('base64').slice(0, 12);
}

/**
 * Send invitation email (placeholder until email provider is selected)
 * TODO: Integrate with SendGrid/AWS SES/Mailgun
 * 
 * @param {Object} invitation
 * @param {string} invitation.email
 * @param {string} invitation.name
 * @param {string} invitation.business_name
 * @param {string} invitation.token
 * @param {string} invitation.role
 * @returns {Promise<boolean>}
 */
export async function sendInvitationEmail(invitation) {
    console.log('📧 INVITATION EMAIL (Placeholder)');
    console.log('================================');
    console.log(`To: ${invitation.email}`);
    console.log(`Subject: You've been invited to SoftoMedia`);
    console.log(`\nHi ${invitation.name},\n`);
    console.log(`You've been invited to join SoftoMedia as a ${invitation.role}.`);

    if (invitation.business_name) {
        console.log(`Business: ${invitation.business_name}`);
    }

    console.log(`\nAccept your invitation: ${process.env.APP_URL || 'http://localhost:3000'}/accept-invite?token=${invitation.token}`);
    console.log(`\nThis invitation expires in 7 days.`);
    console.log('================================\n');

    // TODO: Replace with actual email service
    // const response = await sendgrid.send({
    //     to: invitation.email,
    //     from: 'noreply@softomedia.com',
    //     subject: 'You\'ve been invited to SoftoMedia',
    //     html: emailTemplate(invitation)
    // });

    return true; // Simulate success
}

/**
 * Format user data for safe return (remove sensitive fields)
 * @param {Object} user 
 * @returns {Object}
 */
export function sanitizeUser(user) {
    const { password_hash, password, ...safeUser } = user;
    return safeUser;
}

/**
 * Calculate retailer earnings for a given month
 * @param {string} retailerId 
 * @param {string} month - Format: YYYY-MM
 * @param {Object} firestore
 * @returns {Promise<number>}
 */
export async function calculateRetailerEarnings(retailerId, month, firestore) {
    try {
        // Get all screens for this retailer
        const screensSnapshot = await firestore
            .collection('screens')
            .where('retailer_id', '==', retailerId)
            .get();

        if (screensSnapshot.empty) {
            return 0;
        }

        let totalEarnings = 0;
        const RATE_PER_IMPRESSION = 0.21; // $0.21 per impression

        // For each screen, count impressions in the month
        for (const screenDoc of screensSnapshot.docs) {
            const screenId = screenDoc.id;

            // Query impressions subcollection for this month
            const startDate = new Date(`${month}-01`);
            const endDate = new Date(startDate);
            endDate.setMonth(endDate.getMonth() + 1);

            const impressionsSnapshot = await firestore
                .collection('screens')
                .doc(screenId)
                .collection('impressions')
                .where('timestamp', '>=', startDate.toISOString())
                .where('timestamp', '<', endDate.toISOString())
                .get();

            totalEarnings += impressionsSnapshot.size * RATE_PER_IMPRESSION;
        }

        return totalEarnings;
    } catch (error) {
        console.error('Error calculating earnings:', error);
        return 0;
    }
}
