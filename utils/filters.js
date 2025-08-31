/**
 * Utility functions for audio filters
 */

// Default filter configurations
const filters = {
    bassboost: {
        equalizer: [
            { band: 0, gain: 0.6 },
            { band: 1, gain: 0.7 },
            { band: 2, gain: 0.8 },
            { band: 3, gain: 0.55 },
            { band: 4, gain: 0.25 },
            { band: 5, gain: 0 },
            { band: 6, gain: -0.25 },
            { band: 7, gain: -0.25 },
            { band: 8, gain: -0.25 },
            { band: 9, gain: -0.25 },
            { band: 10, gain: -0.25 },
            { band: 11, gain: -0.25 },
            { band: 12, gain: -0.25 },
            { band: 13, gain: -0.25 },
        ],
    },
    '8d': {
        rotation: { rotationHz: 0.2 },
    },
    karaoke: {
        karaoke: {
            level: 1.0,
            monoLevel: 1.0,
            filterBand: 220.0,
            filterWidth: 100.0,
        },
    },
    nightcore: {
        timescale: { rate: 1.3 },
        tremolo: { depth: 0.3, frequency: 14 },
    },
    vaporwave: {
        timescale: { pitch: 0.5 },
        equalizer: [
            { band: 1, gain: 0.3 },
            { band: 0, gain: 0.3 },
        ],
    },
    slowmode: {
        timescale: { rate: 0.7 },
    },
    lowpass: {
        lowPass: { smoothing: 20.0 },
    },
    timescale: {
        timescale: { 
            speed: 1.0, 
            pitch: 1.0, 
            rate: 1.0 
        },
    }
};

/**
 * Get filter configuration by name
 * @param {String} filterName Name of the filter
 * @returns {Object|null} Filter configuration or null if not found
 */
function getFilter(filterName) {
    return filters[filterName] || null;
}

/**
 * Get available filter names
 * @returns {Array} List of available filter names
 */
function getAvailableFilters() {
    return Object.keys(filters);
}

/**
 * Get friendly name for filter
 * @param {String} filterName Internal filter name
 * @returns {String} User-friendly filter name
 */
function getFilterDisplayName(filterName) {
    const displayNames = {
        'bassboost': 'Bass Boost',
        '8d': '8D Audio',
        'karaoke': 'Karaoke',
        'nightcore': 'Nightcore',
        'vaporwave': 'Vaporwave',
        'slowmode': 'Slow Mode',
        'lowpass': 'Low Pass',
        'timescale': 'Time Scale'
    };
    
    return displayNames[filterName] || filterName.charAt(0).toUpperCase() + filterName.slice(1);
}

/**
 * Apply a filter to a player
 * @param {Object} player Kazagumo player instance
 * @param {String} filterName Filter name to apply
 * @returns {Boolean} Success status
 */
async function applyFilter(player, filterName) {
    try {
        const filterConfig = getFilter(filterName);
        if (!filterConfig) return false;

        // Store the active filter name on the player
        player.data.set('activeFilter', filterName);

        // Optimization: Only send filter update if config is different
        const lastConfig = player.data.get('lastFilterConfig');
        const newConfigStr = JSON.stringify(filterConfig);
        if (lastConfig === newConfigStr) {
            // No change, skip sending
            return true;
        }
        player.data.set('lastFilterConfig', newConfigStr);

        // Timestamp for performance logging
        const start = Date.now();
        await player.shoukaku.setFilters(filterConfig);
        const elapsed = Date.now() - start;
        if (elapsed > 500) {
            console.warn(`[Filter] Application took ${elapsed}ms for ${filterName}`);
        }
        return true;
    } catch (error) {
        console.error(`Error applying filter ${filterName}:`, error);
        return false;
    }
}

/**
 * Clear all filters from a player
 * @param {Object} player Kazagumo player instance
 * @returns {Boolean} Success status
 */
async function clearFilters(player) {
    try {
        player.data.delete('activeFilter');
        player.data.delete('lastFilterConfig');
        const start = Date.now();
        await player.shoukaku.setFilters({});
        const elapsed = Date.now() - start;
        if (elapsed > 500) {
            console.warn(`[Filter] Clearing took ${elapsed}ms`);
        }
        return true;
    } catch (error) {
        console.error('Error clearing filters:', error);
        return false;
    }
}

/**
 * Get the currently active filter on a player
 * @param {Object} player Kazagumo player instance
 * @returns {String|null} Name of active filter or null if none
 */
function getActiveFilter(player) {
    return player.data.get('activeFilter') || null;
}

/**
 * Check if any filter is active on the player
 * @param {Object} player Kazagumo player instance
 * @returns {Boolean} True if a filter is active
 */
function hasActiveFilter(player) {
    return player.data.has('activeFilter');
}

module.exports = {
    getFilter,
    getAvailableFilters,
    getFilterDisplayName,
    applyFilter,
    clearFilters,
    getActiveFilter,
    hasActiveFilter
};