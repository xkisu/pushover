var fs = require('fs');
var path = require('path');
var http = require('http');

var spawn = require('child_process').spawn;
var EventEmitter = require('events').EventEmitter;

var onexit = require('./lib/onexit');

module.exports = function (repoDir, opts) {
    if (!opts) opts = {};
    return new Git(repoDir, opts);
};

function Git (repoDir, opts) {
    this.repoDir = repoDir;
    this.autoCreate = opts.autoCreate === false ? false : true;
    this.checkout = opts.checkout;
}

Git.prototype = new EventEmitter;

Git.prototype.listen = function () {
    var self = this;
    var server = http.createServer(this.handle.bind(this));
    server.on('listening', function () {
        var args = Array.prototype.slice.call(arguments);
        args.unshift('listening');
        self.emit.apply(self, args);
    });
    server.listen.apply(server, arguments);
    return server;
};

Git.prototype.list = function (cb) {
    fs.readdir(this.repoDir, cb);
};

Git.prototype.exists = function (repo, cb) {
    (fs.exists || path.exists)(path.join(this.repoDir, repo), cb);
};

Git.prototype.create = function (repo, cb) {
    var cwd = process.cwd();
    var dir = path.join(this.repoDir, repo);
    if (this.checkout) {
        var ps = spawn('git', [ 'init', dir ]);
    } else {
        var ps = spawn('git', [ 'init', '--bare', dir ]);
    }
    
    var err = '';
    ps.stderr.on('data', function (buf) { err += buf });
    
    onexit(ps, function (code) {
        if (!cb) {}
        else if (code) cb(err || true)
        else cb(null)
    });
};

Git.prototype.handle = require('./lib/handle');
