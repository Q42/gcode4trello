"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Thumbnail = void 0;
var prefix = 'data:image/jpeg;base64,';
var Thumbnail = /** @class */ (function () {
    function Thumbnail() {
        this.chars = '';
    }
    Thumbnail.parse = function (thumbInfo) {
        var thumb = new Thumbnail();
        var infoParts = thumbInfo.split(' ');
        thumb.size = infoParts[0];
        var sizeParts = thumb.size.split('x');
        thumb.width = +sizeParts[0];
        thumb.height = +sizeParts[1];
        thumb.charLength = +infoParts[1];
        return thumb;
    };
    Object.defineProperty(Thumbnail.prototype, "src", {
        get: function () {
            return prefix + this.chars;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Thumbnail.prototype, "isValid", {
        get: function () {
            // https://stackoverflow.com/questions/475074/regex-to-parse-or-validate-base64-data/475217#475217
            var base64regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
            return this.chars.length == this.charLength && base64regex.test(this.chars);
        },
        enumerable: false,
        configurable: true
    });
    return Thumbnail;
}());
exports.Thumbnail = Thumbnail;
