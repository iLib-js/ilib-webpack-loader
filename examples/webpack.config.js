var path = require("path");

module.exports = {
    // ilib bundle entry point here 
    entry: path.resolve("./ilib-metafile.js"),
    output: {
        filename: 'ilib-custom.js',       // you can change this if you want
        chunkFilename: 'ilib.[name].js',  // to name the locale bundles
        path: path.resolve("./output"),   // choose an appropriate output dir
        publicPath: "/scripts/",          // choose the URL where ilib will go
        library: 'ilib',
        libraryTarget: 'umd'
    },
    module: {
        rules: [{
            test: /\.js$/,                // Run this loader on all .js files
            use: {
                loader: "../index.js",
                options: {
                    // edit these for the list of locales you need
                    locales: ["en-US", "fr-FR"],
                    assembly: "dynamic"
                }
            }
        }]
    }
};
