var ilib = require("ilib/lib/ilib.js");
   
// assign each class to a subproperty of "ilib"
ilib.Locale = require("ilib/lib/Locale.js");
ilib.DateFmt = require("ilib/lib/DateFmt.js");
ilib.NumFmt = require("ilib/lib/NumFmt.js");

// This unpacks the above classes to the global scope
require("ilib/lib/ilib-unpack.js");

module.exports = ilib;