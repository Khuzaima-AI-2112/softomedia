// Repository Index
// Exports all repository instances as singletons

import { UserRepository } from './UserRepository.js';
import { AdRepository } from './AdRepository.js';
import { ScreenRepository } from './ScreenRepository.js';
import { ImpressionRepository } from './ImpressionRepository.js';

// Create singleton instances
export const userRepository = new UserRepository();
export const adRepository = new AdRepository();
export const screenRepository = new ScreenRepository();
export const impressionRepository = new ImpressionRepository();

// Export classes for testing
export {
    UserRepository,
    AdRepository,
    ScreenRepository,
    ImpressionRepository
};
