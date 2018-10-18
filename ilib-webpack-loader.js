/**
 * ilib-webpack-loader.js - A webpack loader to process js files and include
 * all of the locale data that is needed for the requested locales
 *
 * @license
 * Copyright © 2018, JEDLSoft
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const getOptions = require('loader-utils').getOptions;
//import validateOptions from 'schema-utils';

var path = require('path');
var fs = require('fs');
var ilib;
var Locale;
var Utils;

/*
const schema = {
    type: 'object',
    properties: {
        locales: {
            type: 'array'
        }
    }
};
 */

function loadIlibClasses(location) {
    if (location) {
        ilib = require(path.join(location, "lib/ilib-node.js"));
        Locale = require(path.join(location, "lib/Locale.js"));
        Utils = require(path.join(location, "lib/Utils.js"));
    } else {
        ilib = require("ilib");
        Locale = require('ilib/lib/Locale.js');
        Utils = require('ilib/lib/Utils.js');
    }
}

function makeDirs(path) {
    var parts = path.split(/[\\\/]/);

    for (var i = 1; i <= parts.length; i++) {
        var p = parts.slice(0, i).join("/");
        if (p && p.length > 0 && !fs.existsSync(p)) {
            fs.mkdirSync(p);
        }
    }
}

function toIlibDataName(str) {
    return (!str || str === "root" || str === "*") ? "" : str.replace(/[\.:\(\)\/\\\+\-]/g, "_");
}

function findIlibRoot() {
    var dir = module.paths.find(function(p) {
        return fs.existsSync(path.join(p, "ilib/package.json"));
    });
    return dir && path.join(dir, "ilib");
}

/**
 * Convert a set to an array.
 *
 * @param {Set} set to convert
 * @returns an array with the contents of the set
 */
function toArray(set) {
    var ret = [];
    set.forEach(function(element) {
        ret.push(element);
    });
    return ret;
}

var dataPatternSlashStar = /\/\*\s*!data\s*([^\*]+)\*\//g;
var dataPatternSlashSlash = /\/\/\s*!data\s*([^\n]+)/g;

var macroPatternSlashSlash = /\/\/\s*!macro\s*(\S*)/g;
var macroPatternQuoted = /["']!macro\s*(\S*)["']/g;

var loadLocaleDataPattern = /\/\/\s*!loadLocaleData/g;
var defineLocaleDataPattern = /\/\/\s*!defineLocaleData/g;

function calcDataRoot(options) {
    var ilibRoot = options.ilibRoot;
    if (!ilibRoot) {
        return path.join(findIlibRoot(), "locale");
    } else {
        return path.join(ilibRoot, (options.compilation && options.compilation === "uncompiled") ? "data/locale" : "locale");
    }
}

var emptyLocaleDataFilesEmitted = false;

/**
 * Produce a set of js files that will eventually contain
 * the necessary locale data. These files are created
 * as empty files now so that the dependency graph of the
 * compilation is correct. Then, later, the ilib webpack
 * plugin will fill in the contents of these files once
 * all other js files have been processed and we know for
 * sure what the contents should be. These js files are
 * created with one per locale part. For example, the
 * locale "en-US" has the following parts:
 *
 * <ul>
 * <li><i>root</i> - shared by all locales, containing
 * generic locale data and most non-locale data.
 * <li><i>en</i> - language-specific data shared by all
 * of the English locales. Example: date formats
 * <li><i>und-US</i> - region-specific data shared by
 * all languages in the same region. Example: default
 * time zone or standard currency
 * <li><i>en-US</i> - language- and region-specific
 * information that overrides the above information.
 * </ul>
 *
 * Ilib knows to load the locale data parts in the right
 * order such that the more specific data overrides
 * the less specific data.
 *
 * @param compilation the webpack compilation
 * @param options the options for this loader from
 * the webpack.config.js
 * @returns {Array.<string>} an array of files that
 * were emitted by this function
 */
function emitLocaleData(compilation, options) {
    var outputDir = compilation.options.output.path;
    var outputSet = new Set();

    var locales = options.locales;

    if (options.debug) console.log("Creating locale data for locales " + locales.join(","));

    locales.forEach(function(locale) {
        var l = new Locale(locale);

        outputSet.add("root");
        outputSet.add(l.language);

        if (l.script) {
            outputSet.add(l.language + "-" + l.script);
            if (l.region) {
                outputSet.add(l.language + "-" + l.script + "-" + l.region);
            }
        }
        if (l.region) {
            outputSet.add(l.language + "-" + l.region);
            outputSet.add("und-" + l.region);
        }
    }.bind(this));

    // Write out the manifest file so that the WebpackLoader knows when to attempt
    // to load data and when not to. If a file it is attempting to load is not in
    // the manifest, it does not have to load the locale files that would contain it,
    // which leads to 404s.
    var files = toArray(outputSet);

    if (!emptyLocaleDataFilesEmitted) {
        var manifestObj =  {
            files: files.map(function(name) {
                return name + ".js";
            })
        };
        var outputPath = path.join(outputDir, "locales");
        makeDirs(outputPath);
        if (options.debug) console.log("Emitting " + path.join(outputPath, "ilibmanifest.json"));
        fs.writeFileSync(path.join(outputPath, "ilibmanifest.json"), JSON.stringify(manifestObj), "utf-8");

        // now write out all the empty files

        files.forEach(function(fileName) {
            if (options.debug) console.log("Creating " + fileName);

            var outputFile = path.join(outputPath, fileName + ".js");
            if (!fs.existsSync(outputFile)) {
                if (options.debug) console.log("Writing to " + outputFile);
                makeDirs(path.dirname(outputFile));
                fs.writeFileSync(outputFile, "", "utf-8"); // write empty file
            }
        }.bind(this));

        emptyLocaleDataFilesEmitted = true;
    }

    // console.log("Done emitting locale data.");
    return files.concat(["ilibmanifest"]);
}

var ilibDataLoader = function(source) {
    const options = getOptions(this) || {};
    var match;
    var output = "";
    var callback;
    var outputRoot = (this._compilation.options &&
        this._compilation.options.output &&
        this._compilation.options.output.path) || ".";

    options.locales = typeof(options.locales) === "string" ? options.locales.split(",") : (options.locales || [
        "en-AU", "en-CA", "en-GB", "en-IN", "en-NG", "en-PH",
        "en-PK", "en-US", "en-ZA", "de-DE", "fr-CA", "fr-FR",
        "es-AR", "es-ES", "es-MX", "id-ID", "it-IT", "ja-JP",
        "ko-KR", "pt-BR", "ru-RU", "tr-TR", "vi-VN", "zxx-XX",
        "zh-Hans-CN", "zh-Hant-HK", "zh-Hant-TW", "zh-Hans-SG"
    ]);
    options.assembly = options.assembly || "assembled";
    options.compilation = options.compilation || "uncompiled";
    options.size = options.size || "standard";
    options.target = options.target || "web";

    if (options.debug) console.log("ilib-loader: processing file " + this.resource);

    // When making the ilib build inside of the ilib project, the webpack.config.js passes in
    // a ilibRoot parameter so that it gets the latest (local) ilib files. Other callers do not need to pass
    // in the ilibRoot. Instead, they should use the default, which is to get the ilib files from
    // the installed ilib package in their node_modules directory.
    loadIlibClasses(options.ilibRoot);

    // mix all of the locale data we find in all of the js files together so that
    // we can emit one file for each locale with all the locale data that are
    // needed for that locale
    if (!this._compilation.localeDataSet) {
        this._compilation.localeDataSet = new Set();
    }
    var dataSet = this._compilation.localeDataSet;

    var searchFile = function (re, text) {
        var output = "";

        re.lastIndex = 0;
        while ((match = re.exec(text)) !== null) {
            // console.log(">>>>>>>>>> found a match");
            var datafiles = match[1].split(/\s+/g);

            datafiles.forEach(function(filename) {
                if (filename) {
                    dataSet.add(filename);
                }
            });
        }
    };

    var processMacros = function (re, text) {
        var partial = text;
        var output = "";

        re.lastIndex = 0;
        while ((match = re.exec(partial)) !== null) {
            // console.log(">>>>>>>>>> found a match");
            var macroName = match[1];
            output += partial.substring(0, match.index);

            if (macroName) {
                if (macroName.toLowerCase() === "localelist") {
                    output += "Locale.locales = " + JSON.stringify(options.locales) + ";";
                } else if (macroName.toLowerCase() === "ilibversion") {
                    // the DefinePlugin in the config will replace this with the
                    // actual version number from the project.json file
                    output += "__VERSION__";
                }
            }

            partial = partial.substring(match.index + match[0].length);
            re.lastIndex = 0;
        }

        return output + partial;
    }.bind(this);

    var processDefineLocaleData = function (text) {
        var partial = text;
        var output = "";
        var root = options.ilibRoot || 'ilib';

        defineLocaleDataPattern.lastIndex = 0;
        if ((match = defineLocaleDataPattern.exec(partial)) !== null) {
            // console.log(">>>>>>>>>> found a match");
            output += partial.substring(0, match.index);
            if (options.assembly !== "assembled") {
                output +=
                    "ilib.WebpackLoader = require('" + root + "/lib/WebpackLoader.js');\n" +
                    "ilib.setLoaderCallback(ilib.WebpackLoader(ilib));\n" +
                    "ilib._dyncode = false;\n" +
                    "ilib._dyndata = true;\n";
            } else {
                var files = emitLocaleData(this._compilation, options);
                if (files) {
                    var outputPath = path.join(outputRoot, "locales");
                    files.forEach(function(locale) {
                        if (locale !== "ilibmanifest") {
                            var name = "locale" + locale.replace(/-/g, '_');
                            output += "var " + name + " = require('" + path.join(outputPath, locale + ".js") + "'); " + name + " && typeof(" + name + ".installLocale) === 'function' && " + name + ".installLocale(ilib);\n";
                        }
                    });
                }
                output +=
                    "ilib._dyncode = false;\n" +
                    "ilib._dyndata = false;\n";
            }

            partial = partial.substring(match.index + match[0].length);
            defineLocaleDataPattern.lastIndex = 0;
        }

        return output + partial;
    }.bind(this);

    var processLoadLocaleData = function (text) {
        var partial = text;
        var output = "";

        loadLocaleDataPattern.lastIndex = 0;
        if ((match = loadLocaleDataPattern.exec(partial)) !== null) {
            var files = emitLocaleData(this._compilation, options);

            // console.log(">>>>>>>>>> found a match");
            output += partial.substring(0, match.index);
            var outputPath = path.join(outputRoot, "locales");
            files.forEach(function(file) {
                if (file === "root") {
                    output += "default:\n";
                }

                output += "        case '" + file + "':\n";

                output += (file === "ilibmanifest") ?
                    "            System.import(/* webpackChunkName: '" + file + "' */ '" + path.join(outputPath, file + ".json") + "').then(function(module) {\n" +
                    "                callback(module);\n" :
                    "            System.import(/* webpackChunkName: '" + file + "' */ '" + path.join(outputPath, file + ".js") + "').then(function(module) {\n" +
                    "                module && typeof(module.installLocale) === \"function\" && module.installLocale(ilib);\n" +
                    "                callback(module);\n";

                output +=
                    "            });\n" +
                    "            break;\n";
            });

            partial = partial.substring(match.index + match[0].length);
            loadLocaleDataPattern.lastIndex = 0;
        }

        return output + partial;
    }.bind(this);

    function processFile(partial) {
        searchFile(dataPatternSlashStar, partial);
        searchFile(dataPatternSlashSlash, partial);

        partial = processMacros(macroPatternSlashSlash, partial);
        partial = processMacros(macroPatternQuoted, partial);

        partial = processDefineLocaleData(partial);

        return processLoadLocaleData(partial);
    }

    output = processFile(source);

    // console.log("****************************************\nTransformed file to:\n" + output);
    return output;
};

module.exports = ilibDataLoader;
