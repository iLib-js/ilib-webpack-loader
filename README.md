# ilib-webpack-loader

A webpack loader for ilib so that anyone can use ilib in their own webpack project and
only include the ilib classes and locale data that are needed. It can also be used
to create a custom version of ilib, even if you are not using webpack in your own
project.

Locale data is absolutely gargantuan. It is derived from the Unicode CLDR repository,
which supports hundreds of locales. If all data for all locales were put together, it
would form files that are tens, if not hundreds, of megabytes in size. That is not
acceptable to put on your web page!

The reality is that the majority of web sites only support a limited set of locales,
and we only need the data for those specific locales.

Also, ilib itself is rather extensive, with a few dozen classes in it. Most web sites
do not need all of that code. Fortunately, webpack to the rescue! It can analyze
your own project and include only those ilib routines that are needed (and their
dependencies!) and via the loader, it can grab only the locale data that those few
classes need. The description below tells you how to do that.

# Using the Loader

To use the loader, you need to do a few things:

- Use npm to install ilib and ilib-webpack-loader locally
- Install ilib-webpack-loader into your webpack.config.js and give it the
appropriate configuration options
- Update your webpack configuration to put ilib into its own vendor bundle
- Make sure your code requires ilib classes directly
- Include a special ilib file that will be dynamically rewritten to require all the
locale data
- Define the ilib version number

Before we go into details about the above, you have to make a few choices. The
following section gives details on those choices.

# Configuration Choices

To configure the loader, you will need to decide upon a few things:

- Which locales do you need?
- Do you want to assemble the locale data directly into the ilib bundle, or do
you want to dynamically lazy load it?
- Do you want it compressed/uglified or not?

Which Locales?
-------------

The loader is configured by default to support the top 20 locales around the world that
account for the majority of the Internet traffic. If you don't choose anything,
you will get the locale data for these top 20 locales.

However, your app may not support that many, and you can get a smaller footprint
by choosing a smaller set.

Locales should be specified using [https://en.wikipedia.org/wiki/IETF_language_tag](BCP-47 locale tags)
(aka. IETF tags). This uses ISO 639 codes for languages, ISO 15924 codes for scripts,
and ISO 3166 codes for regions, separated by dashes.

Assembled or Dynamic Data?
--------------------------

There are two major ways to include the locale data into your webpack configuration:
assembled and dynamic.

1. Assembled. You can include the data right into the ilib bundle as a
single file. This includes both the ilib code and its associated data together.
Doing this has a number of advantages:

  - everything is loaded and cached at once
  - all ilib classes are available for synchronous use as soon as the browser has
    loaded the js file
  - less files to move around and/or to check into your repo

Of course, there are a few disadvantages as well:

  - that single file can get large (very large!) if you have a lot of locales
  - you would be loading all locales at once, even if you only use one locale at a time,
    meaning extra network bandwidth and load time for data that the user isn't using

Assembled data is a good choice if you only support a few locales or if you only use
a few ilib classes.

2. Dynamic. Webpack has the ability to lazy-load bundles as they are needed. With
this type of configuration, the data for each of the locales would go into a
separate file that forms a new webpack bundle. Webkit knows how to load those
bundles on the fly as they are needed.

Advantages:

- file size and therefore page load time are minimized
- the ilib code bundle can be cached in the browser
- the ilib locale data files can be cached separately, allowing you to add new locales
to your web site later if you like without affecting any existing cached files

Disadvantages:

- the number of files can get unwieldy if you have a lot of locales
- since webpack loads the bundles asynchronously, you must use the ilib classes
asynchronously with callbacks or promises. Alternately, you must pre-initialize the
locale data asynchronously, perhaps in a jquery "document ready" kind of function
before using them.

Using dynamic data is a good choice if you have a lot of locales or use a lot of
different ilib classes.

Configuring the Loader
----------------------

1. Install ilib and ilib-webpack-loader from npm:

  ```
  npm install --save-dev ilib ilib-webpack-loader
  ```

1. Choose your locales and data style as per above

1. In your webpack configuration, you would update your rules like this:

  ```
  var ilibLoader = require("ilib-webpack-loader");
  ...

        module: {
            rules: [{
                test: /\.js$/, // Run this loader on all .js files
                exclude: /node_modules/, // ignore all files in the included node_modules folders
                use: {
                    loader: "ilib-webpack-loader",
                    options: {
                        locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                        assembly: "dynamic"
                    }
                }
            }]
        },
  ```

1. Put ilib into its own vendor bundle:

  ```
    module.exports = [{
        // your regular configuration here
    }, {
        entry: "ilib/lib/ilib.js",
        output: {
            filename: 'ilib.js',
            chunkFilename: 'ilib.[name].js',
            path: outputPath,
            publicPath: "/" + urlPath,
            library: 'ilib',
            libraryTarget: 'umd'
        },
        module: {
            rules: [{
                test: /\.js$/, // Run this loader on all .js files
                exclude: /node_modules/, // ignore all files in the included node_modules folders
                use: {
                    loader: "ilib-webpack-loader",
                    options: {
                        locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                        assembly: "dynamic"
                    }
                }
            }]
        },
        plugins: [
            new webpack.DefinePlugin({
                __VERSION__: JSON.stringify(require("ilib/package.json").version)
            })
        ]
    }];
  ```


# How it Works

The loader operates by examining all js files that are in your webpack configuration
as webpack processes them. If any are found that have a special comment in it which
indicates the type of locale data it needs, that will be noted for later. At the end
of the run, all of the locale data are loaded for the given set of locales and
written to a set of files, one per locale. Then, the loader rewrites a special ilib
file (more on that below) to require or import these new files, so that they can
become part of your webpack bundles.

