"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Parser = exports.Layer = exports.MoveCommand = exports.GCodeCommand = void 0;
/* eslint-disable no-unused-vars */
var thumbnail_1 = require("./thumbnail");
var GCodeCommand = /** @class */ (function () {
    function GCodeCommand(src, gcode, params, comment) {
        this.src = src;
        this.gcode = gcode;
        this.params = params;
        this.comment = comment;
    }
    return GCodeCommand;
}());
exports.GCodeCommand = GCodeCommand;
var MoveCommand = /** @class */ (function (_super) {
    __extends(MoveCommand, _super);
    function MoveCommand(src, gcode, params, comment) {
        var _this = _super.call(this, src, gcode, params, comment) || this;
        _this.params = params;
        return _this;
    }
    return MoveCommand;
}(GCodeCommand));
exports.MoveCommand = MoveCommand;
var Layer = /** @class */ (function () {
    function Layer(layer, commands, lineNumber) {
        this.layer = layer;
        this.commands = commands;
        this.lineNumber = lineNumber;
    }
    return Layer;
}());
exports.Layer = Layer;
var Parser = /** @class */ (function () {
    function Parser() {
        this.lines = [];
        this.preamble = new Layer(-1, [], 0);
        this.layers = [];
        this.curZ = 0;
        this.maxZ = 0;
        this.metadata = { thumbnails: {} };
    }
    Parser.prototype.parseGCode = function (input) {
        var lines = Array.isArray(input)
            ? input
            : input.split('\n');
        this.lines = this.lines.concat(lines);
        var commands = this.lines2commands(lines);
        this.groupIntoLayers(commands.filter(function (cmd) { return cmd instanceof MoveCommand; }));
        // merge thumbs
        var thumbs = this.parseMetadata(commands.filter(function (cmd) { return cmd.comment; })).thumbnails;
        for (var _i = 0, _a = Object.entries(thumbs); _i < _a.length; _i++) {
            var _b = _a[_i], key = _b[0], value = _b[1];
            this.metadata.thumbnails[key] = value;
        }
        return { layers: this.layers, metadata: this.metadata };
    };
    Parser.prototype.lines2commands = function (lines) {
        var _this = this;
        return lines
            .map(function (l) { return _this.parseCommand(l); });
    };
    Parser.prototype.parseCommand = function (line, keepComments) {
        if (keepComments === void 0) { keepComments = true; }
        var input = line.trim();
        var splitted = input.split(';');
        var cmd = splitted[0];
        var comment = (keepComments && splitted[1]) || null;
        var parts = cmd.split(/ +/g);
        var gcode = parts[0].toLowerCase();
        var params;
        switch (gcode) {
            case 'g0':
            case 'g1':
                params = this.parseMove(parts.slice(1));
                return new MoveCommand(line, gcode, params, comment);
            default:
                params = this.parseParams(parts.slice(1));
                // console.warn(`non-move code: ${gcode} ${params}`);
                return new GCodeCommand(line, gcode, params, comment);
        }
    };
    // G0 & G1
    Parser.prototype.parseMove = function (params) {
        return params.reduce(function (acc, cur) {
            var key = cur.charAt(0).toLowerCase();
            if (key == 'x' || key == 'y' || key == 'z' || key == 'e' || key == 'f')
                acc[key] = parseFloat(cur.slice(1));
            return acc;
        }, {});
    };
    Parser.prototype.isAlpha = function (char) {
        var code = char.charCodeAt(0);
        return (code >= 97 && code <= 122) || (code >= 65 && code <= 90);
    };
    Parser.prototype.parseParams = function (params) {
        var _this = this;
        return params.reduce(function (acc, cur) {
            var key = cur.charAt(0).toLowerCase();
            if (_this.isAlpha(key))
                acc[key] = parseFloat(cur.slice(1));
            return acc;
        }, {});
    };
    Parser.prototype.groupIntoLayers = function (commands) {
        for (var lineNumber = 0; lineNumber < commands.length; lineNumber++) {
            var cmd = commands[lineNumber];
            if (!(cmd instanceof MoveCommand)) {
                if (this.currentLayer)
                    this.currentLayer.commands.push(cmd);
                else
                    this.preamble.commands.push(cmd);
                continue;
            }
            var params = cmd.params;
            if (params.z) {
                // abs mode
                this.curZ = params.z;
            }
            if (params.e > 0 &&
                (params.x != undefined || params.y != undefined) &&
                this.curZ > this.maxZ) {
                this.maxZ = this.curZ;
                this.currentLayer = new Layer(this.layers.length, [cmd], lineNumber);
                this.layers.push(this.currentLayer);
                continue;
            }
            if (this.currentLayer)
                this.currentLayer.commands.push(cmd);
            else
                this.preamble.commands.push(cmd);
        }
        return this.layers;
    };
    Parser.prototype.parseMetadata = function (metadata) {
        var thumbnails = {};
        var thumb = null;
        for (var _i = 0, metadata_1 = metadata; _i < metadata_1.length; _i++) {
            var cmd = metadata_1[_i];
            var comment = cmd.comment;
            var idxThumbBegin = comment.indexOf('thumbnail begin');
            var idxThumbEnd = comment.indexOf('thumbnail end');
            if (idxThumbBegin > -1) {
                thumb = thumbnail_1.Thumbnail.parse(comment.slice(idxThumbBegin + 15).trim());
            }
            else if (thumb) {
                if (idxThumbEnd == -1) {
                    thumb.chars += comment.trim();
                }
                else {
                    if (thumb.isValid) {
                        thumbnails[thumb.size] = thumb;
                        console.debug('thumb found', thumb.size);
                        console.debug('declared length', thumb.charLength, 'actual length', thumb.chars.length);
                    }
                    else {
                        console.warn('thumb found but seems to be invalid');
                    }
                    thumb = null;
                }
            }
        }
        return { thumbnails: thumbnails };
    };
    return Parser;
}());
exports.Parser = Parser;
Parser.prototype.parseGcode = Parser.prototype.parseGCode;
