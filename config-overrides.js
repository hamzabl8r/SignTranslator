const webpack = require('webpack');

module.exports = function override(config) {
    // Désactiver complètement les fallbacks
    config.resolve.fallback = {
        stream: false,
        buffer: false,
        util: false,
        assert: false,
        process: false
    };
    
    // Ajouter le plugin ProvidePlugin correctement
    config.plugins.push(
        new webpack.ProvidePlugin({
            process: 'process'
        })
    );
    
    return config;
};