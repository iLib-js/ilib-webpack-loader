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

var path = require('path');
var fs = require('fs');
var ilib;
var Locale;
var Utils;

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

var dataPatternSlashStar = /\/\*\s*!data\s*([^\*]+)\*\//g;
var dataPatternSlashSlash = /\/\/\s*!data\s*([^\n]+)/g;

var macroPatternSlashSlash = /\/\/\s*!macro\s*(\S*)/g;
var macroPatternQuoted = /["']!macro\s*(\S*)["']/g;

var loadLocaleDataPattern = /\/\/\s*!loadLocaleData/g;
var defineLocaleDataPattern = /\/\/\s*!defineLocaleData/g;

var ilibDataLoader = function(source) {
    if (!this._compilation.ilibWebpackPlugin) {
        throw new Error("ilib-webpack-loader cannot run without the ilib-webpack-plugin as well. Make sure to add ilib-webpack-plugin into the plugins section of your webpack.config.js file.");
    }

    const options = getOptions(this) || {};
    var match;
    var output = "";
    var callback;
    var outputRoot = path.resolve(path.join(process.cwd(), options.tempDir || 'assets'));

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

    var ilibWebpackPlugin = this._compilation.ilibWebpackPlugin;

    var searchFile = function (re, text) {
        var output = "";

        re.lastIndex = 0;
        while ((match = re.exec(text)) !== null) {
            // console.log(">>>>>>>>>> found a match");
            var datafiles = match[1].split(/\s+/g);

            datafiles.forEach(function(filename) {
                if (filename) {
                    ilibWebpackPlugin.addData(filename);
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
                var files = ilibWebpackPlugin.getDummyLocaleDataFiles(this._compilation);
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
            var files = ilibWebpackPlugin.getDummyLocaleDataFiles(this._compilation);

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
