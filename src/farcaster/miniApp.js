// Farcaster Mini App - SDK initialization and context
// Handles Farcaster integration for Warpcast

// ============================================
// FARCASTER SDK
// ============================================

let sdk = null;
let context = null;
let isInitialized = false;

/**
 * Initialize Farcaster Mini App SDK
 */
export async function initMiniApp() {
    if (isInitialized) {
        return context;
    }

    try {
        // Dynamic import of Farcaster SDK
        const farcasterModule = await import('https://esm.sh/@farcaster/frame-sdk@0.1.11');
        sdk = farcasterModule.sdk;

        // Get context (user info, etc.)
        context = await sdk.context;

        if (context && context.user) {
            console.log(`Farcaster user: ${context.user.username} (FID: ${context.user.fid})`);
        }

        // Signal that the app is ready
        await sdk.actions.ready();

        isInitialized = true;
        return context;

    } catch (error) {
        console.warn('Farcaster SDK not available (running outside Warpcast?):', error.message);

        // Return mock context for development
        context = {
            user: {
                fid: Math.floor(Math.random() * 1000000),
                username: `dev_user_${Date.now()}`,
                displayName: 'Dev User',
                pfpUrl: null
            }
        };

        isInitialized = true;
        return context;
    }
}

/**
 * Get current user info
 */
export function getUser() {
    if (!context || !context.user) {
        return null;
    }

    return {
        fid: context.user.fid,
        username: context.user.username,
        displayName: context.user.displayName || context.user.username,
        pfpUrl: context.user.pfpUrl
    };
}

/**
 * Get SDK instance
 */
export function getSDK() {
    return sdk;
}

/**
 * Check if running inside Farcaster
 */
export function isInFarcaster() {
    return sdk !== null && context !== null && context.user?.fid > 0;
}

// ============================================
// ACTIONS
// ============================================

/**
 * Open external URL (requires user confirmation in Farcaster)
 */
export async function openUrl(url) {
    if (sdk && sdk.actions.openUrl) {
        await sdk.actions.openUrl(url);
    } else {
        window.open(url, '_blank');
    }
}

/**
 * Share game result as a cast
 */
export async function shareResult(score, kills, deaths) {
    const text = `Just scored ${score} points in Bang Bang! 🎮\n${kills} kills, ${deaths} deaths\nK/D: ${deaths > 0 ? (kills / deaths).toFixed(2) : kills}\n\nPlay now:`;

    if (sdk && sdk.actions.composeCast) {
        await sdk.actions.composeCast({
            text,
            embeds: [window.location.href]
        });
    } else {
        // Fallback: copy to clipboard
        await navigator.clipboard.writeText(text + ' ' + window.location.href);
        alert('Result copied to clipboard!');
    }
}

/**
 * Request notification permission
 */
export async function requestNotifications() {
    if (sdk && sdk.actions.requestNotificationPermission) {
        try {
            const result = await sdk.actions.requestNotificationPermission();
            return result.granted;
        } catch (error) {
            console.warn('Notification permission denied:', error);
            return false;
        }
    }
    return false;
}
