var ilib = require("ilib/lib/ilib.js");
   
// assign each class to a subproperty of "ilib"
ilib.Locale = require("ilib/lib/Locale.js");
ilib.DateFmt = require("ilib/lib/DateFmt.js");
ilib.NumFmt = require("ilib/lib/NumFmt.js");

// uncomment this if you are trying this with a dynamic assembly
var WebpackLoader = require("ilib/lib/WebpackLoader.js");

// This unpacks the above classes to the global scope
require("ilib/lib/ilib-unpack.js");

// Must be at the end of meta file to generate the locale data files
require("ilib/lib/ilib-getdata.js");

module.exports = ilib;