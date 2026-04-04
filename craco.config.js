const webpack = require('webpack');

module.exports = {
    webpack: {
        configure: {
            resolve: {
                fallback: {
                    stream: require.resolve("stream-browserify"),
                    buffer: require.resolve("buffer/"),
                    util: require.resolve("util/"),
                    assert: require.resolve("assert/")
                }
            },
            plugins: [
                new webpack.ProvidePlugin({
                    process: 'process/browser.js',
                    Buffer: ['buffer', 'Buffer']
                })
            ]
        }
    }
};