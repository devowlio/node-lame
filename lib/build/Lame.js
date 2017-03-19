"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var LameOptions_1 = require("./LameOptions");
var fs_1 = require("fs");
var util_1 = require("util");
var child_process_1 = require("child_process");
var events_1 = require("events");
/**
 * Wrapper for Lame for Node
 *
 * @class Lame
 */
var Lame = (function () {
    /**
     * Creates an instance of Lame and set all options
     * @param {Options} options
     */
    function Lame(options) {
        this.status = {
            "started": false,
            "finished": false,
            "progress": undefined,
            "eta": undefined
        };
        this.emitter = new events_1.EventEmitter();
        this.options = options;
        this.args = new LameOptions_1.LameOptions(this.options).getArguments();
    }
    /**
     * Set file path of audio to decode/encode
     *
     * @param {string} filePath
     */
    Lame.prototype.setFile = function (path) {
        if (!fs_1.existsSync(path)) {
            throw new Error("Audio file (path) dose not exist");
        }
        this.filePath = path;
        this.fileBuffer = undefined;
        return this;
    };
    /**
     * Set file buffer of audio to decode/encode
     *
     * @param {Buffer} file
     */
    Lame.prototype.setBuffer = function (file) {
        if (!util_1.isBuffer(file)) {
            throw new Error("Audio file (buffer) dose not exist");
        }
        this.fileBuffer = file;
        this.filePath = undefined;
        return this;
    };
    /**
     * Get decoded/encoded file path
     *
     * @returns {string} Path of decoded/encoded file
     */
    Lame.prototype.getFile = function () {
        if (this.progressedFilePath == undefined) {
            throw new Error("Audio is not yet decoded/encoded");
        }
        return this.progressedFilePath;
    };
    /**
     * Get decoded/encoded file as buffer
     *
     * @returns {Buffer} decoded/Encoded file
     */
    Lame.prototype.getBuffer = function () {
        if (this.progressedBuffer == undefined) {
            throw new Error("Audio is not yet decoded/encoded");
        }
        return this.progressedBuffer;
    };
    /**
     * Get event emitter
     *
     * @returns {EventEmitter}
     */
    Lame.prototype.getEmitter = function () {
        return this.emitter;
    };
    /**
     * Get status of coverter
     *
     * @returns {LameStatus}
     */
    Lame.prototype.getStatus = function () {
        return this.status;
    };
    /**
     * Encode audio file by Lame
     *
     * @return {Promise}
     */
    Lame.prototype.encode = function () {
        return this.progress("encode");
    };
    /**
     * Decode audio file by Lame
     *
     * @return {Promise}
     */
    Lame.prototype.decode = function () {
        return this.progress("decode");
    };
    /**
     * Decode/Encode audio file by Lame
     *
     * @return {Promise}
     */
    Lame.prototype.progress = function (type) {
        var _this = this;
        if (this.filePath == undefined && this.fileBuffer == undefined) {
            throw new Error("Audio file to encode is not set");
        }
        // Set decode flag to progress a MP3 to WAV decode
        var args = this.args;
        if (type == "decode") {
            args.push("--decode");
        }
        if (this.fileBuffer != undefined) {
            this.fileBufferTempFilePath = this.tempFilePathGenerator("raw");
            return new Promise(function (resolve, reject) {
                fs_1.writeFile(_this.fileBufferTempFilePath, _this.fileBuffer, function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }
                    resolve(_this.fileBufferTempFilePath);
                });
            })
                .then(function (file) {
                return _this.execProgress(file, args, type);
            })
                .catch(function (error) {
                _this.removeTempFilesOnError();
                throw error;
            });
        }
        else {
            return this.execProgress(this.filePath, args, type)
                .catch(function (error) {
                _this.removeTempFilesOnError();
                throw error;
            });
        }
    };
    /**
     * Execute decoding/encoding via spawn Lame
     *
     * @private
     * @param {string} inputFilePath Path of input file
     */
    Lame.prototype.execProgress = function (inputFilePath, args, type) {
        var _this = this;
        // Add output settings args
        args.push("--disptime");
        args.push("1");
        // Add output file to args, if not in options undefined
        if (this.options.output == "buffer") {
            var tempOutPath = this.tempFilePathGenerator("progressed");
            args.unshift("" + tempOutPath);
            // Set decode/encoded file path
            this.progressedBufferTempFilePath = tempOutPath;
        }
        else {
            // Set decode/encoded file path
            this.progressedFilePath = this.options.output;
            args.unshift(this.progressedFilePath);
        }
        // Add input file to args
        args.unshift(inputFilePath);
        // Spawn instance of encoder and hook output methods
        this.status.started = true;
        this.status.finished = false;
        this.status.progress = 0;
        this.status.eta = undefined;
        /**
         * Handles output of stdout (and stderr)
         * Parse data from output into object
         *
         * @param {(String | Buffer)} data
         */
        var progressStdout = function (data) {
            data = data.toString().trim();
            // Every output of Lame comes as "stderr", so decide if it is an error or valid data by regex
            if (data.length > 6) {
                if (type == "encode" && data.search("Writing LAME Tag...done") > -1) {
                    _this.status.finished = true;
                    _this.status.progress = 100;
                    _this.status.eta = "00:00";
                    _this.emitter.emit("finish");
                    _this.emitter.emit("progress", [_this.status.progress, _this.status.eta]);
                }
                else if (type == "encode" && data.search(/\((( [0-9])|([0-9]{2})|(100))%\)\|/) > -1) {
                    var progressMatch = data.match(/\((( [0-9])|([0-9]{2})|(100))%\)\|/);
                    var etaMatch = data.match(/[0-9]{1,2}:[0-9][0-9] /);
                    var progress = String(progressMatch[1]);
                    var eta = null;
                    if (etaMatch != null) {
                        eta = etaMatch[0].trim();
                    }
                    if (progress != null && Number(progress) > _this.status.progress) {
                        _this.status.progress = Number(progress);
                    }
                    if (eta != null) {
                        _this.status.eta = eta;
                    }
                    _this.emitter.emit("progress", [_this.status.progress, _this.status.eta]);
                }
                else if (type == "decode" && data.search(/[0-9]{1,10}\/[0-9]{1,10}/) > -1) {
                    var progressMatch = data.match(/[0-9]{1,10}\/[0-9]{1,10}/);
                    var progressAbsolute = progressMatch[0].split("/");
                    var progress = Math.floor(Number(progressAbsolute[0]) / Number(progressAbsolute[1]) * 100);
                    if (!isNaN(progress) && Number(progress) > _this.status.progress) {
                        _this.status.progress = Number(progress);
                    }
                    _this.emitter.emit("progress", [_this.status.progress, _this.status.eta]);
                    if (_this.status.progress == 100 && !_this.status.finished) {
                        _this.status.finished = true;
                        _this.status.progress = 100;
                        _this.status.eta = "00:00";
                        _this.emitter.emit("finish");
                    }
                }
                else if (data.search(/^lame: /) > -1) {
                    _this.emitter.emit("error", String(data));
                }
            }
        };
        /**
         * Handles error throw of Lame instance
         *
         * @param {Error} error
         */
        var progressError = function (error) {
            _this.emitter.emit("error", error);
        };
        var instance = child_process_1.spawn("Lame", args);
        instance.stdout.on("data", progressStdout);
        instance.stderr.on("data", progressStdout); // Most output, even not errors, are on stderr
        instance.on("error", progressError);
        // Return promise of finish encoding progress
        return new Promise(function (resolve, reject) {
            _this.emitter.on("finish", function () {
                // If input was buffer, remove temp file
                if (_this.fileBufferTempFilePath != undefined) {
                    fs_1.unlink(_this.fileBufferTempFilePath);
                }
                // If output should be a buffer, load decoded/encoded audio file in object and remove temp file
                if (_this.options.output == "buffer") {
                    fs_1.readFile(_this.progressedBufferTempFilePath, null, function (error, data) {
                        // Remove temp decoded/encoded file
                        fs_1.unlink(_this.progressedBufferTempFilePath);
                        if (error) {
                            reject(error);
                            return;
                        }
                        _this.progressedBuffer = new Buffer(data);
                        _this.progressedBufferTempFilePath = undefined;
                    });
                }
                else {
                    resolve(_this);
                }
            });
            _this.emitter.on("error", function (error) {
                reject(error);
            });
        });
    };
    /**
     * Generate temp file path
     *
     * @param {("raw" | "encoded")} type
     * @returns {string} Path
     */
    Lame.prototype.tempFilePathGenerator = function (type) {
        var path = "./temp/" + type + "/";
        var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        for (var i = 0; i < 32; i++) {
            path += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        if (!fs_1.existsSync("./temp/" + path)) {
            return path;
        }
        else {
            return this.tempFilePathGenerator(type);
        }
    };
    /**
     * Remove temp files, if error occurred
     */
    Lame.prototype.removeTempFilesOnError = function () {
        if (this.fileBufferTempFilePath != undefined) {
            fs_1.unlink(this.fileBufferTempFilePath);
        }
        if (this.progressedBufferTempFilePath != undefined) {
            fs_1.unlink(this.progressedBufferTempFilePath);
        }
    };
    return Lame;
}());
exports.Lame = Lame;
//# sourceMappingURL=Lame.js.map