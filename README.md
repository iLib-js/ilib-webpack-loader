# ilib-webpack-loader

ilib-webpack-loader is a webpack loader for ilib so that you can use ilib in your
own webpack project and
only include the ilib classes and locale data that you actually need. It can also be used
to create a custom version of ilib, even if you are not using webpack in your own
project.

Locale data is absolutely gargantuan. It is derived from the Unicode CLDR repository,
which supports hundreds of locales. If all data for all locales were put together, it
would form files that are tens, if not hundreds, of megabytes in size. That is not
acceptable to put on your web page!

The reality is that the majority of web sites only support a limited set of locales,
and we only need the data for those specific locales.

Also, ilib itself is rather extensive, with a few dozen classes in it. Most web sites
do not need all of that code. It would be nice to minimize the amount of bytes sent
to browsers in unused code.

Fortunately, there is a solution. Webpack to the rescue! Webpack can analyze
your own project and include only those ilib routines that are actually used (and their
dependencies!) and, via the loader, it can grab only the locale data that those few
classes need. This document tells you how to do that.

# Using the Loader

To use the loader, you need to do a few things:

- Use npm to install ilib and ilib-webpack-loader locally
- Choose how you want to use ilib, as that determines the configuration options
- Install ilib-webpack-loader into your webpack.config.js and give it the
appropriate configuration options
- Update your webpack configuration to put ilib into its own vendor bundle
- Make sure your code requires ilib classes directly
- Include a special ilib file that will be dynamically rewritten to require all the
locale data

Before we go into details about the above, you have to make a few choices. The
following section gives details on those choices.

# Configuration Choices

To configure the loader, you will need to decide upon:

- Which locales do you need?
- Do you want to assemble the locale data directly into the ilib bundle, or do
you want to dynamically lazy-load it?
- Do you want it compressed/uglified or not?

Which Locales?
-------------

The loader is configured by default to support the top 20 locales around the world in
terms of Internet traffic. If you don't choose anything, you will get the locale data
for these top 20 locales.

However, your app may not support that many locales, and you can get a significantly
smaller footprint by choosing a smaller set.

Locales should be specified using [https://en.wikipedia.org/wiki/IETF_language_tag](BCP-47 locale tags)
(aka. IETF tags). This uses ISO 639 codes for languages, ISO 15924 codes for scripts,
and ISO 3166 codes for regions, separated by dashes. eg. US English is "en-US" and
Chinese for China written with the simplified script is "zh-Hans-CN".

Assembled or Dynamic Data?
--------------------------

There are two major ways to include the locale data into your webpack configuration:
assembled and dynamic.

1. Assembled. You can include the data along with the code into the ilib bundle as a
   single file. Doing this has a number of advantages:

  - everything is loaded and cached at once
  - all ilib classes are available for synchronous use as soon as the browser has
    loaded the js file. No callbacks or promises.
  - less files to move around and/or to check into your repo

   Of course, there are a few disadvantages as well:

  - that single file can get large if you have a lot of locales (very large!)
  - you would be loading all locales at once, even if you only use one locale at a time,
    meaning extra network bandwidth and load time for data that the user isn't using

   Assembled data is a good choice if you only support a few locales or if you only use
   a few ilib classes.

2. Dynamic. Webpack has the ability to lazy-load bundles as they are needed. With
   this type of configuration, the data for each of the locales would go into a
   separate webpack bundle, and webkit would load those bundles on the fly as they
   are needed.

   Advantages:

   - file size and therefore initial page load time are minimized
   - the ilib code bundle can be cached in the browser
   - the ilib locale data files can be cached separately, allowing you to add new locales
     to your web site later if you like without affecting any existing cache for the code
     or other locales

   Disadvantages:

   - the number of locale bundle files can get unwieldy if you have a lot of locales
   - since webpack loads the bundles asynchronously, you must use the ilib classes
     asynchronously with callbacks or promises. Alternately, you must pre-initialize the
     locale data asynchronously, perhaps in a jquery "document ready" kind of function
     before using them synchronously after that.

   Using dynamic data is a good choice if you have a lot of locales or use a lot of
   different ilib classes.

Compressed or Not?
---

You can compress/uglify ilib code normally using the regular uglify webpack plugin.
Note that the ilib code in npm is already uglified, so you will get that by default
(except for the webpack glue/wrapper code of course.)

If you would like to create a version of ilib that is NOT compressed, you're going
to have to do a little more work. See the sections below for details on how to
do that.

Using the Loader
----------------

1. Install ilib and ilib-webpack-loader from npm:

  ```
  npm install --save-dev ilib ilib-webpack-loader
  ```

1. Choose your locales and data style as per above

1. In your webpack configuration, update the rules section like this:

   ```
        module: {
            rules: [{
                test: /\.js$/, // Run this loader on all .js files, even non-ilib ones
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

   The locales option to the loader is self-explanatory. The assembly option can be one of
   "assembled" or "dynamic" where "assembled" means to put all of the locale data into
   the ilib bundle directly, and "dynamic" means lazy-load the locale data bundles.

1. Put ilib into its own vendor bundle:

   ```
   module.exports = [{
       // your regular app configuration here
   }, {
       // ilib bundle entry point here
       entry: "ilib/lib/ilib.js",
       output: {
           filename: 'ilib.js',
           chunkFilename: 'ilib.[name].js',  // to name the locale bundles
           path: outputPath,                 // choose an appropriate output dir
           publicPath: "/" + urlPath,        // add the corresponding URL
           library: 'ilib',
           libraryTarget: 'umd'
       },
       module: {
           rules: [{
               test: /\.js$/,                // Run this loader on all .js files
               use: {
                   loader: "ilib-webpack-loader",
                   options: {
                       locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                       assembly: "dynamic"
                   }
               }
           }]
       }
   }];
   ```

   If you want, you can change the name of the ilib bundle file by changing the filename property,
   or the name of the locale bundle files by changing the chunkFileName
   property. For example, you might like to include the hash into the file name for cache busting
   purposes. See the webpack documentation on the file name template rules.

   The path property should point to the directory where you want the output files to go, and the publicPath
   property should be the sub-URL under your web server where the ilib files will live. Webpack
   uses the URL to load the locale bundle files dynamically via XHR.

1. Make your code require ilib directly:

   ```
   const ilib = require("ilib");
   const DateFmt = require("ilib/lib/DateFmt");
   ```

1. Include a special ilib file that is used to generate and load all of the locale data:

   ```
   // this code generates the locale data:
   const ilibdata = require("ilib/lib/ilib-getdata.js");
   ```

   The require call for ilib-getdata.js need to go into a file that is processed near the end of your
   webpack packaging so that when it generates the locale data, it has already scanned
   all of the ilib files to find the locale data they use.

# How it Works

The loader operates by examining all js files that are in your webpack configuration
as webpack processes them. If any are found that have a special comment in it which
indicates the type of locale data it needs, that will be noted for later.

At the end of the run, when the WebpackLoader.js and the ilib-getdata.js files are
processed, the loader finds special comments in them that cause them to generate
the locale data files. The locale data are loaded for the configured set of locales and
written to a set of files, one per locale part. Then, the loader updates the WebpackLoader
and ilib-getdata files to require or import these newly created files, so that they can
become part of your webpack bundles.

Step-by-step:

1. Run webpack in your app as normal.
1. Webpack processes each of your js files looking for calls to ilib, which are in a
   different bundle.
1. The ilib-webpack-loader also processes each of your js files looking for special
   comments that indicate that they use certain types of locale data. For example,
   the DateFmt class has this comment in it:

   ```
   // !data dateformats
   ```

   This indicates that it uses the various `dateformats.json` files in the ilib locale
   directory. (Look in ...node_modules/ilib/js/locale/* if you're curious.)
1. When the ilib-webpack-loader encounters the ilib-getdata.js file, it recognizes
   a special comment in there which causes it to emit all of the locale data it has
   collected so far. In the example above, if the locales are set to "en-US" and
   "fr-FR", files would go into:

   ```
   ilib/js/locale/dateformats.json -> root.js
   ilib/js/locale/en/dateformats.json -> en.js
   ilib/js/locale/en-US/dateformats.json -> en-US.js
   ilib/js/locale/und/US/dateformats.json -> und-US.js
   ilib/js/locale/fr/dateformats.json -> fr.js
   ilib/js/locale/fr-FR/dateformats.json -> fr-FR.js
   ilib/js/locale/und/FR/dateformats.json -> und-FR.js
   ```

   The loader then adds require() calls for these 7 new files so that they are
   included into the ilib bundle. Alternately, if you are doing dynamic load
   locales, it would add calls to System.import() for each of them which causes
   webpack to issue each file as its own separate bundle that can be loaded
   dynamically.
1. Webpack will emit a number of files in the output directory:

   ```
   my-app.js    - your own bundle
   ilib.js      - the ilib code bundle, which you can put in a script tag in your html
   ilib.root.js - the 7 locale data bundles, which all go onto your web server as well
   ilib.en.js
   ilib.en-US.js
   ilib.und-US.js
   ilib.fr.js
   ilib.fr-FR.js
   ilib.und-FR.js
   ```

Why so Many Locale Data Files?
-----

You may be wondering why there are so many locale data files/bundles emitted in the
example above when the configuration only requested 2 locales. The loader could have
just emitted two bundles "ilib.en-US.js" and "ilib.fr-FR.js", right?

The answer is footprint. By splitting the files, each piece of locale data is included
only once. For example, the root.js contains a lot of non-locale data that does not need to be
replicated in each of those files. The Unicode character type properties that the
CType functions use are the same for all locales. Each Unicode character is unambiguous
and does not depend on which locale you are using.

Similarly, if your configuration specifies multiple English locales (maybe your app
supports all of these: en-US, en-CA, en-GB, and en-AU), then
the common English data does not need to be replicated in each of those files. The
ilib.en-US.js bundle only contains those locale data and settings that truly specific
to English as spoken in the US.

Examples
--------

A working example of this configuration can be found in the ilib demo app which is included
in the ilib sources. See [the ilib demo app on github](https://github.com/iLib-js/iLib/tree/development/docs/demo)
for details. You can try it out for yourself if you git clone the ilib project,
change directory to ilib/docs/demo and then simply run "webpack".

Creating an Uncompressed Version of iLib
---

By default all of the ilib code published to npm is uglified already. In order to make
an uncompressed version of ilib (perhaps for debugging?), follow these steps:

1. Clone the ilib repo from [github](https://github.com/iLib-js/iLib).

1. Install java 1.8 and ant to build it. Yes, we will be moving
   to grunt soon to build the js parts. The ilib repo includes some
   java code for Android, so we have to keep Java and ant for now.

1. cd to the "js" directory and enter "ant". Allow it to build some stuff.

Now you can point your webpack configuration to this newly built ilib, which
contains the uncompressed code and locale data files. Note that the "entry"
property has changed, and there is a new "compilation" option passed to
the loader.

```
   module.exports = [{
       // your regular app configuration here
   }, {
       // ilib bundle entry point here
       entry: "full/path/to/your/ilib/clone/js/lib/ilib.js",
       output: {
           filename: 'ilib.js',
           chunkFilename: 'ilib.[name].js',  // to name the locale bundles
           path: outputPath,                 // choose an appropriate output dir
           publicPath: "/" + urlPath,        // add the corresponding URL
           library: 'ilib',
           libraryTarget: 'umd'
       },
       module: {
           rules: [{
               test: /\.js$/,                // Run this loader on all .js files
               use: {
                   loader: "ilib-webpack-loader",
                   options: {
                       locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                       assembly: "dynamic",
                       compilation: "uncompiled"  // <- This is the new part!
                   }
               }
           }]
       }
   }];
```

# Creating a Custom Version of iLib

If you do not use webpack in your own project, but you would still like to create a custom
version of ilib that includes only the code and data that your app needs, you can do
that! Here is an example of how to do it:

First, let's assume you have a web app which supports English for the US, and French for
France.

1. Examine your code and find all of the iLib classes that your code uses. Let's say your
   app uses the classes Locale, DateFmt, and NumFmt.

1. Create a meta-file that includes all of those classes. For example, the meta-file
   "ilib-metafile.js" should look like this:

   ```
   var ilib = require("ilib");

   // assign each class to a subproperty of "ilib"
   ilib.Locale = require("ilib/lib/Locale.js");
   ilib.DateFmt = require("ilib/lib/DateFmt.js");
   ilib.NumFmt = require("ilib/lib/NumFmt.js");

   // This unpacks the above classes to the global scope
   require("ilib/lib/ilib-unpack.js");

   // Must be at the end of meta file to generate the locale data files
   require("ilib/lib/ilib-getdata.js");

   module.exports = ilib;
   ```

1. Create a webpack.config.js file to govern how webpack works. It should look
   something like this:

   ```
   var path = require("path");

   module.exports = {
       // ilib bundle entry point here
       entry: path.resolve("./ilib-metafile.js"),
       output: {
           filename: 'ilib-custom.js',       // you can change this if you want
           chunkFilename: 'ilib.[name].js',  // to name the locale bundles
           path: path.resolve("./output"),   // choose an appropriate output dir
           publicPath: "/output/",          // choose the URL where ilib will go
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
                       assembly: "assembled"
                   }
               }
           }]
       }
   };
   ```

1. Run "webpack" in the same dir. The output will be in a subdirectory called "output".

1. Update your html to include the custom build of ilib with a standard script tag:

   ```
   <script src="output/ilib-custom.js"></script>
   <script>
       // all of the classes have been copied to the global scope here, so
       // you can just start using them:
       new DateFmt({
           locale: "fr-FR",
           sync: false,
           onLoad: function(df) {
               alert("Aujourd'hui, c'est " + df.format(new Date()));
           }
       });
   </script>
   ```

Et voila. You are done.

Note that ilib automatically copies its public classes up to the global scope,
so you can just use them normally. If you used ilib 12.0 or earlier, this is
how it was assembled as well, so if you are upgrading to 13.0, you will probably
not need to change your code. If you don't want to pollute your global scope,
you can use all of the classes via the ilib object. Just remove the
require call for "ilib-unpack.js" in your metafile and rerun webpack.

Now upload the ilib-custom.js to your web server or check it in to your
repo so that it all gets published with the next push of your site.

Example Code
---

The above code is also located in examples subdirectory so you can try it
for yourself. Just change dir into examples and run "webpack" with no arguments.

The example above is written with an asynchronous
call to the DateFmt constructor, so you can try changing the "assembly" property in the
webpack.config.js to "dynamic", run webpack again, reload the html, and it should
still work properly. You will see on the console that the packages for French have been
loaded dynamically and that the date appears with French format (dd/MM/yyyy).

                                                 Fin.