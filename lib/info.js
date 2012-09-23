var httpDuplex = require('http-duplex');
var path = require('path');
var spawn = require('child_process').spawn;

var noCache = require('./no_cache');
var onexit = require('./onexit');

module.exports = function (opts, req, res) {
    var self = opts.repos;
    var dup = httpDuplex(req, res);
    
    dup.accept = function () { dup.emit('accept') };
    dup.reject = function (code) { dup.emit('reject', code) };
    
    dup.once('reject', function (code) {
        res.statusCode = code || 500;
        res.end();
    });
    
    self.exists(opts.repo, function (ex) {
        var anyListeners = self.listeners('info').length > 0;
        
        if (!ex && self.autoCreate) {
            dup.exists = ex;
            
            dup.on('accept', function () {
                self.create(opts.repo, next)
            });
            
            self.emit('info', dup);
            if (!anyListeners) dup.accept();
        }
        else if (!ex) {
            res.statusCode = 404;
            res.setHeader('content-type', 'text/plain');
            res.end('repository not found');
        }
        else {
            dup.on('accept', next);
            self.emit('info', dup);
            
            if (!anyListeners) dup.accept();
        }
    });
    
    function next () {
        res.setHeader('content-type',
            'application/x-git-' + opts.service + '-advertisement'
        );
        noCache(res);
        serviceRespond(opts.service, path.join(self.repoDir, opts.repo), res);
    }
}

function serviceRespond (service, file, res) {
    function pack (s) {
        var n = (4 + s.length).toString(16);
        return Array(4 - n.length + 1).join('0') + n + s;
    }
    res.write(pack('# service=git-' + service + '\n'));
    res.write('0000');
    
    var ps = spawn('git-' + service, [
        '--stateless-rpc',
        '--advertise-refs',
        file
    ]);
    ps.stdout.pipe(res, { end : false });
    ps.stderr.pipe(res, { end : false });
    
    onexit(ps, function () { res.end() });
}
