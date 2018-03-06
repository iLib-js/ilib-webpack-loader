# ilib-webpack-loader

ilib-webpack-loader is a webpack loader for ilib so that you can use ilib in your
own webpack project and
only include the ilib classes and locale data that you actually need. It can also be used
to create a custom version of ilib, even if you are not using webpack in your own
project.

In general, locale data is absolutely gargantuan. For ilib, the data is derived from the Unicode CLDR repository,
which supports hundreds of locales. If all data for all locales were put together, it
would form files that are tens, if not hundreds, of megabytes in size. That is typically not
acceptable to put on a web page!

The reality is that the majority of web sites only support a limited set of locales and
use only need a limited set of international classes, and only need the locale data for those 
specific locales and classes.

Fortunately, there is a solution. Webpack to the rescue! Webpack can analyze
your own project and include only those ilib routines that are actually used (and their
dependencies!) and, via the loader, it can grab only the locale data that those few
classes need. This document tells you how to do all that.

# Table of Contents

1. [Using the Loader](#using-the-loader)
   1. [Configuration Choices](#configuration-choices)
      1. [Which Locales?](#which-locales-)
      1. [Assembled, Dynamic Data, or Dynamic?](#assembled-dynamic-data-or-dynamic-)
      1. [Compressed or Not?](#compressed-or-not-)
   1. [Using the Loader in your Webpack Config](#using-the-loader-in-your-webpack-config)
1. [How it Works](#how-it-works)
   1. [Why so Many Locale Data Files?](#why-so-many-locale-data-files-)
   1. [Creating an Uncompressed Version of iLib](#creating-an-uncompressed-version-of-ilib)
1. [What if my Website Project is not Currently Using Webpack?](#what-if-my-website-project-is-not-currently-using-webpack-)
   1. [Using Standard Builds](#using-standard-builds)
   1. [Creating a Custom Version of iLib](#creating-a-custom-version-of-ilib)
1. [Examples](#examples)
   1. [Simple Example](#simple-example)
   1. [Example of a Customized Build](#example-of-a-customized-build)

# Using the Loader

To use the loader, you need to do a few things:

- Use npm to install ilib and ilib-webpack-loader locally
- Choose how you want to use ilib, as that determines the configuration options
- Put ilib-webpack-loader into your webpack.config.js and give it the
appropriate configuration options
- Update your webpack configuration to put ilib into its own vendor bundle
- Make sure your code requires or imports ilib classes directly
- Include a special ilib file that will be dynamically rewritten to require all the
locale data

Before we go into details about the above, you have to make a few choices. The
following section gives details on what those choices are.

## Configuration Choices

To configure the loader, you will need to decide upon:

- Which locales do you need?
- Do you want to assemble the locale data directly into the ilib bundle, or do
you want to dynamically lazy-load them?
- Do you want the code and data compressed/uglified or not?

### Which Locales?

The loader is configured by default to support the top 20 locales around the world in
terms of Internet traffic. If you don't explicitly choose any locales, you will get the locale data
for these top 20 locales.

However, if your app does not support that many locales, you can get a significantly
smaller footprint by choosing a smaller set.

Locales should be specified using [https://en.wikipedia.org/wiki/IETF_language_tag](BCP-47 locale tags)
(aka. IETF tags). This uses ISO 639 codes for languages, ISO 15924 codes for scripts,
and ISO 3166 codes for regions, separated by dashes. eg. US English is "en-US" and
Chinese for China written with the simplified script is "zh-Hans-CN".

### Assembled, Dynamic Data, or Dynamic?

There are three major ways to include the code and locale data into your webpack configuration:
assembled, dynamic data, and dynamic.

1. Assembled. You can include the data along with the code into the ilib bundle as a
   single file. Doing this has a number of advantages:

  - everything is loaded and cached at once
  - all ilib classes are available for synchronous use as soon as the browser has
    loaded the js file. No async, callbacks, or promises.
  - less files to move around and/or to check into your repo

   Of course, there are a few disadvantages as well:

  - that single file can get large if you have a lot of locales or classes (very large!)
  - you would be loading all locales at once, even if you only use one locale at a time,
    meaning extra network bandwidth and load time for data that the user isn't using

   Assembled data is a good choice if you only support a few locales or if you only use
   a few ilib classes.

2. Dynamic Data. Webpack has the ability to lazy-load bundles as they are needed. With
   this type of configuration, the code is in a single file, but the locale data for
   each of the locales would go into a
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

3. Dynamic. This mode uses dynamically loaded code and dynamically loaded data. Only
a few platforms, such as nodejs or rhino, support this mode. It is not available on 
web pages. In this mode, you require() classes you need, and the data will be loaded
synchronously from disk.

   Advantages:

   - file size and therefore initial page load time are very small. Only load what you
     need, when you need it.
   - the locales that your app supports does not need to be preconfigured in any way.
     You can load any combination of language, script, and region that you like.
   - all classes can be used synchronously

   Disadvantages:

   - synchronous loading can block execution. Fortunately, individual locale data files
     are very often small (less than one disk block), and they are cached after the first time
     they are loaded, which minimizes these problems.

Dynamic mode is the best choice for node or rhino apps, as the code and data can be loaded
from an npm module dynamically.

### Compressed or Not?

You can compress/uglify ilib code normally using the regular uglify webpack plugin.
Note that the ilib code in npm is already uglified, so you will get that by default
(except for the webpack glue/wrapper code of course.)

If you would like to create a version of ilib that is NOT compressed, you're going
to have to do a little more work. See the sections below for details on how to
do that.

## Using the Loader in your Webpack Config

1. Install ilib and ilib-webpack-loader from npm:

  ```
  npm install --save-dev ilib ilib-webpack-loader
  ```

1. Choose your locales and data style as per above

1. In your webpack configuration, update the rules section like this:

   ```
        module: {
            rules: [{
                test: /\.(js|html)$/, // Run this loader on all .js and .html files, even non-ilib ones
                use: {
                    loader: "ilib-webpack-loader",
                    options: {
                        locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                        assembly: "dynamicdata"
                    }
                }
            }]
        },
   ```

   The locales option to the loader is self-explanatory. The assembly option can be one of
   "assembled" or "dynamicdata" where "assembled" means to put all of the locale data into
   the ilib bundle directly, and "dynamicdata" means lazy-load the locale data bundles.

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
           publicPath: urlPath,              // add the corresponding URL
           library: 'ilib',
           libraryTarget: 'umd'
       },
       module: {
           rules: [{
               test: /\.(js|html)$/,                // Run this loader on all .js or .html files
               use: {
                   loader: "ilib-webpack-loader",
                   options: {
                       locales: ["en-US", "de-DE", "fr-FR", "it-IT", "ja-JP", "ko-KR", "zh-Hans-CN"],
                       assembly: "dynamicdata"
                   }
               }
           }]
       }
   }];
   ```

   If you want, you can change the name of the ilib bundle file by changing the output.filename property,
   or the name of the locale bundle files by changing the `output.chunkFileName`
   property. For example, you might like to include the hash into the file name for cache busting
   purposes. See the [webpack documentation](https://webpack.js.org/configuration/output/#output-chunkfilename)
   on the file name template rules.

   The path property should point to the directory where you want the output files to go, and the publicPath
   property should be the sub-URL under your web server where the ilib files will live. Webpack
   uses the URL to load the locale bundle files dynamically via XHR.

1. Make your code require ilib directly:

   ```
   const ilib = require("ilib");
   const DateFmt = require("ilib/lib/DateFmt");
   ```
   
   or, under ES6, use import instead:
   
   ```
   import ilib from "ilib";
   import DateFmt from "ilib/lib/DateFmt";
   ```

1. Include a special ilib file that is used to generate and load all of the locale data:

   ```
   // this code generates the locale data:
   const ilibdata = require("ilib/lib/ilib-getdata.js");
   ```

   The require call for ilib-getdata.js needs to go into a file that is processed near the end of your
   webpack packaging so that when it generates the locale data, it has already scanned
   all of the your project's files to find which ilib classes are used and the locale data those
   classes depend upon.

# How it Works

The loader operates by examining all js (or html) files that are in your webpack configuration
as webpack processes them. If any are found that have a special comment in it which
indicates the type of locale data it needs, that will be noted for later.

At the end of the run, when the WebpackLoader.js and the ilib-getdata.js files are
processed, the loader finds special comments in them that cause the loader to generate
the locale data files. The locale data are loaded in memory for the configured set of 
classes and locales and
written to a set of files, one per locale part. Then, the loader updates the WebpackLoader
and ilib-getdata files to require or import these newly created files, so that they can
become part of your webpack bundles.

Step-by-step:

1. Run webpack in your app as normal.
1. Webpack processes each of your js files looking for calls to ilib.
1. The ilib-webpack-loader also processes each of your js files looking for special
   comments that indicate that they use certain types of locale data. For example,
   the DateFmt class has this comment in it:

   ```
   // !data dateformats
   ```

   This indicates that it uses the various `dateformats.json` files in the ilib locale
   directory. (Look in ...node_modules/ilib/js/locale/* if you're curious.) You can
   use these comments in your own code if you need to load in extra non-locale data files 
   such as character sets, character mapping files, or time zones.
1. When the ilib-webpack-loader encounters the ilib-getdata.js file, it recognizes
   a special comment in there which causes it to emit all of the locale data it has
   collected so far. In the example above, if the locales are set to "en-US" and
   "fr-FR", the information from the dateformat.json files from the previous point
   would go into:

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
just emitted two bundles `ilib.en-US.js` and `ilib.fr-FR.js`, right?

The answer is footprint. By splitting the files, each piece of locale data is included
only once. For example, the root.js contains a lot of non-locale data that does not need to be
replicated in each of those two files. For example, the Unicode character type properties that the
CType functions use are the same for all locales. Each Unicode character is unambiguous
and does not depend on which locale you are using. Why have two copies of it on your
web server? If the user's browser loads `ilib.root.js` once, it can cache it and not
load it again, not matter the locale.

Similarly, if your configuration specifies multiple English locales (maybe your app
supports all of these: en-US, en-CA, en-GB, and en-AU), then
the common English data does not need to be replicated in each of those files. The
`ilib.en.js` bundle will contain the shared settings that are common to many varieties
of English, and the file `ilib.en-US.js` only contains those locale data and settings
that truly specific to English as spoken in the US.

Creating an Uncompressed Version of iLib
---

By default all of the ilib code published to npm is uglified already. In order to make
an uncompressed version of ilib (perhaps for debugging?), follow these steps:

1. Clone the ilib repo from [github](https://github.com/iLib-js/iLib).

1. Install java 1.8 and ant to build it. Yes, we will be moving
   to grunt soon to build the js parts. The ilib repo also includes some
   java code for Android, so we have to keep Java and ant for now.

1. cd to the "js" directory and enter "ant". Allow it to build some stuff.

Now you can point your webpack configuration to this freshly built ilib, which
contains the uncompressed code and locale data files. Here are the changes.

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

Note that the "entry" property has changed from the examples above, and there 
is a new "compilation" option passed to the loader.


# What if my Website Project is not Currently Using Webpack?

You can still use webpacked ilib! If you have javascript in js and html 
files, but you currently don't use webpack for your own project, you have 
have two choices:

1. Use a standard build of ilib from github. 
   
1. Build your own customized version of ilib

Using Standard Builds
-----

You can use a pre-built version of ilib based on releases published on 
[the ilib project's releases page on github](https://github.com/iLib-js/iLib/releases).

Look inside ilib-&lt;version>.tgz or ilib-&lt;version>.zip for the standard
builds.

Releases of ilib come with three
pre-built sizes: core, standard, and full. The core size includes a minimal
set of classes that pretty much only allows you to do simple things like
translating text. The standard size has all the basics such as date formatting
and number formatting, as well as text translation and a few other classes. 
The full size has every class that ilib contains.

Releases also now come with the fully assembled and dynamicdata versions of 
each size for web sites or node. The locale data that comes with each is for the 
top 20 locales on the Internet by volume of traffic.

For fully dynamic code and locale data loading, you can install the latest ilib
from npm.

Using a standard release of ilib is convenient, but it may not contain the locale
data you need and/or the classes you need, or it may be too large with too many
locales. If that's the case for your project, you can build a custom version of
ilib that contains only the code and data you actually need and use.

Creating a Custom Version of iLib
----

If you do not use webpack in your own project, but you would still like to create a custom
version of ilib that includes only the code and data that your app needs, you can do
that! Here is an example of how:

First, let's assume you have a web app which supports English for the US, and French for
France. Also, we assume that you have installed ilib, webpack, and ilib-webpack-loader via npm.

1. The ilib-webpack-loader module contains a node-based tool that can scan your code looking
   for references to ilib classes. The tool is called `ilib-scanner`. If your node_modules/.bin
   directory is in your path, you can execute this tool. This tool will generate both an
   ilib metafile and a webpack.config.js file that configures webpack to create that 
   customized ilib.js file.

1. Change directory to the root of your web app, and run `ilib-scanner` with the following options:

   ```
   ilib-scanner --assembly=assembled --locales=en-US,fr-FR --compilation=compiled ilib-include.js
   ```
   
   The "assembly" parameter can have the value of either "assembled" and "dynamicdata". Default is
   "assembled".
   
   The value of the locales parameter is a comma-separated list of locales that your app needs 
   to support. In our example, this is en-US for English/US and fr-FR for French/France.
    
   The "compilation" parameter is one of "compiled" or "uncompiled". 
   
   You must give the path to the metafile file you would like to generate. In this 
   example, that is "ilib-include.js". The scanner will fill this file with explicit "require"
   calls for any ilib class your code uses.

   Optionally you can follow the metafile name with the paths to
   a number of directories and files you would like to scan explicitly.  Without those
   explicit paths, the default is to recursively scan the current directory looking for js
   and html files.

   When the tool is done, the new files are generated in the same path that you gave to
   the metafile. So for example, if you gave the metafile path output/js/ilib-include.js, then
   the output files will be output/js/ilib-include.js and output/js/webpack.config.js.

1. Examine the webpack.config.js file to make sure the settings are appropriate. You can do things
   like change the name of the ilib output file (`output.filename` property) if desired. It should
   be set up the generate a file called ilib.js properly already, so you don't have to modify
   anything. 
   
   If you have requested a dynamicdata build, you must make sure the `output.publicPath`
   property is set to the directory part of the URL where webpack can load the locale data
   files. For example, if you put ilib and the locale data files underneath 
   "http://www.mycompany.com/scripts/js/ilib.js", then set the publicPath property to "/scripts/js/".
   Webpack uses XHR requests to the server where it loaded ilib.js from in order to load the 
   corresponding locale data files under the path given in the publicPath directory.
   
1. Run "webpack" in the dir with the new webpack.config.js in it. It will churn for a while and
   then spit out files in the path
   named in the webpack.config.js. By default, the file name is "ilib.js".

1. Update your html files to include the new custom build of ilib with a standard script tag:

   ```
   <script src="ilib.js"></script>
   <script>
       // All of the classes have been copied to the global scope here, so
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
so you can just use them normally, not as a property in the "ilib" namespace. 
If you used ilib 12.0 or earlier, this is the same as
how it worked before, so if you are upgrading to 13.0, you will probably
not need to change your code. If you don't want to pollute your global scope,
you can use all of the classes via the ilib namespace. Just remove the
require call for "ilib-unpack.js" in your metafile and rerun webpack.

Now upload the ilib.js (and for dynamicdata mode, all of the locale data
files as well) to your web server or check it in to your
repo so that it all gets published with the next push.

# Examples

## Simple Example

The above example code is also located in examples subdirectory so you can try it
for yourself. Just change dir into `examples` and run "webpack" with no arguments.

The example above is written with an asynchronous
call to the DateFmt constructor, so you can try changing the `assembly` property in the
webpack.config.js to `dynamicdata`, run webpack again, reload the html, and it should
still work properly. You will see on the console that the packages for French have been
loaded dynamically and that the date appears with a French format (dd/MM/yyyy) in the
alert dialog.

## Example of a Customized Build

A working example of a customized version of ilib for a site that does not currently
use webpack can be found in the ilib demo app. This is included
in the ilib sources under the docs/demo directory. See 
[the ilib demo app on github](https://github.com/iLib-js/iLib/tree/development/docs/demo)
for details. You can try it out for yourself if you git clone the ilib project,
change directory to ilib/docs/demo and then use the instructions above to create
a customized version of ilib for [projects that are not currently using 
webpack](#what-if-my-website-project-is-not-currently-using-webpack-).



                                                 Fin.