// Leaderboard - Global score tracking
// Fetches and submits scores to the game server

import { getAuthToken } from './auth.js';

// ============================================
// CONFIGURATION
// ============================================

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:3001';

// Cache
let cachedLeaderboard = null;
let cacheTime = 0;
const CACHE_DURATION = 60000; // 1 minute

// ============================================
// LEADERBOARD API
// ============================================

/**
 * Fetch global leaderboard
 */
export async function fetchLeaderboard(limit = 100) {
    // Check cache
    if (cachedLeaderboard && Date.now() - cacheTime < CACHE_DURATION) {
        return cachedLeaderboard;
    }

    try {
        const response = await fetch(`${API_URL}/leaderboard?limit=${limit}`);

        if (!response.ok) {
            throw new Error(`Failed to fetch leaderboard: ${response.status}`);
        }

        const data = await response.json();

        // Cache result
        cachedLeaderboard = data;
        cacheTime = Date.now();

        return data;

    } catch (error) {
        console.warn('Leaderboard fetch failed:', error.message);

        // Return cached or empty
        return cachedLeaderboard || [];
    }
}

/**
 * Submit match result
 */
export async function submitMatchResult(result) {
    const token = getAuthToken();

    if (!token) {
        console.warn('Not authenticated, score not submitted');
        return false;
    }

    try {
        const response = await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                kills: result.kills,
                deaths: result.deaths,
                score: result.score,
                matchDuration: result.matchDuration,
                won: result.won,
                weapon: result.favoriteWeapon
            })
        });

        if (!response.ok) {
            throw new Error(`Failed to submit score: ${response.status}`);
        }

        // Invalidate cache
        cachedLeaderboard = null;

        return true;

    } catch (error) {
        console.warn('Score submission failed:', error.message);
        return false;
    }
}

/**
 * Get player's rank
 */
export async function getPlayerRank(fid) {
    try {
        const response = await fetch(`${API_URL}/rank/${fid}`);

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch (error) {
        console.warn('Rank fetch failed:', error.message);
        return null;
    }
}

/**
 * Get player's stats
 */
export async function getPlayerStats(fid) {
    try {
        const response = await fetch(`${API_URL}/stats/${fid}`);

        if (!response.ok) {
            return null;
        }

        return await response.json();

    } catch (error) {
        console.warn('Stats fetch failed:', error.message);
        return null;
    }
}

// ============================================
// LEADERBOARD UI HELPERS
// ============================================

/**
 * Format leaderboard entry for display
 */
export function formatLeaderboardEntry(entry, rank) {
    return {
        rank,
        username: entry.username || `Player${entry.fid}`,
        displayName: entry.displayName || entry.username,
        pfpUrl: entry.pfpUrl,
        kills: entry.totalKills || 0,
        deaths: entry.totalDeaths || 0,
        kd: entry.totalDeaths > 0
            ? (entry.totalKills / entry.totalDeaths).toFixed(2)
            : entry.totalKills.toString(),
        wins: entry.wins || 0,
        gamesPlayed: entry.gamesPlayed || 0,
        score: entry.score || 0
    };
}

/**
 * Get top players
 */
export async function getTopPlayers(count = 10) {
    const leaderboard = await fetchLeaderboard(count);
    return leaderboard.map((entry, index) => formatLeaderboardEntry(entry, index + 1));
}

/**
 * Clear leaderboard cache (for manual refresh)
 */
export function clearLeaderboardCache() {
    cachedLeaderboard = null;
    cacheTime = 0;
}
