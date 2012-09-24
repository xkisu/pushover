var fs = require('fs');
var path = require('path');
var http = require('http');
var mkdirp = require('mkdirp');

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

Git.prototype.list = function (cb) {
    fs.readdir(this.repoDir, cb);
};

Git.prototype.exists = function (repo, cb) {
    (fs.exists || path.exists)(path.join(this.repoDir, repo), cb);
};

Git.prototype.mkdir = function (dir, cb) {
    mkdirp(path.resolve(this.repoDir, dir), cb);
};

Git.prototype.create = function (repo, cb) {
    var self = this;
    if (typeof cb !== 'function') cb = function () {};
    var cwd = process.cwd();
    if (/\.\.|^\//.test(repo)) return cb('invalid repo name');
    
    self.exists(repo, function (ex) {
        if (!ex) self.mkdir(repo, next)
        else next()
    });
    
    function next (err) {
        if (err) return cb(err);
        
        var dir = path.join(self.repoDir, repo);
        if (self.checkout) {
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
    }
};

Git.prototype.handle = require('./lib/handle');
