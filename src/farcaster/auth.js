// Auth - Farcaster authentication
// Handles server authentication with Farcaster credentials

import { getSDK, getUser, isInFarcaster } from './miniApp.js';

// ============================================
// CONFIGURATION
// ============================================

const SERVER_URL = import.meta.env?.VITE_SERVER_URL || 'ws://localhost:3001';
const AUTH_URL = import.meta.env?.VITE_AUTH_URL || 'http://localhost:3001';

let authToken = null;
let playerId = null;

// ============================================
// AUTHENTICATION
// ============================================

/**
 * Authenticate with game server using Farcaster credentials
 */
export async function authenticateWithServer() {
    const user = getUser();

    if (!user) {
        throw new Error('No Farcaster user available');
    }

    try {
        // In production: get signed message from Farcaster
        const sdk = getSDK();
        let signature = null;
        let message = null;

        if (sdk && sdk.actions.signIn) {
            try {
                const signInResult = await sdk.actions.signIn();
                signature = signInResult.signature;
                message = signInResult.message;
            } catch (e) {
                console.warn('SignIn not available, using basic auth');
            }
        }

        // Send auth request to server
        const response = await fetch(`${AUTH_URL}/auth`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fid: user.fid,
                username: user.username,
                displayName: user.displayName,
                signature,
                message
            })
        });

        if (!response.ok) {
            throw new Error(`Auth failed: ${response.status}`);
        }

        const data = await response.json();
        authToken = data.token;
        playerId = data.playerId;

        console.log('Authenticated with server:', playerId);

        return {
            token: authToken,
            playerId
        };

    } catch (error) {
        console.warn('Server auth failed, using local auth:', error.message);

        // Fallback: generate local credentials
        authToken = `local_${user.fid}_${Date.now()}`;
        playerId = `p_${user.fid}`;

        return {
            token: authToken,
            playerId
        };
    }
}

/**
 * Get current auth token
 */
export function getAuthToken() {
    return authToken;
}

/**
 * Get current player ID
 */
export function getPlayerId() {
    return playerId;
}

/**
 * Get WebSocket server URL
 */
export function getServerUrl() {
    return SERVER_URL;
}

/**
 * Check if authenticated
 */
export function isAuthenticated() {
    return authToken !== null;
}

/**
 * Clear authentication
 */
export function clearAuth() {
    authToken = null;
    playerId = null;
}

// ============================================
// TOKEN REFRESH (for long sessions)
// ============================================

let refreshInterval = null;

export function startTokenRefresh() {
    // Refresh token every 30 minutes
    refreshInterval = setInterval(async () => {
        if (authToken) {
            try {
                await authenticateWithServer();
            } catch (error) {
                console.warn('Token refresh failed:', error);
            }
        }
    }, 30 * 60 * 1000);
}

export function stopTokenRefresh() {
    if (refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
    }
}
